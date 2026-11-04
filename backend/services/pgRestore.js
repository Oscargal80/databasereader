const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const BINARY = process.platform === 'win32' ? 'pg_restore.exe' : 'pg_restore';

const TOC_TYPES = [
    'ACCESS METHOD', 'ACL', 'AGGREGATE', 'BLOB', 'BLOBS', 'CAST', 'CHECK CONSTRAINT', 'COLLATION', 'COMMENT',
    'CONSTRAINT', 'CONVERSION', 'DATABASE', 'DEFAULT ACL', 'DEFAULT', 'DOMAIN', 'ENCODING', 'EVENT TRIGGER',
    'EXTENSION', 'FK CONSTRAINT', 'FOREIGN DATA WRAPPER', 'FOREIGN TABLE', 'FUNCTION', 'INDEX ATTACH', 'INDEX',
    'LANGUAGE', 'LARGE OBJECT', 'MATERIALIZED VIEW DATA', 'MATERIALIZED VIEW', 'OPERATOR CLASS',
    'OPERATOR FAMILY', 'OPERATOR', 'PG_LARGEOBJECT', 'POLICY', 'PROCEDURE', 'PUBLICATION TABLE', 'PUBLICATION',
    'REFRESH MATERIALIZED VIEW', 'ROW SECURITY', 'RULE', 'SCHEMA', 'SEARCHPATH', 'SECURITY LABEL',
    'SEQUENCE OWNED BY', 'SEQUENCE SET', 'SEQUENCE', 'SERVER', 'SHELL TYPE', 'STATISTICS', 'STDSTRINGS',
    'SUBSCRIPTION', 'TABLE ATTACH', 'TABLE DATA', 'TABLE', 'TEXT SEARCH CONFIGURATION',
    'TEXT SEARCH DICTIONARY', 'TEXT SEARCH PARSER', 'TEXT SEARCH TEMPLATE', 'TRANSFORM', 'TRIGGER', 'TYPE',
    'USER MAPPING', 'VIEW'
].sort((a, b) => b.length - a.length);

const versionOf = (binaryPath) => {
    try {
        const out = execFileSync(binaryPath, ['--version'], { encoding: 'utf8', timeout: 5000 });
        return out.trim();
    } catch {
        return null;
    }
};

const listDirs = (base) => {
    try {
        return fs.readdirSync(base).map(name => path.join(base, name));
    } catch {
        return [];
    }
};

const PLATFORM_FOLDER = { win32: 'win', darwin: 'mac', linux: 'linux' }[process.platform] || process.platform;

// Where the installer puts the pg_restore it ships (resources/pg) and where the build script leaves it in development
const bundledRoots = () => {
    const roots = [];
    if (process.resourcesPath) roots.push(path.join(process.resourcesPath, 'pg'));
    roots.push(path.join(__dirname, '..', 'bin', `${PLATFORM_FOLDER}-${process.arch}`));
    return roots;
};

const candidatePaths = () => {
    const candidates = [];
    if (process.env.PG_RESTORE_PATH) candidates.push(process.env.PG_RESTORE_PATH);

    bundledRoots().forEach(root => candidates.push(path.join(root, BINARY), path.join(root, 'bin', BINARY)));

    (process.env.PATH || '').split(path.delimiter).filter(Boolean)
        .forEach(dir => candidates.push(path.join(dir, BINARY)));

    if (process.platform === 'darwin') {
        candidates.push('/opt/homebrew/opt/libpq/bin/pg_restore', '/usr/local/opt/libpq/bin/pg_restore');
        listDirs('/opt/homebrew/Cellar/libpq').forEach(v => candidates.push(path.join(v, 'bin', BINARY)));
        listDirs('/Applications/Postgres.app/Contents/Versions').forEach(v => candidates.push(path.join(v, 'bin', BINARY)));
    } else if (process.platform === 'linux') {
        listDirs('/usr/lib/postgresql').forEach(v => candidates.push(path.join(v, 'bin', BINARY)));
    } else if (process.platform === 'win32') {
        listDirs('C:\\Program Files\\PostgreSQL').forEach(v => candidates.push(path.join(v, 'bin', BINARY)));
    }
    return candidates;
};

const isBundled = (candidate) => bundledRoots().some(root => candidate.startsWith(root + path.sep));

