const mssql = require('mssql');
const BaseDriver = require('./BaseDriver');

/**
 * SQL Server Database Driver
 */
class MssqlDriver extends BaseDriver {
    constructor(options) {
        super(options);
        this.poolPromise = null;
    }

    async connect() {
        if (!this.poolPromise) {
            const config = {
                user: this.options.user,
                password: this.options.password,
                server: this.options.host,
                database: this.options.database,
                port: parseInt(this.options.port) || 1433,
                options: {
                    encrypt: true, // For Azure
                    trustServerCertificate: true // For local development
                },
                pool: {
                    max: 10,
                    min: 0,
                    idleTimeoutMillis: 30000
                }
            };
            // A dedicated pool per driver: mssql.connect() would share one global pool between connections
            this.poolPromise = new mssql.ConnectionPool(config).connect().catch(err => {
                this.poolPromise = null;
                throw err;
            });
        }
        return this.poolPromise;
    }

    async close() {
        if (!this.poolPromise) return;
        const pool = await this.poolPromise.catch(() => null);
        this.poolPromise = null;
        if (pool) await pool.close();
    }

    async testConnection() {
        try {
            const pool = await this.connect();
            await pool.request().query('SELECT 1');
            return true;
        } catch (err) {
            console.error('[MssqlDriver] Test Connection Error:', err.message);
            throw err;
        }
    }

    async query(sql, params = []) {
        try {
            const pool = await this.connect();
            const request = pool.request();

            // Map ? placeholders to @p1, @p2... for mssql
            let mssqlSql = sql;
            if (params && params.length > 0) {
                params.forEach((param, i) => {
                    const paramName = `p${i + 1}`;
                    request.input(paramName, param);
                    // This is a simple replacement, might need regex if ? is in strings
                    // But for our app's controlled SQL it should be fine.
                    mssqlSql = mssqlSql.replace('?', `@${paramName}`);
                });
            }

            const result = await request.query(mssqlSql);
            return result.recordset;
        } catch (err) {
            console.error('[MssqlDriver] Query Error:', err.message);
            throw err;
        }
    }

    getDialect() {
        return {
            explorer: {
                userTables: `SELECT name as NAME FROM sys.tables WHERE is_ms_shipped = 0 ORDER BY 1`,
                systemTables: `SELECT name as NAME FROM sys.tables WHERE is_ms_shipped = 1 ORDER BY 1`,
                views: `SELECT name as NAME FROM sys.views ORDER BY 1`,
                procedures: `SELECT name as NAME FROM sys.procedures ORDER BY 1`,
                triggers: `SELECT name as NAME FROM sys.triggers ORDER BY 1`,
                generators: `SELECT name as NAME FROM sys.sequences ORDER BY 1`,
                reports: `SELECT name FROM (VALUES ('sys.dm_exec_sessions'), ('sys.dm_exec_requests'), ('sys.dm_os_performance_counters')) as t(name)`
            },
            structure: `
                SELECT 
                    c.name AS FIELD_NAME,
                    t.name AS FIELD_TYPE,
                    c.max_length AS FIELD_LENGTH,
                    c.is_nullable AS IS_NULLABLE,
                    ISNULL((SELECT 1 FROM sys.index_columns ic 
                            JOIN sys.indices i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                            WHERE ic.object_id = c.object_id AND ic.column_id = c.column_id AND i.is_primary_key = 1), 0) AS IS_PK
                FROM sys.columns c
                JOIN sys.types t ON c.user_type_id = t.user_type_id
                WHERE c.object_id = OBJECT_ID(?)
                ORDER BY c.column_id
            `,
            metadata: {
                indexes: `
                    SELECT 
                        i.name AS INDEX_NAME,
                        c.name AS FIELD_NAME,
                        i.is_unique AS IS_UNIQUE
                    FROM sys.indexes i
                    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                    WHERE i.object_id = OBJECT_ID(?)
                `,
                foreignKeys: `
                    SELECT 
                        fk.name AS CONSTRAINT_NAME,
                        parent_col.name AS FIELD_NAME,
                        ref_table.name AS REF_TABLE,
                        ref_col.name AS REF_FIELD
                    FROM sys.foreign_keys AS fk
                    INNER JOIN sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
                    INNER JOIN sys.tables AS parent_table ON fkc.parent_object_id = parent_table.object_id
                    INNER JOIN sys.columns AS parent_col ON fkc.parent_object_id = parent_col.object_id AND fkc.parent_column_id = parent_col.column_id
                    INNER JOIN sys.tables AS ref_table ON fkc.referenced_object_id = ref_table.object_id
                    INNER JOIN sys.columns AS ref_col ON fkc.referenced_object_id = ref_col.object_id AND fkc.referenced_column_id = ref_col.column_id
                    WHERE parent_table.name = ?
                `,
                dependencies: `SELECT NULL as dummy WHERE 1=0`
            },
            sourceCode: {
                procedure: `SELECT OBJECT_DEFINITION(OBJECT_ID(?)) as SOURCE`,
                trigger: `SELECT OBJECT_DEFINITION(OBJECT_ID(?)) as SOURCE`,
                view: `SELECT OBJECT_DEFINITION(OBJECT_ID(?)) as SOURCE`
            },
            pagination: (tableName, limit, offset, orderBy) => {
                return `SELECT * FROM ${tableName} ORDER BY ${orderBy || '(SELECT NULL)'} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
            }
        };
    }
}

module.exports = MssqlDriver;
