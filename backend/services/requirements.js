const net = require('net');
const { findPgRestore } = require('./pgRestore');

const PROBE_TIMEOUT_MS = 600;

// What each engine usually asks for when it is installed, and where to get it
const ENGINES = [
    {
        id: 'firebird',
        label: 'Firebird',
        port: 3050,
        defaultUser: 'SYSDBA',
        userHint: 'La contraseña de SYSDBA se define al instalar (el instalador la pide; en instalaciones antiguas era masterkey). La "ruta" de la base es la del archivo .fdb en el servidor.',
        downloads: [{ label: 'Descargas de Firebird', url: 'https://firebirdsql.org/en/downloads/', platforms: ['win32', 'darwin', 'linux'] }]
    },
    {
        id: 'postgres',
        label: 'PostgreSQL',
        port: 5432,
        defaultUser: 'postgres',
        userHint: 'La contraseña del usuario postgres se elige al instalar. En la pantalla de conexión, "Buscar bases" lista las bases del servidor.',
        downloads: [
            { label: 'PostgreSQL para Windows', url: 'https://www.postgresql.org/download/windows/', platforms: ['win32'] },
            { label: 'Postgres.app para Mac', url: 'https://postgresapp.com/', platforms: ['darwin'] },
            { label: 'PostgreSQL para Linux', url: 'https://www.postgresql.org/download/linux/', platforms: ['linux'] }
        ]
    },
    {
        id: 'mysql',
        label: 'MySQL / MariaDB',
        port: 3306,
        defaultUser: 'root',
        userHint: 'La contraseña de root se elige al instalar (MariaDB puede instalarse sin contraseña). "Buscar bases" lista las bases del servidor.',
        downloads: [
            { label: 'Descargas de MySQL', url: 'https://dev.mysql.com/downloads/mysql/', platforms: ['win32', 'darwin', 'linux'] },
            { label: 'Descargas de MariaDB', url: 'https://mariadb.org/download/', platforms: ['win32', 'darwin', 'linux'] }
        ]
    },
    {
        id: 'mssql',
        label: 'SQL Server',
        port: 1433,
        defaultUser: 'sa',
        userHint: 'Hay que instalarlo con autenticación mixta y definir la contraseña de sa. Las ediciones Express son gratuitas.',
        downloads: [{ label: 'Descargas de SQL Server', url: 'https://www.microsoft.com/sql-server/sql-server-downloads', platforms: ['win32', 'darwin', 'linux'] }]
    }
];

const probe = (host, port) => new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (result) => { socket.destroy(); resolve(result); };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
});

const isListening = async (port) => (await probe('127.0.0.1', port)) || (await probe('::1', port));

/**
 * Which database servers answer on this machine and whether pg_restore is available.
 * Ports are only probed in the desktop app, where "this machine" is the user's machine.
 */
const inspectSystem = async () => {
    const desktop = Boolean(process.env.USER_DATA_PATH);
    const pgRestore = findPgRestore();

    const engines = await Promise.all(ENGINES.map(async (engine) => ({
        ...engine,
        listening: desktop ? await isListening(engine.port) : null
    })));

    return {
        desktop,
        platform: process.platform,
        arch: process.arch,
        engines,
        tools: [{
            id: 'pg_restore',
            label: 'pg_restore (importar dumps de PostgreSQL)',
            found: Boolean(pgRestore),
            version: pgRestore ? pgRestore.version : null,
            major: pgRestore ? pgRestore.major : null,
            bundled: pgRestore ? pgRestore.bundled : false,
            path: pgRestore && !pgRestore.bundled ? pgRestore.path : null
        }]
    };
};

module.exports = { inspectSystem };