// "pg_restore (PostgreSQL) 18.3" and "pg_restore (PostgreSQL) 17.11 (Postgres.app)" both mean major 18 / 17
const majorOf = (versionText) => {
    const match = /\(PostgreSQL\)\s+(\d+)/.exec(versionText || '') || /(\d+)\.\d+/.exec(versionText || '');
    return match ? parseInt(match[1], 10) : 0;
};

let cached;

/**
 * Locate the newest pg_restore available (env override, bundled, PATH, common install dirs).
 */
const findPgRestore = () => {
    if (cached) return cached;
    const found = [];
    const seen = new Set();
    candidatePaths().forEach(candidate => {
        if (seen.has(candidate) || !fs.existsSync(candidate)) return;
        seen.add(candidate);
        const version = versionOf(candidate);
        if (version) found.push({ path: candidate, version, major: majorOf(version), bundled: isBundled(candidate) });
    });
    found.sort((a, b) => b.major - a.major);
    cached = found[0] || null;
    return cached;
};

const resetCache = () => { cached = undefined; };

const parseToc = (text) => {
    const header = {};
    const counts = {};
    const objects = {
        schemas: [], extensions: [], tables: [], views: [], materializedViews: [],
        functions: [], procedures: [], triggers: [], sequences: [], indexes: []
    };
    const withData = new Set();

    const created = /^;\s+Archive created at (.+)$/;
    const keyValue = /^;\s+([^:]+):\s*(.*)$/;

    text.split('\n').forEach(line => {
        if (line.startsWith(';')) {
            const createdMatch = created.exec(line);
            if (createdMatch) { header.archiveCreated = createdMatch[1].trim(); return; }
            const kv = keyValue.exec(line);
            if (kv) header[kv[1].trim()] = kv[2].trim();
            return;
        }

        const match = /^(\d+); (\d+) (\d+) (.*)$/.exec(line);
        if (!match) return;

        const rest = match[4];
        const type = TOC_TYPES.find(t => rest.startsWith(`${t} `)) || 'OTHER';
        counts[type] = (counts[type] || 0) + 1;

        const tokens = rest.slice(type === 'OTHER' ? 0 : type.length + 1).trim().split(/\s+/);
        const schema = tokens[0];
        const name = tokens.slice(1, -1).join(' ');

        switch (type) {
            case 'SCHEMA': objects.schemas.push(name || schema); break;
            case 'EXTENSION': objects.extensions.push(name || schema); break;
            case 'TABLE': objects.tables.push({ schema, name }); break;
            case 'TABLE DATA': withData.add(`${schema}.${name}`); break;
            case 'VIEW': objects.views.push({ schema, name }); break;
            case 'MATERIALIZED VIEW': objects.materializedViews.push({ schema, name }); break;
            case 'FUNCTION': objects.functions.push({ schema, name }); break;
            case 'PROCEDURE': objects.procedures.push({ schema, name }); break;
            case 'TRIGGER': objects.triggers.push({ schema, name }); break;
            case 'SEQUENCE': objects.sequences.push({ schema, name }); break;
            case 'INDEX': objects.indexes.push({ schema, name }); break;
            default: break;
        }
    });

    objects.tables.forEach(t => { t.hasData = withData.has(`${t.schema}.${t.name}`); });

    return {
        header: {
            database: header.dbname,
            archiveCreated: header.archiveCreated,
            tocEntries: parseInt(header['TOC Entries'], 10) || null,
            compression: header.Compression,
            format: header.Format,
            dumpVersion: header['Dump Version'],
            serverVersion: header['Dumped from database version'],
            pgDumpVersion: header['Dumped by pg_dump version']
        },
        counts,
        objects
    };
};

/**
 * Read the table of contents of a dump without touching any database.
 */
const readToc = (filePath) => new Promise((resolve, reject) => {
    const binary = findPgRestore();
    if (!binary) return reject(new Error('pg_restore no encontrado'));

    const child = spawn(binary.path, ['--list', filePath]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
        if (code !== 0) return reject(new Error(stderr.trim() || `pg_restore terminó con código ${code}`));
        resolve(parseToc(stdout));
    });
});

module.exports = { findPgRestore, resetCache, readToc, parseToc };
