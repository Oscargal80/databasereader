const mysql = require('mysql2/promise');
const BaseDriver = require('./BaseDriver');
const { quoteIdentifier } = require('../config/sqlHelpers');

const MAX_BIND_PARAMS = 60000;

const isReadQuery = (sql) => /^\s*(select|with|show|describe|desc|explain|table|values)\b/i
    .test(String(sql).replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, ''));

const MYSQL_ESCAPES = { '\0': '\\0', '\n': '\\n', '\r': '\\r', '\x1a': '\\Z' };
const mysqlLiteral = (value) =>
    `'${String(value).replace(/[\0\n\r\\'"\x1a]/g, ch => MYSQL_ESCAPES[ch] || `\\${ch}`)}'`;

class MysqlDriver extends BaseDriver {
    constructor(options) {
        super(options);
        this.pool = null;
    }

    async connect() {
        if (!this.pool) {
            this.pool = mysql.createPool({
                host: this.options.host,
                port: this.options.port || 3306,
                database: this.options.database,
                user: this.options.user,
                password: this.options.password,
                dateStrings: true,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
        }
        return this.pool;
    }

    async close() {
        if (this.pool) await this.pool.end();
    }

    /**
     * Return at most `limit` rows: the result is streamed and the connection is dropped as soon as
     * one row beyond the limit arrives, so a huge SELECT never fills the memory.
     */
    async queryLimited(sql, params, limit) {
        if (!isReadQuery(sql)) {
            const rows = await this.query(sql, params);
            return Array.isArray(rows)
                ? { rows: rows.slice(0, limit), truncated: rows.length > limit }
                : { rows, truncated: false };
        }

        const pool = await this.connect();
        const connection = await pool.getConnection();
        const rows = [];
        let truncated = false;

        try {
            await new Promise((resolve, reject) => {
                const stream = connection.connection.query(sql, params).stream();
                stream.on('data', (row) => {
                    if (rows.length >= limit) {
                        truncated = true;
                        stream.destroy();
                        resolve();
                    } else {
                        rows.push(row);
                    }
                });
                stream.on('end', resolve);
                stream.on('close', resolve);
                stream.on('error', reject);
            });
        } catch (err) {
            connection.destroy();
            throw err;
        }

        // A connection cut in the middle of a result cannot go back to the pool
        if (truncated) connection.destroy(); else connection.release();
        return { rows, truncated };
    }

    async query(sql, params = []) {
        const pool = await this.connect();
        try {
            // mysql2 uses ? as placeholders, same as our internal standard
            const [rows, fields] = await pool.execute(sql, params);
            return rows;
        } catch (err) {
            console.error('[MysqlDriver] Query Error:', err.message);
            throw err;
        }
    }

    async testConnection() {
        const pool = await this.connect();
        try {
            const connection = await pool.getConnection();
            connection.release();
            return true;
        } catch (err) {
            throw new Error(`MySQL Connection failed: ${err.message}`);
        }
    }

    getDialect() {
        return {
            explorer: {
                userTables: `SELECT table_name as NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`,
                systemTables: `SELECT table_name as NAME FROM information_schema.tables WHERE table_schema = 'information_schema' OR table_schema = 'mysql'`,
                views: `SELECT table_name as NAME FROM information_schema.views WHERE table_schema = DATABASE()`,
                procedures: `SELECT routine_name as NAME FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'PROCEDURE'`,
                triggers: `SELECT trigger_name as NAME FROM information_schema.triggers WHERE trigger_schema = DATABASE()`,
                generators: `SELECT table_name as NAME FROM information_schema.tables WHERE 1=0` // MySQL doesn't have sequences/generators in same way
            },
            structure: `
                SELECT 
                    column_name AS FIELD_NAME, 
                    data_type AS FIELD_TYPE, 
                    character_maximum_length AS FIELD_LENGTH,
                    is_nullable AS IS_NULLABLE,
                    column_key AS COLUMN_KEY,
                    extra AS EXTRA
                FROM information_schema.columns 
                WHERE table_schema = DATABASE() AND table_name = ?
                ORDER BY ordinal_position
            `,
            metadata: {
                indexes: `
                    SELECT index_name AS INDEX_NAME, column_name AS FIELD_NAME, IF(non_unique = 0, 1, 0) AS IS_UNIQUE
                    FROM information_schema.statistics
                    WHERE table_schema = DATABASE() AND table_name = ?
                    ORDER BY index_name, seq_in_index
                `,
                foreignKeys: `
                    SELECT 
                        column_name as FIELD_NAME,
                        referenced_table_name as REF_TABLE,
                        referenced_column_name as REF_FIELD,
                        constraint_name as CONSTRAINT_NAME
                    FROM information_schema.key_column_usage
                    WHERE table_schema = DATABASE() AND table_name = ? AND referenced_table_name IS NOT NULL
                `,
                dependencies: `SELECT NULL AS dummy FROM DUAL WHERE 1=0 AND ? IS NOT NULL`
            },
            sourceCode: {
                procedure: `SELECT routine_definition AS SOURCE FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = ?`,
                trigger: `SELECT action_statement AS SOURCE FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND trigger_name = ?`,
                view: `SELECT view_definition AS SOURCE FROM information_schema.views WHERE table_schema = DATABASE() AND table_name = ?`
            },
            // Accounts are managed for host '%'. MySQL does not accept placeholders for account names,
            // so values are escaped as string literals.
            users: {
                list: `SELECT DISTINCT user AS username FROM mysql.user WHERE user <> '' ORDER BY 1`,
                create: (username, password) => `CREATE USER ${mysqlLiteral(username)}@'%' IDENTIFIED BY ${mysqlLiteral(password)}`,
                update: (username, password) => `ALTER USER ${mysqlLiteral(username)}@'%' IDENTIFIED BY ${mysqlLiteral(password)}`,
                delete: (username) => `DROP USER ${mysqlLiteral(username)}@'%'`
            },
            pagination: (tableName, limit, offset, orderBy) => {
                return `SELECT * FROM ${tableName}${orderBy ? ` ORDER BY ${orderBy}` : ''} LIMIT ${limit} OFFSET ${offset}`;
            }
        };
    }

    /**
     * Insert rows in one transaction, in multi-row chunks that respect the placeholder limit.
     * With a pkColumn it becomes an upsert on that column.
     */
    async insertRows(tableName, columns, rows, pkColumn) {
        if (pkColumn && !columns.includes(pkColumn)) {
            throw new Error(`La columna clave "${pkColumn}" no está mapeada`);
        }

        const quote = (name) => quoteIdentifier(name, 'mysql');
        const updatable = pkColumn ? columns.filter(c => c !== pkColumn) : [];
        const onDuplicate = pkColumn
            ? ` ON DUPLICATE KEY UPDATE ${(updatable.length ? updatable : [pkColumn]).map(c => `${quote(c)} = VALUES(${quote(c)})`).join(', ')}`
            : '';
        const rowPlaceholders = `(${columns.map(() => '?').join(', ')})`;
        const chunkSize = Math.max(1, Math.floor(MAX_BIND_PARAMS / columns.length));

        const pool = await this.connect();
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);
                const values = chunk.flatMap(row => columns.map(col => row[col] ?? null));
                const sql = `INSERT INTO ${quote(tableName)} (${columns.map(quote).join(', ')}) VALUES ${chunk.map(() => rowPlaceholders).join(', ')}${onDuplicate}`;
                await connection.execute(sql, values);
            }
            await connection.commit();
            return { rowCount: rows.length };
        } catch (err) {
            await connection.rollback().catch(() => { });
            throw err;
        } finally {
            connection.release();
        }
    }

    bulkInsert(tableName, columns, rows, callback) {
        this.insertRows(tableName, columns, rows).then(result => callback(null, result), callback);
    }

    bulkUpsert(tableName, columns, rows, pkColumn, callback) {
        this.insertRows(tableName, columns, rows, pkColumn).then(result => callback(null, result), callback);
    }
}

module.exports = MysqlDriver;
