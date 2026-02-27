const mysql = require('mysql2/promise');
const BaseDriver = require('./BaseDriver');

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
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
        }
        return this.pool;
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
                indexes: `SHOW INDEX FROM ??`, // Note: ?? is for identifiers in mysql2
                foreignKeys: `
                    SELECT 
                        column_name as FIELD_NAME,
                        referenced_table_name as REF_TABLE,
                        referenced_column_name as REF_FIELD,
                        constraint_name as CONSTRAINT_NAME
                    FROM information_schema.key_column_usage
                    WHERE table_schema = DATABASE() AND table_name = ? AND referenced_table_name IS NOT NULL
                `,
                dependencies: `SELECT NULL as dummy WHERE 1=0`
            },
            sourceCode: {
                procedure: `SHOW CREATE PROCEDURE ??`,
                trigger: `SHOW CREATE TRIGGER ??`,
                view: `SHOW CREATE VIEW ??`
            },
            userManagement: {
                listUsers: `SELECT user FROM mysql.user`,
                listRoles: `SELECT host FROM mysql.user LIMIT 0` // MySQL 8.0 has roles but let's keep it simple
            },
            pagination: (tableName, limit, offset) => {
                return `SELECT * FROM ${tableName} LIMIT ${limit} OFFSET ${offset}`;
            }
        };
    }

    // MySQL specific bulkInsert
    async bulkInsert(tableName, columns, rows, callback) {
        try {
            const pool = await this.connect();
            const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
            const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`;
            const flatValues = rows.reduce((acc, row) => acc.concat(columns.map(col => row[col])), []);

            const [result] = await pool.execute(sql, flatValues);
            callback(null, { rowCount: result.affectedRows });
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = MysqlDriver;
