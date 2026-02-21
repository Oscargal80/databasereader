const Firebird = require('node-firebird');
const { Pool } = require('pg');
const mysql = require('mysql2');
const sqlite3 = require('sqlite3').verbose();

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
        const pgOptions = {
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.user,
            password: options.password,
        };

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
    } else if (dbType === 'mysql') {
        const connection = mysql.createConnection({
            host: options.host,
            port: options.port || 3306,
            database: options.database,
            user: options.user,
            password: options.password
        });

        connection.query(sql, params, (err, results) => {
            connection.end();
            if (err) return callback(err);
            callback(null, results);
        });
    } else if (dbType === 'sqlite') {
        const db = new sqlite3.Database(options.database, (err) => {
            if (err) return callback(err);

            // Convert ? placeholders to match params if needed (sqlite uses ? by default)
            db.all(sql, params || [], (err, rows) => {
                db.close();
                if (err) return callback(err);
                callback(null, rows);
            });
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
            Firebird.attach({
                host: options.host,
                port: options.port,
                database: options.database,
                user: options.user,
                password: options.password
            }, (err, db) => {
                if (err) return reject(err);
                db.detach();
                resolve(true);
            });
        } else if (dbType === 'postgres') {
            const pool = new Pool({
                host: options.host,
                port: options.port,
                database: options.database,
                user: options.user,
                password: options.password,
            });
            pool.query('SELECT 1', (err) => {
                pool.end();
                if (err) return reject(err);
                resolve(true);
            });
        } else if (dbType === 'mysql') {
            const connection = mysql.createConnection({
                host: options.host,
                port: options.port || 3306,
                database: options.database,
                user: options.user,
                password: options.password
            });
            connection.connect((err) => {
                connection.end();
                if (err) return reject(err);
                resolve(true);
            });
        } else if (dbType === 'sqlite') {
            const db = new sqlite3.Database(options.database, (err) => {
                if (err) return reject(err);
                db.close();
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
            metadata: {
                indexes: `
                    SELECT indexname as index_name, indexdef as definition, 'YES' as is_unique
                    FROM pg_indexes WHERE tablename = ?
                `,
                foreignKeys: `
                    SELECT
                        tc.constraint_name, kcu.column_name, 
                        ccu.table_name AS ref_table,
                        ccu.column_name AS ref_field
                    FROM 
                        information_schema.table_constraints AS tc 
                        JOIN information_schema.key_column_usage AS kcu
                          ON tc.constraint_name = kcu.constraint_name
                        JOIN information_schema.constraint_column_usage AS ccu
                          ON ccu.constraint_name = tc.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = ?
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

    if (dbType === 'mysql') {
        return {
            explorer: {
                userTables: "SELECT table_name as name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY 1",
                systemTables: "SELECT table_name as name FROM information_schema.tables WHERE table_schema IN ('information_schema', 'mysql', 'performance_schema', 'sys') ORDER BY 1",
                views: "SELECT table_name as name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'VIEW' ORDER BY 1",
                materializedViews: "SELECT 'No disponible' as name FROM DUAL WHERE 1=0",
                procedures: "SELECT routine_name as name FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'PROCEDURE' ORDER BY 1",
                triggers: "SELECT trigger_name as name FROM information_schema.triggers WHERE trigger_schema = DATABASE() ORDER BY 1",
                generators: "SELECT 'No disponible' as name FROM DUAL WHERE 1=0",
                reports: "SELECT CONCAT(table_name, ' (', ROUND(((data_length + index_length) / 1024 / 1024), 2), ' MB)') as name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY (data_length + index_length) DESC LIMIT 10"
            },
            metadata: {
                indexes: `
                    SELECT index_name as INDEX_NAME, column_name as FIELD_NAME, IF(non_unique = 0, 'YES', 'NO') as IS_UNIQUE
                    FROM information_schema.statistics WHERE table_schema = DATABASE() AND UPPER(table_name) = UPPER(?)
                `,
                foreignKeys: `
                    SELECT 
                        constraint_name as CONSTRAINT_NAME, column_name as FIELD_NAME, 
                        referenced_table_name as REF_TABLE, 
                        referenced_column_name as REF_FIELD
                    FROM information_schema.key_column_usage
                    WHERE table_schema = DATABASE() AND UPPER(table_name) = UPPER(?) AND referenced_table_name IS NOT NULL
                `,
                dependencies: "SELECT 'No disponible' as DEP_NAME, 'N/A' as DEP_TYPE FROM DUAL WHERE 1=0"
            },
            sourceCode: {
                procedure: "SELECT routine_definition as SOURCE FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = ?",
                trigger: "SELECT action_statement as SOURCE FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND trigger_name = ?",
                view: "SELECT view_definition as SOURCE FROM information_schema.views WHERE table_schema = DATABASE() AND table_name = ?"
            },
            users: {
                list: "SELECT user as username FROM mysql.user ORDER BY 1",
                create: (username, password) => `CREATE USER '${username}'@'%' IDENTIFIED BY '${password}'`,
                delete: (username) => `DROP USER '${username}'@'%'`
            },
            structure: `
                SELECT 
                    column_name as field_name,
                    data_type as field_type,
                    character_maximum_length as field_length,
                    is_nullable,
                    IF(column_key = 'PRI', 1, 0) as is_pk
                FROM information_schema.columns 
                WHERE table_schema = DATABASE() AND UPPER(table_name) = UPPER(?)
                ORDER BY ordinal_position
            `,
            fullSchema: `
                SELECT 
                    table_name as TABLE_NAME,
                    column_name as FIELD_NAME,
                    data_type as FIELD_TYPE
                FROM information_schema.columns 
                WHERE table_schema = DATABASE()
                ORDER BY table_name, ordinal_position
            `,
            pagination: (tableName, limit, offset) => `SELECT * FROM ${tableName} LIMIT ${limit} OFFSET ${offset}`
        };
    }

    if (dbType === 'sqlite') {
        return {
            explorer: {
                userTables: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY 1",
                systemTables: "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sqlite_%' ORDER BY 1",
                views: "SELECT name FROM sqlite_master WHERE type='view' ORDER BY 1",
                materializedViews: "SELECT 'No disponible' as name WHERE 1=0",
                procedures: "SELECT 'No disponible' as name WHERE 1=0",
                triggers: "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY 1",
                generators: "SELECT 'No disponible' as name WHERE 1=0",
                reports: "SELECT 'No disponible' as name WHERE 1=0"
            },
            metadata: {
                indexes: "SELECT name as index_name, 'N/A' as field_name, 'N/A' as is_unique FROM sqlite_master WHERE type='index' AND tbl_name = ?",
                foreignKeys: "SELECT 'N/A' as constraint_name, 'N/A' as column_name, 'N/A' as ref_table, 'N/A' as ref_field WHERE 1=0",
                dependencies: "SELECT 'N/A' as dep_name, 'N/A' as dep_type WHERE 1=0"
            },
            sourceCode: {
                procedure: "SELECT 'N/A' as SOURCE WHERE 1=0",
                trigger: "SELECT sql as SOURCE FROM sqlite_master WHERE type='trigger' AND name = ?",
                view: "SELECT sql as SOURCE FROM sqlite_master WHERE type='view' AND name = ?"
            },
            users: {
                list: "SELECT 'No disponible' as username WHERE 1=0",
                create: () => "SELECT 'No disponible'",
                delete: () => "SELECT 'No disponible'"
            },
            structure: `
                SELECT 
                    name as field_name,
                    type as field_type,
                    NULL as field_length,
                    IIF("notnull" = 0, 'YES', 'NO') as is_nullable,
                    pk as is_pk
                FROM pragma_table_info(?)
            `,
            fullSchema: `
                SELECT 
                    m.name as TABLE_NAME,
                    p.name as FIELD_NAME,
                    p.type as FIELD_TYPE
                FROM sqlite_master m
                JOIN pragma_table_info(m.name) p
                WHERE m.type = 'table'
                ORDER BY m.name, p.cid
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
        metadata: {
            indexes: `
                SELECT 
                    ix.RDB$INDEX_NAME AS INDEX_NAME,
                    iseg.RDB$FIELD_NAME AS FIELD_NAME,
                    ix.RDB$UNIQUE_FLAG AS IS_UNIQUE
                FROM RDB$INDICES ix
                JOIN RDB$INDEX_SEGMENTS iseg ON ix.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
                WHERE ix.RDB$RELATION_NAME = ? AND ix.RDB$SYSTEM_FLAG = 0
                ORDER BY ix.RDB$INDEX_NAME, iseg.RDB$FIELD_POSITION
            `,
            foreignKeys: `
                SELECT 
                    rc.RDB$CONSTRAINT_NAME AS CONSTRAINT_NAME,
                    iseg.RDB$FIELD_NAME AS FIELD_NAME,
                    rc_ref.RDB$RELATION_NAME AS REF_TABLE,
                    iseg_ref.RDB$FIELD_NAME AS REF_FIELD
                FROM RDB$RELATION_CONSTRAINTS rc
                JOIN RDB$REF_CONSTRAINTS ref ON rc.RDB$CONSTRAINT_NAME = ref.RDB$CONSTRAINT_NAME
                JOIN RDB$INDEX_SEGMENTS iseg ON rc.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
                JOIN RDB$RELATION_CONSTRAINTS rc_ref ON ref.RDB$CONST_NAME_UQ = rc_ref.RDB$INDEX_NAME
                JOIN RDB$INDEX_SEGMENTS iseg_ref ON rc_ref.RDB$INDEX_NAME = iseg_ref.RDB$INDEX_NAME
                WHERE rc.RDB$RELATION_NAME = ? AND rc.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY'
            `,
            dependencies: `
                SELECT 
                    RDB$DEPENDED_ON_NAME AS DEP_NAME,
                    RDB$DEPENDED_ON_TYPE AS DEP_TYPE
                FROM RDB$DEPENDENCIES
                WHERE RDB$DEPENDENT_NAME = ?
            `
        },
        sourceCode: {
            procedure: "SELECT RDB$PROCEDURE_SOURCE as SOURCE FROM RDB$PROCEDURES WHERE RDB$PROCEDURE_NAME = ?",
            trigger: "SELECT RDB$TRIGGER_SOURCE as SOURCE FROM RDB$TRIGGERS WHERE RDB$TRIGGER_NAME = ?",
            view: "SELECT RDB$VIEW_SOURCE as SOURCE FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = ?"
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
                f.RDB$FIELD_SOURCE AS FIELD_TYPE
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
