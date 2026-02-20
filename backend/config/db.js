const Firebird = require('node-firebird');
const { Pool } = require('pg');

/**
 * Agnostic execute query function
 */
const executeQuery = (options, sql, params, callback) => {
    const dbType = options.dbType || 'firebird';

    if (dbType === 'firebird') {
        const firebirdOptions = {
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.user,
            password: options.password,
            lowercase_keys: options.lowercase_keys
        };

        Firebird.attach(firebirdOptions, (err, db) => {
            if (err) return callback(err);
            db.query(sql, params, (err, result) => {
                db.detach();
                callback(err, result);
            });
        });
    } else if (dbType === 'postgres') {
        // Only pass recognized options to PG Pool
        const pgOptions = {
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.user,
            password: options.password,
        };

        // Convert ? placeholders to $1, $2, etc.
        let pgSql = sql;
        if (params && params.length > 0) {
            let index = 1;
            pgSql = sql.replace(/\?/g, () => `$${index++}`);
        }

        const pool = new Pool(pgOptions);
        pool.query(pgSql, params, (err, res) => {
            pool.end();
            if (err) return callback(err);
            callback(null, res.rows);
        });
    }
};

/**
 * Agnostic test connection function
 */
const testConnection = (options) => {
    const dbType = options.dbType || 'firebird';

    return new Promise((resolve, reject) => {
        if (dbType === 'firebird') {
            const firebirdOptions = {
                host: options.host,
                port: options.port,
                database: options.database,
                user: options.user,
                password: options.password,
                lowercase_keys: options.lowercase_keys
            };
            Firebird.attach(firebirdOptions, (err, db) => {
                if (err) return reject(err);
                db.detach();
                resolve(true);
            });
        } else if (dbType === 'postgres') {
            const pgOptions = {
                host: options.host,
                port: options.port,
                database: options.database,
                user: options.user,
                password: options.password,
            };
            const pool = new Pool(pgOptions);
            pool.query('SELECT 1', (err, res) => {
                pool.end();
                if (err) return reject(err);
                resolve(true);
            });
        }
    });
};

/**
 * Returns SQL dialect specific queries and syntax
 */
const getSqlDialect = (dbType) => {
    if (dbType === 'postgres') {
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
            users: {
                list: "SELECT usename as username FROM pg_catalog.pg_user ORDER BY 1",
                create: (username, password) => `CREATE USER ${username} WITH PASSWORD '${password}'`,
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
            fullSchema: `
                SELECT 
                    table_name as TABLE_NAME,
                    column_name as FIELD_NAME,
                    data_type as FIELD_TYPE
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
            `,
            pagination: (tableName, limit, offset) => `SELECT * FROM ${tableName} LIMIT ${limit} OFFSET ${offset}`
        };
    }

    // Default Firebird
    return {
        explorer: {
            userTables: 'SELECT RDB$RELATION_NAME as NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_BLR IS NULL ORDER BY 1',
            systemTables: 'SELECT RDB$RELATION_NAME as NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 1 ORDER BY 1',
            views: 'SELECT RDB$RELATION_NAME as NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_BLR IS NOT NULL ORDER BY 1',
            materializedViews: 'SELECT CAST(\'No disponible\' AS VARCHAR(20)) as NAME FROM RDB$DATABASE WHERE 1=0',
            procedures: 'SELECT RDB$PROCEDURE_NAME as NAME FROM RDB$PROCEDURES ORDER BY 1',
            triggers: 'SELECT RDB$TRIGGER_NAME as NAME FROM RDB$TRIGGERS ORDER BY 1',
            generators: 'SELECT RDB$GENERATOR_NAME as NAME FROM RDB$GENERATORS WHERE RDB$SYSTEM_FLAG = 0 ORDER BY 1',
            reports: 'SELECT name FROM (SELECT \'MON$DATABASE\' as name FROM RDB$DATABASE UNION SELECT \'MON$ATTACHMENTS\' FROM RDB$DATABASE UNION SELECT \'MON$STATEMENTS\' FROM RDB$DATABASE UNION SELECT \'MON$TRANSACTIONS\' FROM RDB$DATABASE UNION SELECT \'MON$IO_STATS\' FROM RDB$DATABASE) ORDER BY 1'
        },
        users: {
            list: 'SELECT SEC$USER_NAME AS USERNAME, SEC$FIRST_NAME, SEC$LAST_NAME FROM SEC$USERS',
            create: (username, password) => `CREATE USER ${username} PASSWORD '${password}'`,
            delete: (username) => `DROP USER ${username}`
        },
        structure: `
            SELECT 
                rf.RDB$FIELD_NAME AS FIELD_NAME,
                f.RDB$FIELD_TYPE AS FIELD_TYPE,
                f.RDB$FIELD_SUB_TYPE AS SUB_TYPE,
                f.RDB$FIELD_LENGTH AS FIELD_LENGTH,
                f.RDB$FIELD_PRECISION AS FIELD_PRECISION,
                f.RDB$FIELD_SCALE AS FIELD_SCALE,
                rf.RDB$NULL_FLAG AS NULL_FLAG,
                (SELECT 1 FROM RDB$RELATION_CONSTRAINTS rc 
                 JOIN RDB$INDEX_SEGMENTS iseg ON rc.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
                 WHERE rc.RDB$RELATION_NAME = rf.RDB$RELATION_NAME 
                 AND rc.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY' 
                 AND iseg.RDB$FIELD_NAME = rf.RDB$FIELD_NAME) AS IS_PK,
                (SELECT COUNT(*) FROM RDB$RELATION_CONSTRAINTS rc 
                 JOIN RDB$INDEX_SEGMENTS iseg ON rc.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
                 WHERE rc.RDB$RELATION_NAME = rf.RDB$RELATION_NAME 
                 AND rc.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY' 
                 AND iseg.RDB$FIELD_NAME = rf.RDB$FIELD_NAME) AS IS_FK
            FROM RDB$RELATION_FIELDS rf
            JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
            WHERE rf.RDB$RELATION_NAME = ?
            ORDER BY rf.RDB$FIELD_POSITION
        `,
        fullSchema: `
            SELECT 
                rf.RDB$RELATION_NAME AS TABLE_NAME,
                rf.RDB$FIELD_NAME AS FIELD_NAME,
                f.RDB$FIELD_TYPE AS FIELD_TYPE
            FROM RDB$RELATION_FIELDS rf
            JOIN RDB$RELATIONS r ON rf.RDB$RELATION_NAME = r.RDB$RELATION_NAME
            JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
            WHERE r.RDB$SYSTEM_FLAG = 0 AND r.RDB$VIEW_BLR IS NULL
            ORDER BY rf.RDB$RELATION_NAME, rf.RDB$FIELD_POSITION
        `,
        pagination: (tableName, limit, offset) => `SELECT FIRST ${limit} SKIP ${offset} * FROM ${tableName}`
    };
};

module.exports = {
    executeQuery,
    testConnection,
    getSqlDialect
};
