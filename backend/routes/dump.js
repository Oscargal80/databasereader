const express = require('express');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Client } = require('pg');
const { STAGING_DIR } = require('../config/paths');
const { findPgRestore, readToc } = require('../services/pgRestore');

const DUMP_DIR = path.join(STAGING_DIR, 'dumps');
const MAX_DUMP_BYTES = (parseInt(process.env.MAX_DUMP_GB, 10) || 20) * 1024 * 1024 * 1024;
const DUMP_TTL_MS = 24 * 60 * 60 * 1000;
const DB_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const PROGRESS_LINE = /^pg_restore: (creating|processing data|executing|setting)/;
const LOG_TAIL_LINES = 100;
const MAX_ERROR_LINES = 50;

fs.mkdirSync(DUMP_DIR, { recursive: true });

fs.readdirSync(DUMP_DIR).forEach(name => {
    const filePath = path.join(DUMP_DIR, name);
    try {
        if (Date.now() - fs.statSync(filePath).mtimeMs > DUMP_TTL_MS) fs.unlinkSync(filePath);
    } catch (err) {
        console.warn('[DUMP-CLEANUP-WARN]', err.message);
    }
});

const dumps = new Map();
const jobs = new Map();

const checkPostgresSession = (req, res, next) => {
    const options = req.session.dbOptions;
    if (!options) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (options.dbType !== 'postgres') {
        return res.status(400).json({ success: false, message: 'La importación de dumps solo está disponible con una conexión PostgreSQL' });
    }
    next();
};

router.use(checkPostgresSession);

const ownDump = (req, res) => {
    const dump = dumps.get(req.params.id);
    if (!dump || dump.sessionId !== req.sessionID) {
        res.status(404).json({ success: false, message: 'Dump no encontrado' });
        return null;
    }
    return dump;
};

const ownJob = (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job || job.sessionId !== req.sessionID) {
        res.status(404).json({ success: false, message: 'Tarea no encontrada' });
        return null;
    }
    return job;
};

const quoteIdent = (name) => `"${name.replace(/"/g, '""')}"`;

const connectMaintenance = async (options) => {
    const client = new Client({
        host: options.host,
        port: options.port,
        database: options.database,
        user: options.user,
        password: options.password,
        connectionTimeoutMillis: 5000
    });
    await client.connect();
    return client;
};

const publicDump = (dump) => ({ id: dump.id, name: dump.name, size: dump.size });

const publicJob = (job) => ({
    id: job.id,
    dumpId: job.dumpId,
    targetDb: job.targetDb,
    createdDb: job.createdDb,
    status: job.status,
    progress: job.progress,
    current: job.current,
    processed: job.processed,
    total: job.total,
    errorCount: job.errorCount,
    errors: job.errors,
    log: job.log,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode
});

router.get('/status', (req, res) => {
    const binary = findPgRestore();
    res.json({
        success: true,
        available: Boolean(binary),
        version: binary ? binary.version : null,
        maxDumpBytes: MAX_DUMP_BYTES
    });
});

router.get('/databases', async (req, res) => {
    let client;
    try {
        client = await connectMaintenance(req.session.dbOptions);
        const result = await client.query('SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname');
        res.json({ success: true, data: result.rows.map(row => row.datname) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    } finally {
        if (client) await client.end().catch(() => { });
    }
});

/**
 * @route POST /api/dump/upload
 * @desc Stream a custom-format pg_dump file (raw body) to the staging directory
 */
router.post('/upload', (req, res) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_DUMP_BYTES) {
        return res.status(413).json({ success: false, message: 'El archivo supera el tamaño máximo permitido' });
    }

    const id = crypto.randomUUID();
    const filePath = path.join(DUMP_DIR, `${id}.dump`);
    const name = path.basename(String(req.query.name || 'dump'));
    const out = fs.createWriteStream(filePath);
    let received = 0;
    let finished = false;

    const discard = () => {
        out.destroy();
        fs.unlink(filePath, () => { });
    };

    req.on('data', chunk => {
        received += chunk.length;
        if (received > MAX_DUMP_BYTES && !finished) {
            finished = true;
            req.unpipe(out);
            discard();
            res.status(413).json({ success: false, message: 'El archivo supera el tamaño máximo permitido' });
        }
    });

    req.on('close', () => {
        if (!req.complete && !finished) {
            finished = true;
            discard();
        }
    });

    out.on('error', err => {
        if (finished) return;
        finished = true;
        console.error('[DUMP-UPLOAD-ERROR]', err);
        res.status(500).json({ success: false, message: 'No se pudo guardar el archivo' });
    });

    out.on('finish', () => {
        if (finished) return;
        finished = true;

        const magic = Buffer.alloc(5);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, magic, 0, 5, 0);
        fs.closeSync(fd);

        if (magic.toString('latin1') !== 'PGDMP') {
            fs.unlink(filePath, () => { });
            return res.status(400).json({
                success: false,
                message: 'El archivo no es un dump de PostgreSQL en formato custom (pg_dump -Fc). Los dumps en SQL plano todavía no están soportados.'
            });
        }

        const dump = { id, name, size: received, filePath, sessionId: req.sessionID, toc: null };
        dumps.set(id, dump);
        res.json({ success: true, data: publicDump(dump) });
    });

    req.pipe(out);
});

/**
 * @route GET /api/dump/:id/preview
 * @desc Table of contents of the dump, without restoring anything
 */
