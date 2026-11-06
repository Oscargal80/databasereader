const { Pool, types } = require('pg');
const Cursor = require('pg-cursor');
const BaseDriver = require('./BaseDriver');
const { quoteIdentifier, quoteLiteral } = require('../config/sqlHelpers');

// Return date/time columns exactly as stored instead of JS Dates (which shift with the server timezone)
[1082, 1114, 1184].forEach(oid => types.setTypeParser(oid, value => value)); // date, timestamp, timestamptz

const MAX_BIND_PARAMS = 60000;

// Statement text without comments or the trailing semicolon
const statementBody = (sql) => String(sql)
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
    .replace(/;\s*$/, '');

// Plain reads can be consumed through a cursor; scripts with several statements and DML keep the simple protocol
const isSingleReadQuery = (sql) => {
    const body = statementBody(sql);
    return /^(select|with|table|values|show|explain)\b/i.test(body) && !body.includes(';');
};

// PostgreSQL Pool Cache
const pgPools = new Map();

const pgPoolKey = (options) =>
    `${options.host}:${options.port}:${options.database}:${options.user}:${BaseDriver.credentialFingerprint(options)}`;

const getPgPool = (options) => {
    const key = pgPoolKey(options);
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

    async close() {
        pgPools.delete(pgPoolKey(this.options));
        await this.pool.end();
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

        // A script with several statements returns one Result per statement: report the last one
        const last = Array.isArray(res) ? res[res.length - 1] : res;
        if (!last) return [];

        const rows = last.rows || [];
        rows.command = last.command;
        rows.rowCount = last.rowCount;
        return rows;
    }

    /**
     * Return at most `limit` rows without pulling the whole result into memory:
     * a cursor reads limit + 1 rows (the extra one tells whether there were more) and is closed.
     */
    async queryLimited(sql, params, limit) {
        if (!isSingleReadQuery(sql)) {
            const rows = await this.query(sql, params);
            return { rows: rows.slice(0, limit), truncated: rows.length > limit, command: rows.command, rowCount: rows.rowCount };
        }

        let pgSql = String(sql).trim().replace(/;\s*$/, '');
        if (params && params.length > 0) {
            let index = 1;
            pgSql = pgSql.replace(/\?/g, () => `$${index++}`);
        }

        const client = await this.pool.connect();
        try {
            const cursor = client.query(new Cursor(pgSql, params && params.length > 0 ? params : undefined));
            const rows = await cursor.read(limit + 1);
            await cursor.close();
            return {
                rows: rows.slice(0, limit),
                truncated: rows.length > limit,
                command: /^\w+/.exec(statementBody(sql))[0].toUpperCase(),
                rowCount: Math.min(rows.length, limit)
            };
        } finally {
            client.release();
        }
    }

    /**
     * Insert rows in one transaction, in multi-row chunks that respect the bind-parameter limit.
     * With a pkColumn it becomes an upsert on that column.
     */
    async insertRows(tableName, columns, rows, pkColumn) {
        if (pkColumn && !columns.includes(pkColumn)) {
            throw new Error(`La columna clave "${pkColumn}" no está mapeada`);
        }

        const table = quoteIdentifier(tableName, 'postgres');
        const columnList = columns.map(c => quoteIdentifier(c, 'postgres')).join(', ');
        const updatable = pkColumn ? columns.filter(c => c !== pkColumn) : [];
        const conflict = pkColumn
            ? ` ON CONFLICT (${quoteIdentifier(pkColumn, 'postgres')}) ` + (updatable.length
                ? `DO UPDATE SET ${updatable.map(c => `${quoteIdentifier(c, 'postgres')} = EXCLUDED.${quoteIdentifier(c, 'postgres')}`).join(', ')}`
                : 'DO NOTHING')
            : '';
        const chunkSize = Math.max(1, Math.floor(MAX_BIND_PARAMS / columns.length));

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            for (let i = 0; i < rows.length; i += chunkSize) {
                const values = [];
                const tuples = rows.slice(i, i + chunkSize).map(row =>
                    `(${columns.map(col => { values.push(row[col] ?? null); return `$${values.length}`; }).join(', ')})`
                );
                await client.query(`INSERT INTO ${table} (${columnList}) VALUES ${tuples.join(', ')}${conflict}`, values);
            }
            await client.query('COMMIT');
            return { rowCount: rows.length };
        } catch (err) {
            await client.query('ROLLBACK').catch(() => { });
            throw err;
        } finally {
            client.release();
        }
    }

    bulkInsert(tableName, columns, rows, callback) {
        this.insertRows(tableName, columns, rows).then(result => callback(null, result), callback);
    }

    bulkUpsert(tableName, columns, rows, pkColumn, callback) {
        this.insertRows(tableName, columns, rows, pkColumn).then(result => callback(null, result), callback);
    }

    /**
     * Move the column's sequence past the largest imported value (no-op when the column has no sequence).
     */
    syncGenerators(tableName, pkColumn, callback) {
        const table = quoteIdentifier(tableName, 'postgres');
        const column = quoteIdentifier(pkColumn, 'postgres');

        this.query('SELECT pg_get_serial_sequence(?, ?) AS seq', [table, pkColumn])
            .then(rows => {
                if (!rows[0] || !rows[0].seq) return null;
                return this.query(`SELECT setval(?::regclass, COALESCE((SELECT MAX(${column}) FROM ${table}), 1))`, [rows[0].seq]);
            })
            .then(() => callback(null), callback);
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
                procedures: "SELECT DISTINCT p.proname AS name FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prokind IN ('f', 'p') AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') ORDER BY 1",
                triggers: "SELECT DISTINCT tgname AS name FROM pg_catalog.pg_trigger WHERE NOT tgisinternal ORDER BY 1",
                generators: "SELECT sequence_name as name FROM information_schema.sequences WHERE sequence_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY 1",
                reports: "SELECT initial as name FROM (VALUES ('pg_stat_activity'), ('pg_stat_database'), ('pg_stat_user_tables'), ('pg_stat_user_indexes'), ('pg_locks')) AS t(initial) ORDER BY 1"
            },
            metadata: {
                indexes: `
                    SELECT i.relname AS "INDEX_NAME", a.attname AS "FIELD_NAME",
                           CASE WHEN ix.indisunique THEN 1 ELSE 0 END AS "IS_UNIQUE"
                    FROM pg_catalog.pg_class t
                    JOIN pg_catalog.pg_index ix ON ix.indrelid = t.oid
                    JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
                    JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
                    JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
                    WHERE t.relname = ? AND t.relkind IN ('r', 'p') AND pg_catalog.pg_table_is_visible(t.oid)
                    ORDER BY i.relname, k.ord
                `,
                foreignKeys: `
                    SELECT c.conname AS "CONSTRAINT_NAME", a.attname AS "FIELD_NAME",
                           rt.relname AS "REF_TABLE", ra.attname AS "REF_FIELD"
                    FROM pg_catalog.pg_constraint c
                    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
                    JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY AS k(attnum, refattnum, ord) ON true
                    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
                    JOIN pg_catalog.pg_class rt ON rt.oid = c.confrelid
                    JOIN pg_catalog.pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = k.refattnum
                    WHERE c.contype = 'f' AND t.relname = ? AND pg_catalog.pg_table_is_visible(t.oid)
                    ORDER BY c.conname, k.ord
                `,
                dependencies: `
                    WITH target(name) AS (SELECT ?::text)
                    SELECT DISTINCT v.relname AS "DEP_NAME", 'View' AS "DEP_TYPE"
                    FROM target
                    JOIN pg_catalog.pg_class t ON t.relname = target.name AND pg_catalog.pg_table_is_visible(t.oid)
                    JOIN pg_catalog.pg_depend d ON d.refobjid = t.oid AND d.refclassid = 'pg_catalog.pg_class'::regclass
                         AND d.classid = 'pg_catalog.pg_rewrite'::regclass
                    JOIN pg_catalog.pg_rewrite r ON r.oid = d.objid
                    JOIN pg_catalog.pg_class v ON v.oid = r.ev_class AND v.oid <> t.oid
                    UNION
                    SELECT DISTINCT ct.relname, 'Table (FK)'
                    FROM target
                    JOIN pg_catalog.pg_class t ON t.relname = target.name AND pg_catalog.pg_table_is_visible(t.oid)
                    JOIN pg_catalog.pg_constraint c ON c.confrelid = t.oid AND c.contype = 'f'
                    JOIN pg_catalog.pg_class ct ON ct.oid = c.conrelid AND ct.oid <> t.oid
                    ORDER BY 1
                `
            },
            sourceCode: {
                procedure: "SELECT pg_get_functiondef(p.oid) AS source FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = ? AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prokind IN ('f', 'p')",
                trigger: "SELECT pg_get_triggerdef(t.oid) AS source FROM pg_catalog.pg_trigger t WHERE NOT t.tgisinternal AND t.tgname = ?",
                view: "SELECT view_definition as SOURCE FROM information_schema.views WHERE table_name = ?"
            },
            users: {
                list: "SELECT usename as username FROM pg_catalog.pg_user ORDER BY 1",
                create: (username, password) => `CREATE USER ${quoteIdentifier(username, 'postgres')} WITH PASSWORD ${quoteLiteral(password)}`,
                update: (username, password) => `ALTER USER ${quoteIdentifier(username, 'postgres')} WITH PASSWORD ${quoteLiteral(password)}`,
                delete: (username) => `DROP USER ${quoteIdentifier(username, 'postgres')}`
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
            pagination: (tableName, limit, offset, orderBy) => `SELECT * FROM ${tableName}${orderBy ? ` ORDER BY ${orderBy}` : ''} LIMIT ${limit} OFFSET ${offset}`
        };
    }
}

module.exports = PostgresDriver;
