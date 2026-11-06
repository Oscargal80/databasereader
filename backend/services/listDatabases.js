const { Client } = require('pg');
const mysql = require('mysql2/promise');
const mssql = require('mssql');

const CONNECT_TIMEOUT_MS = 5000;
const MYSQL_SYSTEM_DATABASES = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);
const PG_UNDEFINED_DATABASE = '3D000';

const listPostgres = async ({ host, port, user, password, database }) => {
    // Any database can read pg_database; try the one typed in first, then the usual maintenance ones
    const candidates = [...new Set([database, 'postgres', 'template1'].filter(Boolean))];
    let lastError;

    for (const candidate of candidates) {
        const client = new Client({ host, port, user, password, database: candidate, connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
        try {
            await client.connect();
            const result = await client.query('SELECT datname FROM pg_database WHERE NOT datistemplate AND datallowconn ORDER BY datname');
            return result.rows.map(row => row.datname);
        } catch (err) {
            // Only a missing database is worth retrying elsewhere; bad credentials would just repeat
            if (err.code !== PG_UNDEFINED_DATABASE) throw err;
            lastError = err;
        } finally {
            await client.end().catch(() => { });
        }
    }
    throw lastError;
};

const listMysql = async ({ host, port, user, password }) => {
    const connection = await mysql.createConnection({ host, port, user, password, connectTimeout: CONNECT_TIMEOUT_MS });
    try {
        const [rows] = await connection.query('SHOW DATABASES');
        return rows.map(row => row.Database).filter(name => !MYSQL_SYSTEM_DATABASES.has(name)).sort();
    } finally {
        await connection.end().catch(() => { });
    }
};

const listMssql = async ({ host, port, user, password }) => {
    const pool = new mssql.ConnectionPool({
        user,
        password,
        server: host,
        database: 'master',
        port,
        connectionTimeout: CONNECT_TIMEOUT_MS,
        options: { encrypt: true, trustServerCertificate: true }
    });
    try {
        await pool.connect();
        const result = await pool.request().query('SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0 ORDER BY name');
        return result.recordset.map(row => row.name);
    } finally {
        await pool.close().catch(() => { });
    }
};

const LISTERS = { postgres: listPostgres, mysql: listMysql, mssql: listMssql };

/**
 * Names of the databases a login can see on a server. Uses a short-lived connection
 * (nothing is cached or stored). Firebird has no such catalog: it connects to a file path.
 */
const listDatabases = (options) => {
    const lister = LISTERS[options.dbType];
    if (!lister) throw new Error(`Listar bases no está disponible para ${options.dbType}`);
    return lister(options);
};

module.exports = { listDatabases };
