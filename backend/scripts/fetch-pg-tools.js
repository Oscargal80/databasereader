#!/usr/bin/env node
/**
 * Downloads the official PostgreSQL client tool `pg_restore` (and only the libraries it needs) so the
 * installers can import dumps without PostgreSQL being installed. Every download is checked against a
 * pinned SHA-256. Output goes to backend/bin/<os>-<arch>/ and is picked up by electron-builder
 * (extraResources) and by services/pgRestore.js. Nothing here is committed: bin/ and .cache/ are ignored.
 *
 * Usage: node scripts/fetch-pg-tools.js [win-x64] [mac-arm64] ...   (no arguments = every target)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'pgtools');
const OUT_DIR = path.join(ROOT, 'bin');

const POSTGRESQL_LICENSE = `PostgreSQL Database Management System
(formerly known as Postgres, then as Postgres95)

Portions Copyright (c) 1996-2026, The PostgreSQL Global Development Group
Portions Copyright (c) 1994, The Regents of the University of California

Permission to use, copy, modify, and distribute this software and its documentation for any purpose,
without fee, and without a written agreement is hereby granted, provided that the above copyright notice
and this paragraph and the following two paragraphs appear in all copies.

IN NO EVENT SHALL THE UNIVERSITY OF CALIFORNIA BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL,
INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE
AND ITS DOCUMENTATION, EVEN IF THE UNIVERSITY OF CALIFORNIA HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

THE UNIVERSITY OF CALIFORNIA SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE PROVIDED HEREUNDER
IS ON AN "AS IS" BASIS, AND THE UNIVERSITY OF CALIFORNIA HAS NO OBLIGATIONS TO PROVIDE MAINTENANCE, SUPPORT,
UPDATES, ENHANCEMENTS, OR MODIFICATIONS.

Bundled third-party libraries (see their own licenses): OpenSSL (Apache-2.0), zstd and lz4 (BSD),
libiconv and libintl (LGPL, dynamically linked), winpthreads (MIT/ZPL), Microsoft Visual C++ runtime (redistributable).
`;

// pg_restore plus the libraries it loads, found by walking its imports (PE / Mach-O) once and pinned here
const WINDOWS_FILES = [
    'pg_restore.exe', 'libpq.dll', 'libssl-3-x64.dll', 'libcrypto-3-x64.dll', 'libiconv-2.dll',
    'libintl-9.dll', 'liblz4.dll', 'libzstd.dll', 'libwinpthread-1.dll'
];
const MAC_LIBRARIES = ['libpq.5.dylib', 'libssl.3.dylib', 'libcrypto.3.dylib', 'libzstd.1.dylib', 'liblz4.1.dylib'];

const download = (url, destination, redirects = 5) => new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'sql-copilot-build' } }, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirects > 0) {
            response.resume();
            return resolve(download(new URL(response.headers.location, url).toString(), destination, redirects - 1));
        }
        if (response.statusCode !== 200) {
            response.resume();
            return reject(new Error(`HTTP ${response.statusCode} al descargar ${url}`));
        }
        const out = fs.createWriteStream(destination);
        response.pipe(out);
        out.on('finish', () => out.close(resolve));
        out.on('error', reject);
        response.on('error', reject);
    }).on('error', reject);
});

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const fetchVerified = async (target) => {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, path.basename(new URL(target.url).pathname));

    if (!fs.existsSync(file) || sha256(file) !== target.sha256) {
        console.log(`  descargando ${target.url}`);
        await download(target.url, file);
    }
    const actual = sha256(file);
    if (actual !== target.sha256) {
        fs.unlinkSync(file);
        throw new Error(`SHA-256 distinto del esperado para ${path.basename(file)}: ${actual}`);
    }
    return file;
};

const extractZipEntries = (archive, entries, destination) => {
    try {
        execFileSync('unzip', ['-j', '-o', '-q', archive, ...entries, '-d', destination]);
    } catch (err) {
        // Windows hosts have no unzip: bsdtar reads zip files
        const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'pgtools-'));
        execFileSync('tar', ['-xf', archive, '-C', staging, ...entries]);
        entries.forEach(entry => fs.copyFileSync(path.join(staging, entry), path.join(destination, path.basename(entry))));
        fs.rmSync(staging, { recursive: true, force: true });
    }
};

const TARGETS = {
    'win-x64': {
        url: 'https://get.enterprisedb.com/postgresql/postgresql-17.9-1-windows-x64-binaries.zip',
        sha256: 'e4b31879202d87894375eee6cfc88adf5afbb030687a3674361d78e427357f24',
        version: '17.9 (EDB PostgreSQL binaries)',
        extract: (archive, destination) => {
            const entries = WINDOWS_FILES.map(file => `pgsql/bin/${file}`);
            // pg_restore.exe links the Visual C++ runtime, which a clean Windows may not have
            entries.push('pgsql/pgAdmin 4/python/vcruntime140.dll');
            extractZipEntries(archive, entries, destination);
        }
    },
    'mac-arm64': {
        url: 'https://github.com/PostgresApp/PostgresApp/releases/download/v2.9.6/Postgres-2.9.6-17.dmg',
        sha256: 'b38bb00b8c8702a568270aab85995c550f7f93d1503b818efdc5ff9a519b7168',
        version: '17 (Postgres.app 2.9.6, universal)',
        extract: (archive, destination) => {
            if (process.platform !== 'darwin') throw new Error('El paquete de Mac solo se puede preparar desde macOS');

            const attach = execFileSync('hdiutil', ['attach', '-nobrowse', '-readonly', archive], { encoding: 'utf8' });
            const mountPoint = attach.split('\n').map(line => line.split('\t').pop().trim()).find(part => part.startsWith('/Volumes/'));
            try {
                const version = path.join(mountPoint, 'Postgres.app', 'Contents', 'Versions', '17');
                fs.mkdirSync(path.join(destination, 'bin'), { recursive: true });
                fs.mkdirSync(path.join(destination, 'lib'), { recursive: true });
                fs.copyFileSync(path.join(version, 'bin', 'pg_restore'), path.join(destination, 'bin', 'pg_restore'));
                fs.chmodSync(path.join(destination, 'bin', 'pg_restore'), 0o755);
                MAC_LIBRARIES.forEach(lib => fs.copyFileSync(path.join(version, 'lib', lib), path.join(destination, 'lib', lib)));
            } finally {
                execFileSync('hdiutil', ['detach', mountPoint, '-quiet']);
            }
        }
    }
};

// Platforms without a bundled pg_restore still get a folder so electron-builder has something to copy
const PLACEHOLDERS = ['mac-x64', 'linux-x64', 'linux-arm64', 'win-arm64', 'win-ia32'];

const prepare = async (name) => {
    const target = TARGETS[name];
    const destination = path.join(OUT_DIR, name);
    const marker = path.join(destination, '.ready');

    if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim() === target.sha256) {
        console.log(`✓ ${name}: ya preparado`);
        return;
    }
    console.log(`→ ${name}: PostgreSQL ${target.version}`);
    const archive = await fetchVerified(target);

    fs.rmSync(destination, { recursive: true, force: true });
    fs.mkdirSync(destination, { recursive: true });
    target.extract(archive, destination);

    fs.writeFileSync(path.join(destination, 'LICENSE-postgresql.txt'), POSTGRESQL_LICENSE);
    fs.writeFileSync(path.join(destination, 'VERSION.txt'), `pg_restore ${target.version}\nOrigen: ${target.url}\nSHA-256: ${target.sha256}\n`);
    fs.writeFileSync(marker, target.sha256);
    console.log(`✓ ${name}: listo`);
};

(async () => {
    const requested = process.argv.slice(2);
    const names = requested.length > 0 ? requested : Object.keys(TARGETS);

    for (const name of names) {
        if (!TARGETS[name]) {
            if (PLACEHOLDERS.includes(name)) continue;
            throw new Error(`Objetivo desconocido: ${name} (opciones: ${Object.keys(TARGETS).join(', ')})`);
        }
        if (name.startsWith('mac') && process.platform !== 'darwin') {
            console.warn(`! ${name}: se omite (hay que prepararlo desde macOS)`);
            continue;
        }
        await prepare(name);
    }

    PLACEHOLDERS.forEach(name => {
        const dir = path.join(OUT_DIR, name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'LEEME.txt'), 'pg_restore no se incluye en esta plataforma: instala las herramientas de cliente de PostgreSQL.\n');
    });
})().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
});