router.get('/:id/preview', async (req, res) => {
    const dump = ownDump(req, res);
    if (!dump) return;

    try {
        if (!dump.toc) dump.toc = await readToc(dump.filePath);
        res.json({ success: true, data: { dump: publicDump(dump), ...dump.toc } });
    } catch (err) {
        console.error('[DUMP-PREVIEW-ERROR]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

const runRestore = (job, dump, dbOptions) => {
    const parallel = Math.max(1, Math.min(4, os.cpus().length));
    const args = [
        '--no-owner', '--no-acl', '--verbose', '--no-password',
        `--jobs=${parallel}`,
        `--host=${dbOptions.host}`,
        `--port=${dbOptions.port}`,
        `--username=${dbOptions.user}`,
        `--dbname=${job.targetDb}`,
        dump.filePath
    ];
    const env = { ...process.env };
    if (dbOptions.password) env.PGPASSWORD = dbOptions.password;

    const binary = findPgRestore();
    const child = spawn(binary.path, args, { env });
    job.child = child;
    job.status = 'running';

    let buffer = '';
    const handleLine = (line) => {
        if (!line) return;
        job.log.push(line);
        if (job.log.length > LOG_TAIL_LINES) job.log.shift();

        if (PROGRESS_LINE.test(line)) {
            job.processed += 1;
            job.current = line.replace(/^pg_restore: /, '');
            if (job.total) job.progress = Math.min(99, Math.floor((job.processed / job.total) * 100));
        } else if (/^pg_restore: (error|warning: errors ignored)/.test(line)) {
            job.errorCount += 1;
            if (job.errors.length < MAX_ERROR_LINES) job.errors.push(line);
        }
    };

    child.stderr.on('data', chunk => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(handleLine);
    });

    child.on('error', err => {
        job.status = 'failed';
        job.errors.push(err.message);
        job.finishedAt = Date.now();
    });

    child.on('close', (code, signal) => {
        handleLine(buffer);
        job.exitCode = code;
        job.finishedAt = Date.now();
        job.child = null;
        if (job.cancelRequested || signal) job.status = 'cancelled';
        else if (code === 0) job.status = 'completed';
        else job.status = job.processed > 0 ? 'completed_with_errors' : 'failed';
        if (job.status === 'completed' || job.status === 'completed_with_errors') job.progress = 100;
    });
};

/**
 * @route POST /api/dump/:id/restore
 * @desc Restore the dump into a new database (default) or an existing one
 */
router.post('/:id/restore', async (req, res) => {
    const dump = ownDump(req, res);
    if (!dump) return;

    const binary = findPgRestore();
    if (!binary) {
        return res.status(503).json({ success: false, message: 'pg_restore no está instalado ni configurado (PG_RESTORE_PATH)' });
    }

    const { targetDb, mode, confirmExisting } = req.body;
    if (!DB_NAME_PATTERN.test(targetDb || '')) {
        return res.status(400).json({ success: false, message: 'Nombre de base inválido (letras, números y guion bajo; máximo 63)' });
    }
    if (mode !== 'new' && mode !== 'existing') {
        return res.status(400).json({ success: false, message: 'Modo inválido' });
    }
    if (mode === 'existing' && confirmExisting !== true) {
        return res.status(400).json({ success: false, message: 'Restaurar sobre una base existente requiere confirmación' });
    }

    const running = [...jobs.values()].find(j => j.sessionId === req.sessionID && j.status === 'running');
    if (running) {
        return res.status(409).json({ success: false, message: 'Ya hay una restauración en curso' });
    }

    const dbOptions = req.session.dbOptions;
    let client;
    try {
        client = await connectMaintenance(dbOptions);
        const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);

        if (mode === 'new') {
            if (exists.rowCount > 0) {
                return res.status(409).json({ success: false, message: `La base "${targetDb}" ya existe` });
            }
            await client.query(`CREATE DATABASE ${quoteIdent(targetDb)} TEMPLATE template0 ENCODING 'UTF8'`);
        } else if (exists.rowCount === 0) {
            return res.status(404).json({ success: false, message: `La base "${targetDb}" no existe` });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    } finally {
        if (client) await client.end().catch(() => { });
    }

    if (!dump.toc) {
        try { dump.toc = await readToc(dump.filePath); } catch { dump.toc = null; }
    }

    const job = {
        id: crypto.randomUUID(),
        dumpId: dump.id,
        sessionId: req.sessionID,
        targetDb,
        createdDb: mode === 'new',
        status: 'starting',
        progress: 0,
        current: '',
        processed: 0,
        total: dump.toc ? dump.toc.header.tocEntries : null,
        errorCount: 0,
        errors: [],
        log: [],
        startedAt: Date.now(),
        finishedAt: null,
        exitCode: null,
        cancelRequested: false,
        child: null
    };
    jobs.set(job.id, job);
    runRestore(job, dump, dbOptions);

    res.json({ success: true, data: publicJob(job) });
});

router.get('/jobs/:jobId', (req, res) => {
    const job = ownJob(req, res);
    if (job) res.json({ success: true, data: publicJob(job) });
});

router.post('/jobs/:jobId/cancel', (req, res) => {
    const job = ownJob(req, res);
    if (!job) return;
    if (job.status !== 'running' || !job.child) {
        return res.status(409).json({ success: false, message: 'La tarea no está en ejecución' });
    }
    job.cancelRequested = true;
    job.child.kill('SIGTERM');
    res.json({ success: true });
});

router.delete('/:id', (req, res) => {
    const dump = ownDump(req, res);
    if (!dump) return;

    const active = [...jobs.values()].some(j => j.dumpId === dump.id && j.status === 'running');
    if (active) {
        return res.status(409).json({ success: false, message: 'El dump está en uso por una restauración' });
    }

    dumps.delete(dump.id);
    fs.unlink(dump.filePath, () => { });
    res.json({ success: true });
});

module.exports = router;
