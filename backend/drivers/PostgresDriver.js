const { Pool } = require('pg');
const BaseDriver = require('./BaseDriver');

// PostgreSQL Pool Cache
const pgPools = new Map();

const getPgPool = (options) => {
    const key = `${options.host}:${options.port}:${options.database}:${options.user}`;
    if (!pgPools.has(key)) {
        pgPools.set(key, new Pool({
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.user,
            password: options.password,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        }));
    }
    return pgPools.get(key);
};

/**
 * PostgreSQL Database Driver
 */
class PostgresDriver extends BaseDriver {
    constructor(options) {
        super(options);
        this.pool = getPgPool(options);
    }

    async testConnection() {
        const client = await this.pool.connect();
        try {
            await client.query('SELECT 1');
            return true;
        } finally {
            client.release();
        }
    }

    async query(sql, params) {
        let pgSql = sql;
        if (params && params.length > 0) {
            let index = 1;
            pgSql = sql.replace(/\?/g, () => `$${index++}`);
        }
        const res = await this.pool.query(pgSql, params);
        return res.rows;
    }

    async getMetadata() {
        const metadataSql = `
            SELECT 
                table_name as TABLE_NAME,
                column_name as FIELD_NAME,
                data_type as FIELD_TYPE
            FROM information_schema.columns 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_name, ordinal_position
        `;
        const rows = await this.query(metadataSql, []);

        const tables = {};
        rows.forEach(row => {
            const tName = row.table_name || row.TABLE_NAME;
            const fName = row.field_name || row.FIELD_NAME;
            if (!tables[tName]) tables[tName] = [];
            tables[tName].push(fName);
        });

        const procSql = `SELECT routine_name as name FROM information_schema.routines WHERE routine_type = 'PROCEDURE' AND routine_schema NOT IN ('pg_catalog', 'information_schema')`;
        const procs = await this.query(procSql, []);

        return {
            tables,
            procedures: procs.map(p => p.name)
        };
    }

    getDialect() {
        return {
            explorer: {
                userTables: "SELECT tablename as name FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema' ORDER BY 1",
                systemTables: "SELECT tablename as name FROM pg_catalog.pg_tables WHERE schemaname = 'pg_catalog' OR schemaname = 'information_schema' ORDER BY 1",
                views: "SELECT viewname as name FROM pg_catalog.pg_views WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema' ORDER BY 1",
                materializedViews: "SELECT matviewname as name FROM pg_catalog.pg_matviews ORDER BY 1",
                procedures: "SELECT routine_name as name FROM information_schema.routines WHERE routine_type = 'PROCEDURE' AND routine_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY 1",
                triggers: "SELECT trigger_name as name FROM information_schema.triggers ORDER BY 1",
                generators: "SELECT sequence_name as name FROM information_schema.sequences WHERE sequence_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY 1",
                reports: "SELECT initial as name FROM (VALUES ('pg_stat_activity'), ('pg_stat_database'), ('pg_stat_user_tables'), ('pg_stat_user_indexes'), ('pg_locks')) AS t(initial) ORDER BY 1"
            },
            metadata: {
                indexes: `
                    SELECT indexname as index_name, indexdef as definition, 'YES' as is_unique
                    FROM pg_indexes WHERE tablename = ?
                `,
                foreignKeys: `
                    SELECT 
                        kcu.table_name as from_table,
                        kcu.column_name as column_name,
                        ccu.table_name AS ref_table,
                        ccu.column_name AS ref_field,
                        kcu.constraint_name as constraint_name
                    FROM information_schema.key_column_usage kcu
                    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
                    JOIN information_schema.constraint_column_usage ccu ON kcu.constraint_name = ccu.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY' AND kcu.table_name = ?
                `,
                dependencies: `
                    SELECT 'No disponible' as dep_name, 'N/A' as dep_type WHERE 1=0
                `
            },
            sourceCode: {
                procedure: "SELECT routine_definition as SOURCE FROM information_schema.routines WHERE routine_name = ?",
                trigger: "SELECT action_statement as SOURCE FROM information_schema.triggers WHERE trigger_name = ?",
                view: "SELECT view_definition as SOURCE FROM information_schema.views WHERE table_name = ?"
            },
            users: {
                list: "SELECT usename as username FROM pg_catalog.pg_user ORDER BY 1",
                create: (username, password) => `CREATE USER ${username} WITH PASSWORD '${password}'`,
                update: (username, password) => `ALTER USER ${username} WITH PASSWORD '${password}'`,
                delete: (username) => `DROP USER ${username}`
            },
            structure: `
                SELECT 
                    column_name as field_name,
                    data_type as field_type,
                    character_maximum_length as field_length,
                    is_nullable,
                    (SELECT 1 FROM information_schema.key_column_usage kcu
                     JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
                     WHERE kcu.table_name = ? AND tc.constraint_type = 'PRIMARY KEY' AND kcu.column_name = cols.column_name) as is_pk
                FROM information_schema.columns cols
                WHERE table_name = ?
                ORDER BY ordinal_position
            `,
            explain: (query) => `EXPLAIN (FORMAT JSON) ${query}`,
            pagination: (tableName, limit, offset) => `SELECT * FROM ${tableName} LIMIT ${limit} OFFSET ${offset}`
        };
    }
}

module.exports = PostgresDriver;
