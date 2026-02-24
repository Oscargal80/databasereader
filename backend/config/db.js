// Safe lazy-loading for database drivers
let Firebird, Pool, mysql, sqlite3, sql;

try { Firebird = require('node-firebird'); } catch (e) { console.error('Failed to load Firebird driver:', e.message); }
try { Pool = require('pg').Pool; } catch (e) { console.error('Failed to load PostgreSQL driver:', e.message); }
try { mysql = require('mysql2'); } catch (e) { console.error('Failed to load MySQL driver:', e.message); }
try { sqlite3 = require('sqlite3').verbose(); } catch (e) { console.error('Failed to load SQLite driver:', e.message); }
try { sql = require('mssql'); } catch (e) { console.error('Failed to load MSSQL driver:', e.message); }
let hdb;
try { hdb = require('hdb'); } catch (e) { console.error('Failed to load SAP HANA driver:', e.message); }
let duckdb;
try { duckdb = require('duckdb'); } catch (e) { console.error('Failed to load DuckDB driver:', e.message); }

const NodeCache = require('node-cache');

// Global cache instance with 10 minutes (600 seconds) standard TTL
const cache = new NodeCache({ stdTTL: 600 });

// PostgreSQL Pool Cache to avoid creating/ending pools on every query
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
            max: 20, // Limit connections per DB
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        }));
    }
    return pgPools.get(key);
};

/**
 * Agnostic execute query function
 */
const executeQuery = (options, sqlQuery, params, callback) => {
    const dbType = options.dbType || 'firebird';

    if (dbType === 'firebird') {
        if (!Firebird) return callback(new Error('Firebird driver not loaded. Check installation.'));
        const firebirdOptions = {
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.user,
            password: options.password,
            role: options.role || null,
            lowercase_keys: options.lowercase_keys
        };

        Firebird.attach(firebirdOptions, (err, db) => {
            if (err) return callback(err);
            db.query(sqlQuery, params, (err, result) => {
                db.detach();
                callback(err, result);
            });
        });
    } else if (dbType === 'postgres') {
        if (!Pool) return callback(new Error('PostgreSQL driver not loaded. Check installation.'));
        let pgSql = sqlQuery;
        if (params && params.length > 0) {
            let index = 1;
            pgSql = sqlQuery.replace(/\?/g, () => `$${index++}`);
        }

        const pool = getPgPool(options);
        pool.query(pgSql, params, (err, res) => {
            if (err) {
                console.error('[PG-ERROR] Query failed:', pgSql, err.message);
                return callback(err);
            }
            callback(null, res.rows);
        });
    } else if (dbType === 'mysql') {
        if (!mysql) return callback(new Error('MySQL driver not loaded. Check installation.'));
        const connection = mysql.createConnection({
            host: options.host,
            port: options.port || 3306,
            database: options.database,
            user: options.user,
            password: options.password
        });

        connection.query(sqlQuery, params, (err, results) => {
            connection.end();
            if (err) return callback(err);
            callback(null, results);
        });
    } else if (dbType === 'sqlite') {
        if (!sqlite3) return callback(new Error('SQLite driver not loaded. Check installation.'));
        const db = new sqlite3.Database(options.database, (err) => {
            if (err) return callback(err);

            // Convert ? placeholders to match params if needed (sqlite uses ? by default)
            db.all(sqlQuery, params || [], (err, rows) => {
                db.close();
                if (err) return callback(err);
                callback(null, rows);
            });
        });
    } else if (dbType === 'mssql') {
        if (!sql) return callback(new Error('MSSQL driver not loaded. Check installation.'));
        const mssqlConfig = {
            user: options.user,
            password: options.password,
            database: options.database,
            server: options.host,
            port: parseInt(options.port, 10) || 1433,
            options: {
                encrypt: false, // For local/dev usage usually
                trustServerCertificate: true // Self-signed certificates
            }
        };

        sql.connect(mssqlConfig).then(pool => {
            const request = pool.request();
            let finalSql = sqlQuery; // Renamed to avoid shadowing 'sql' package

            // mssql expects parameters as inputs, but if we receive simply positional `?`,
            // we will replace `?` with `@param0`, `@param1`
            if (params && params.length > 0) {
                params.forEach((param, i) => {
                    request.input(`param${i}`, param);
                });

                let pIndex = 0;
                finalSql = finalSql.replace(/\?/g, () => {
                    const temp = `@param${pIndex}`;
                    pIndex++;
                    return temp;
                });
            }

            return request.query(finalSql).then(result => {
                pool.close();
                callback(null, result.recordset);
            });
        }).catch(err => {
            callback(err);
        });
    } else if (dbType === 'hana') {
        if (!hdb) return callback(new Error('SAP HANA driver (hdb) not loaded.'));
        const client = hdb.createClient({
            host: options.host,
            port: options.port || 30015,
            user: options.user,
            password: options.password
        });

        client.connect((err) => {
            if (err) return callback(err);
            client.exec(sqlQuery, params || [], (err, rows) => {
                client.end();
                callback(err, rows);
            });
        });
    } else if (dbType === 'duckdb') {
        if (!duckdb) return callback(new Error('DuckDB driver not loaded.'));
        const db = new duckdb.Database(options.database || ':memory:');
        db.all(sqlQuery, params || [], (err, rows) => {
            db.close();
            callback(err, rows);
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
                password: options.password,
                role: options.role || null
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
        } else if (dbType === 'mssql') {
            const mssqlConfig = {
                user: options.user,
                password: options.password,
                database: options.database,
                server: options.host,
                port: parseInt(options.port, 10) || 1433,
                options: {
                    encrypt: false,
                    trustServerCertificate: true
                }
            };
            sql.connect(mssqlConfig).then(pool => {
                pool.close();
                resolve(true);
            }).catch(err => {
                reject(err);
            });
        } else if (dbType === 'hana') {
            if (!hdb) return reject(new Error('SAP HANA driver not loaded.'));
            const client = hdb.createClient({
                host: options.host,
                port: options.port || 30015,
                user: options.user,
                password: options.password
            });
            client.connect((err) => {
                if (err) return reject(err);
                client.end();
                resolve(true);
            });
        } else if (dbType === 'duckdb') {
            if (!duckdb) return reject(new Error('DuckDB driver not loaded.'));
            const db = new duckdb.Database(options.database || ':memory:', (err) => {
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
    if (dbType === 'mssql') {
        return {
            explorer: {
                userTables: "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
                systemTables: "SELECT name FROM sys.tables WHERE is_ms_shipped = 1 ORDER BY name",
                views: "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_NAME",
                procedures: "SELECT ROUTINE_NAME as name FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME",
                triggers: "SELECT name FROM sys.triggers ORDER BY name",
                generators: "SELECT name FROM sys.sequences ORDER BY name",
                matViews: "SELECT name FROM sys.views WHERE object_id IN (SELECT object_id FROM sys.indexes) ORDER BY name", // Simplified approximation for indexed views
                reports: "SELECT 'Activity Monitor' as name" // Placeholder
            },
            structure: "SELECT COLUMN_NAME as field, DATA_TYPE as type, CHARACTER_MAXIMUM_LENGTH as length FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?",
            metadata: {
                indexes: "SELECT i.name AS indexName, c.name AS columnName, i.is_unique AS isUnique FROM sys.indexes i INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id INNER JOIN sys.columns c ON ic.object_id = c.object_id AND c.column_id = ic.column_id WHERE i.object_id = OBJECT_ID(?)",
                foreignKeys: "SELECT obj.name AS fkName, col1.name AS columnName, tab2.name AS referencedTable, col2.name AS referencedColumn FROM sys.foreign_key_columns fkc INNER JOIN sys.objects obj ON obj.object_id = fkc.constraint_object_id INNER JOIN sys.tables tab1 ON tab1.object_id = fkc.parent_object_id INNER JOIN sys.columns col1 ON col1.column_id = parent_column_id AND col1.object_id = tab1.object_id INNER JOIN sys.tables tab2 ON tab2.object_id = fkc.referenced_object_id INNER JOIN sys.columns col2 ON col2.column_id = referenced_column_id AND col2.object_id = tab2.object_id WHERE tab1.name = ?"
            },
            sourceCode: "SELECT OBJECT_DEFINITION(OBJECT_ID(?)) AS sourceCode",
            genValues: "SELECT current_value AS currentValue FROM sys.sequences WHERE name = ?",
            users: "SELECT name as alias, type_desc as type FROM sys.database_principals WHERE type IN ('S', 'U', 'G') ORDER BY name",
            userActions: {
                create: (username, password) => `CREATE LOGIN ${username} WITH PASSWORD = '${password}'; CREATE USER ${username} FOR LOGIN ${username};`,
                update: (username, password) => `ALTER LOGIN ${username} WITH PASSWORD = '${password}';`,
                delete: (username) => `DROP USER ${username}; DROP LOGIN ${username};`
            },
            fullSchema: `
                SELECT 
                    TABLE_NAME AS TABLE_NAME,
                    COLUMN_NAME AS FIELD_NAME,
                    DATA_TYPE AS FIELD_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                ORDER BY TABLE_NAME, ORDINAL_POSITION
            `,
            explain: (query) => `SET SHOWPLAN_ALL ON; ${query}; SET SHOWPLAN_ALL OFF;`,
            pagination: (tableName, limit, offset) => `SELECT * FROM ${tableName} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`
        };
    } else if (dbType === 'postgres') {
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
            fullSchema: `
                SELECT 
                    table_name as TABLE_NAME,
                    column_name as FIELD_NAME,
                    data_type as FIELD_TYPE
                FROM information_schema.columns 
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_name, ordinal_position
            `,
            explain: (query) => `EXPLAIN (FORMAT JSON) ${query}`,
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
                update: (username, password) => `ALTER USER '${username}'@'%' IDENTIFIED BY '${password}'`,
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
                    data_type as FIELD_TYPE,
                    IF(column_key = 'PRI', 1, 0) as is_pk
                FROM information_schema.columns 
                WHERE table_schema = DATABASE()
                ORDER BY table_name, ordinal_position
            `,
            explain: (query) => `EXPLAIN FORMAT=JSON ${query}`,
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
                    p.type as FIELD_TYPE,
                    p.pk as is_pk
                FROM sqlite_master m
                JOIN pragma_table_info(m.name) p
                WHERE m.type = 'table'
                ORDER BY m.name, p.cid
            `,
            explain: (query) => `EXPLAIN QUERY PLAN ${query}`,
            pagination: (tableName, limit, offset) => `SELECT * FROM ${tableName} LIMIT ${limit} OFFSET ${offset}`
        };
    }

    if (dbType === 'duckdb') {
        return {
            explorer: {
                userTables: "SELECT table_name as name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog') ORDER BY 1",
                systemTables: "SELECT table_name as name FROM information_schema.tables WHERE table_schema IN ('information_schema', 'pg_catalog') ORDER BY 1",
                views: "SELECT table_name as name FROM information_schema.views WHERE table_schema NOT IN ('information_schema', 'pg_catalog') ORDER BY 1",
                materializedViews: "SELECT 'No disponible' as name FROM (SELECT 1) WHERE 1=0",
                procedures: "SELECT 'No disponible' as name FROM (SELECT 1) WHERE 1=0",
                triggers: "SELECT 'No disponible' as name FROM (SELECT 1) WHERE 1=0",
                generators: "SELECT sequence_name as name FROM information_schema.sequences ORDER BY 1",
                reports: "SELECT 'duckdb_settings' as name UNION SELECT 'duckdb_memory_usage' UNION SELECT 'duckdb_extensions' ORDER BY 1"
            },
            metadata: {
                indexes: "SELECT index_name, table_name as definition, 'YES' as is_unique FROM duckdb_indexes() WHERE table_name = ?",
                foreignKeys: "SELECT 'N/A' as constraint_name, 'N/A' as column_name, 'N/A' as ref_table, 'N/A' as ref_field WHERE 1=0",
                dependencies: "SELECT 'No disponible' as DEP_NAME, 'N/A' as DEP_TYPE WHERE 1=0"
            },
            sourceCode: {
                procedure: "SELECT 'N/A' as SOURCE WHERE 1=0",
                trigger: "SELECT 'N/A' as SOURCE WHERE 1=0",
                view: "SELECT sql as SOURCE FROM duckdb_views() WHERE view_name = ?"
            },
            users: {
                list: "SELECT 'Single User Mode' as username",
                create: () => "SELECT 'No disponible'",
                update: () => "SELECT 'No disponible'",
                delete: () => "SELECT 'No disponible'"
            },
            structure: `
                SELECT 
                    column_name as field_name,
                    data_type as field_type,
                    character_maximum_length as field_length,
                    is_nullable,
                    (CASE WHEN column_name = (SELECT column_name FROM information_schema.key_column_usage WHERE table_name = ? LIMIT 1) THEN 1 ELSE 0 END) as is_pk
                FROM information_schema.columns 
                WHERE table_name = ?
                ORDER BY ordinal_position
            `,
            fullSchema: `
                SELECT 
                    table_name as TABLE_NAME,
                    column_name as FIELD_NAME,
                    data_type as FIELD_TYPE
                FROM information_schema.columns 
                WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
                ORDER BY table_name, ordinal_position
            `,
            explain: (query) => `EXPLAIN ${query}`,
            pagination: (tableName, limit, offset) => `SELECT * FROM ${tableName} LIMIT ${limit} OFFSET ${offset}`
        };
    }

    if (dbType === 'hana') {
        return {
            explorer: {
                userTables: "SELECT TABLE_NAME as name FROM SYS.TABLES WHERE SCHEMA_NAME = CURRENT_SCHEMA AND IS_USER_DEFINED_TYPE = 'FALSE' ORDER BY 1",
                systemTables: "SELECT TABLE_NAME as name FROM SYS.TABLES WHERE SCHEMA_NAME IN ('SYS', '_SYS_BI', '_SYS_BIC') ORDER BY 1",
                views: "SELECT VIEW_NAME as name FROM SYS.VIEWS WHERE SCHEMA_NAME = CURRENT_SCHEMA ORDER BY 1",
                materializedViews: "SELECT 'No disponible' as name FROM DUMMY WHERE 1=0",
                procedures: "SELECT PROCEDURE_NAME as name FROM SYS.PROCEDURES WHERE SCHEMA_NAME = CURRENT_SCHEMA ORDER BY 1",
                triggers: "SELECT TRIGGER_NAME as name FROM SYS.TRIGGERS WHERE SCHEMA_NAME = CURRENT_SCHEMA ORDER BY 1",
                generators: "SELECT SEQUENCE_NAME as name FROM SYS.SEQUENCES WHERE SCHEMA_NAME = CURRENT_SCHEMA ORDER BY 1",
                reports: "SELECT 'M_SERVICE_STATISTICS' as name FROM DUMMY"
            },
            metadata: {
                indexes: "SELECT INDEX_NAME, COLUMN_NAME, CONSTRAINT as IS_UNIQUE FROM SYS.INDEX_COLUMNS WHERE TABLE_NAME = ? ORDER BY INDEX_NAME, POSITION",
                foreignKeys: "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME as REF_TABLE, REFERENCED_COLUMN_NAME as REF_FIELD FROM SYS.REFERENTIAL_CONSTRAINTS WHERE TABLE_NAME = ?",
                dependencies: "SELECT DEPENDENT_OBJECT_NAME as DEP_NAME, DEPENDENT_OBJECT_TYPE as DEP_TYPE FROM SYS.OBJECT_DEPENDENCIES WHERE OBJECT_NAME = ?"
            },
            sourceCode: {
                procedure: "SELECT DEFINITION as SOURCE FROM SYS.PROCEDURES WHERE PROCEDURE_NAME = ?",
                trigger: "SELECT DEFINITION as SOURCE FROM SYS.TRIGGERS WHERE TRIGGER_NAME = ?",
                view: "SELECT DEFINITION as SOURCE FROM SYS.VIEWS WHERE VIEW_NAME = ?"
            },
            users: {
                list: "SELECT USER_NAME as username FROM SYS.USERS ORDER BY 1",
                create: (username, password) => `CREATE USER ${username} PASSWORD "${password}"`,
                update: (username, password) => `ALTER USER ${username} PASSWORD "${password}"`,
                delete: (username) => `DROP USER ${username}`
            },
            structure: `
                SELECT 
                    COLUMN_NAME as field_name,
                    DATA_TYPE_NAME as field_type,
                    LENGTH as field_length,
                    IS_NULLABLE as is_nullable,
                    (SELECT 1 FROM SYS.CONSTRAINTS WHERE TABLE_NAME = cols.TABLE_NAME AND COLUMN_NAME = cols.COLUMN_NAME AND IS_PRIMARY_KEY = 'TRUE') as is_pk
                FROM SYS.COLUMNS cols
                WHERE TABLE_NAME = ?
                ORDER BY POSITION
            `,
            fullSchema: `
                SELECT 
                    TABLE_NAME as TABLE_NAME,
                    COLUMN_NAME as FIELD_NAME,
                    DATA_TYPE_NAME as FIELD_TYPE
                FROM SYS.COLUMNS 
                WHERE SCHEMA_NAME = CURRENT_SCHEMA
                ORDER BY TABLE_NAME, POSITION
            `,
            explain: (query) => `EXPLAIN PLAN FOR ${query}`,
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
            update: (username, password) => `ALTER USER ${username} PASSWORD '${password}'`,
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

/**
 * Agnostic bulk insert function with transaction control
 */
const bulkInsert = (options, tableName, columns, rows, callback) => {
    const dbType = options.dbType || 'firebird';
    const isMySQL = dbType === 'mysql';
    const isMSSQL = dbType === 'mssql';
    const isPostgres = dbType === 'postgres';
    const isSqlite = dbType === 'sqlite';

    const quotedTable = isMySQL ? `\`${tableName}\`` : `"${tableName}"`;
    const quotedCols = columns.map(c => isMySQL ? `\`${c}\`` : `"${c}"`).join(', ');

    if (isPostgres) {
        // PostgreSQL: Multi-value INSERT or UNNEST
        const pool = getPgPool(options);
        pool.connect((err, client, done) => {
            if (err) return callback(err);
            const abort = (err) => {
                client.query('ROLLBACK', () => {
                    done();
                    callback(err);
                });
            };

            client.query('BEGIN', (err) => {
                if (err) return abort(err);

                // Multi-row insert
                let index = 1;
                const placeholders = rows.map(() => `(${columns.map(() => `$${index++}`).join(', ')})`).join(', ');
                const vals = rows.flat();
                const sql = `INSERT INTO ${quotedTable} (${quotedCols}) VALUES ${placeholders}`;

                client.query(sql, vals, (err) => {
                    if (err) return abort(err);
                    client.query('COMMIT', (err) => {
                        done();
                        callback(err, { rowCount: rows.length });
                    });
                });
            });
        });
    } else if (isMySQL) {
        // MySQL: Multi-value INSERT
        const connection = mysql.createConnection({
            host: options.host,
            user: options.user,
            password: options.password,
            database: options.database,
            port: options.port || 3306
        });

        connection.beginTransaction((err) => {
            if (err) return (connection.end(), callback(err));

            const sql = `INSERT INTO ${quotedTable} (${quotedCols}) VALUES ?`;
            // mysql2 expects rows as an array of arrays [[val, val], [val, val]]
            const insertValues = rows.map(r => Object.values(r));

            connection.query(sql, [insertValues], (err) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.end();
                        callback(err);
                    });
                }
                connection.commit((err) => {
                    connection.end();
                    callback(err, { rowCount: rows.length });
                });
            });
        });
    } else if (isSqlite) {
        // SQLite: Single transaction with many inserts
        const db = new sqlite3.Database(options.database, (err) => {
            if (err) return callback(err);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const placeholders = columns.map(() => '?').join(', ');
                const stmt = db.prepare(`INSERT INTO ${quotedTable} (${quotedCols}) VALUES (${placeholders})`);

                let hadError = false;
                for (const row of rows) {
                    stmt.run(Object.values(row), (err) => {
                        if (err) hadError = err;
                    });
                    if (hadError) break;
                }

                stmt.finalize();

                if (hadError) {
                    db.run('ROLLBACK', () => {
                        db.close();
                        callback(hadError);
                    });
                } else {
                    db.run('COMMIT', (err) => {
                        db.close();
                        callback(err, { rowCount: rows.length });
                    });
                }
            });
        });
    } else if (isMSSQL) {
        // MSSQL: Multiple inserts in a Transaction
        const mssqlConfig = {
            user: options.user,
            password: options.password,
            database: options.database,
            server: options.host,
            port: parseInt(options.port, 10) || 1433,
            options: { encrypt: false, trustServerCertificate: true }
        };

        sql.connect(mssqlConfig).then(pool => {
            const transaction = new sql.Transaction(pool);
            transaction.begin(err => {
                if (err) return (pool.close(), callback(err));

                // For simple implementation without custom types, we use consecutive inserts
                // Note: for production high volume, TVP or BulkCopy is better
                const request = new sql.Request(transaction);

                let completed = 0;
                let faulted = false;

                const runInsert = (rowIndex) => {
                    if (rowIndex >= rows.length || faulted) {
                        if (faulted) {
                            transaction.rollback(() => {
                                pool.close();
                            });
                        } else {
                            transaction.commit((err) => {
                                pool.close();
                                callback(err, { rowCount: rows.length });
                            });
                        }
                        return;
                    }

                    const row = rows[rowIndex];
                    let localSql = `INSERT INTO ${quotedTable} (${quotedCols}) VALUES (`;
                    const vals = Object.values(row);
                    vals.forEach((v, i) => {
                        const paramName = `p${rowIndex}_${i}`;
                        request.input(paramName, v);
                        localSql += `@${paramName}${i < vals.length - 1 ? ', ' : ''}`;
                    });
                    localSql += ')';

                    request.query(localSql).then(() => {
                        runInsert(rowIndex + 1);
                    }).catch(err => {
                        faulted = err;
                        runInsert(rowIndex + 1);
                        callback(err);
                    });
                };

                runInsert(0);
            });
        }).catch(err => callback(err));
    } else {
        // Firebird: EXECUTE BLOCK or single transaction inserts
        const firebirdOptions = {
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.user,
            password: options.password
        };

        Firebird.attach(firebirdOptions, (err, db) => {
            if (err) return callback(err);

            db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
                if (err) return (db.detach(), callback(err));

                const sql = `INSERT INTO ${quotedTable} (${quotedCols}) VALUES (${columns.map(() => '?').join(', ')})`;

                let index = 0;
                const runNext = () => {
                    if (index >= rows.length) {
                        transaction.commit((err) => {
                            db.detach();
                            callback(err, { rowCount: rows.length });
                        });
                        return;
                    }

                    const rowValues = columns.map(col => rows[index][col]);
                    transaction.query(sql, rowValues, (err) => {
                        if (err) {
                            transaction.rollback();
                            db.detach();
                            return callback(err);
                        }
                        index++;
                        runNext();
                    });
                };

                runNext();
            });
        });
    }
};

/**
 * Agnostic bulk upsert function
 */
const bulkUpsert = (options, tableName, columns, rows, pkColumn, callback) => {
    const dbType = options.dbType || 'firebird';
    const isMySQL = dbType === 'mysql';
    const isMSSQL = dbType === 'mssql';
    const isPostgres = dbType === 'postgres';
    const isSqlite = dbType === 'sqlite';

    const quotedTable = isMySQL ? `\`${tableName}\`` : `"${tableName}"`;
    const quotedCols = columns.map(c => isMySQL ? `\`${c}\`` : `"${c}"`).join(', ');
    const nonPkCols = columns.filter(c => c.toLowerCase() !== pkColumn.toLowerCase());

    if (isPostgres || isSqlite) {
        // Postgres/SQLite: INSERT ... ON CONFLICT (pk) DO UPDATE SET ...
        const pool = isPostgres ? getPgPool(options) : null;
        const updateSet = nonPkCols.map(c => `${isMySQL ? `\`${c}\`` : `"${c}"`} = EXCLUDED.${isMySQL ? `\`${c}\`` : `"${c}"`}`).join(', ');

        const execute = (client, done) => {
            let index = 1;
            const placeholders = rows.map(() => `(${columns.map(() => `$${index++}`).join(', ')})`).join(', ');
            const vals = rows.flat();
            const sql = `INSERT INTO ${quotedTable} (${quotedCols}) VALUES ${placeholders} ON CONFLICT ("${pkColumn}") DO UPDATE SET ${updateSet}`;

            client.query('BEGIN', (err) => {
                if (err) return (done(), callback(err));
                client.query(sql, vals, (err) => {
                    if (err) {
                        client.query('ROLLBACK', () => { done(); callback(err); });
                    } else {
                        client.query('COMMIT', (err) => { done(); callback(err, { rowCount: rows.length }); });
                    }
                });
            });
        };

        if (isPostgres) {
            pool.connect((err, client, done) => {
                if (err) return callback(err);
                execute(client, done);
            });
        } else {
            // SQLite specific wrapper for similar syntax
            const db = new sqlite3.Database(options.database, (err) => {
                if (err) return callback(err);
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    const placeholders = columns.map(() => '?').join(', ');
                    const updateSetSqlite = nonPkCols.map(c => `"${c}" = excluded."${c}"`).join(', ');
                    const stmt = db.prepare(`INSERT INTO ${quotedTable} (${quotedCols}) VALUES (${placeholders}) ON CONFLICT ("${pkColumn}") DO UPDATE SET ${updateSetSqlite}`);

                    let hadError = false;
                    rows.forEach(row => {
                        stmt.run(Object.values(row), (err) => { if (err) hadError = err; });
                    });
                    stmt.finalize();

                    if (hadError) {
                        db.run('ROLLBACK', () => { db.close(); callback(hadError); });
                    } else {
                        db.run('COMMIT', (err) => { db.close(); callback(err, { rowCount: rows.length }); });
                    }
                });
            });
        }
    } else if (isMySQL) {
        // MySQL: INSERT ... ON DUPLICATE KEY UPDATE ...
        const connection = mysql.createConnection({
            host: options.host, user: options.user, password: options.password, database: options.database, port: options.port || 3306
        });
        const updateSet = nonPkCols.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
        const sql = `INSERT INTO ${quotedTable} (${quotedCols}) VALUES ? ON DUPLICATE KEY UPDATE ${updateSet}`;
        const insertValues = rows.map(r => columns.map(col => r[col]));

        connection.beginTransaction((err) => {
            if (err) return (connection.end(), callback(err));
            connection.query(sql, [insertValues], (err) => {
                if (err) {
                    return connection.rollback(() => { connection.end(); callback(err); });
                }
                connection.commit((err) => { connection.end(); callback(err, { rowCount: rows.length }); });
            });
        });
    } else if (dbType === 'firebird') {
        // Firebird: UPDATE OR INSERT INTO ... MATCHING (pk)
        const firebirdOptions = { host: options.host, port: options.port, database: options.database, user: options.user, password: options.password };
        Firebird.attach(firebirdOptions, (err, db) => {
            if (err) return callback(err);
            db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
                if (err) return (db.detach(), callback(err));
                const sql = `UPDATE OR INSERT INTO ${quotedTable} (${quotedCols}) VALUES (${columns.map(() => '?').join(', ')}) MATCHING ("${pkColumn}")`;
                let index = 0;
                const runNext = () => {
                    if (index >= rows.length) {
                        transaction.commit((err) => { db.detach(); callback(err, { rowCount: rows.length }); });
                        return;
                    }
                    const rowValues = columns.map(col => rows[index][col]);
                    transaction.query(sql, rowValues, (err) => {
                        if (err) { transaction.rollback(); db.detach(); return callback(err); }
                        index++; runNext();
                    });
                };
                runNext();
            });
        });
    } else if (isMSSQL) {
        // MSSQL: MERGE
        // Implementation via multiple MERGE statements for simplicity in multi-engine context
        const mssqlConfig = { user: options.user, password: options.password, database: options.database, server: options.host, port: parseInt(options.port, 10) || 1433, options: { encrypt: false, trustServerCertificate: true } };
        sql.connect(mssqlConfig).then(pool => {
            const transaction = new sql.Transaction(pool);
            transaction.begin(err => {
                if (err) return (pool.close(), callback(err));
                const request = new sql.Request(transaction);
                let current = 0;
                const runNext = () => {
                    if (current >= rows.length) {
                        transaction.commit(err => { pool.close(); callback(err, { rowCount: rows.length }); });
                        return;
                    }
                    const row = rows[current];
                    const paramsLine = columns.map((c, i) => {
                        request.input(`v${current}_${i}`, row[c]);
                        return `@v${current}_${i}`;
                    }).join(', ');

                    const setClause = nonPkCols.map((c, i) => `target."${c}" = source."${c}"`).join(', ');
                    const mergeSql = `
                        MERGE INTO ${quotedTable} AS target
                        USING (SELECT ${columns.map((c, i) => `@v${current}_${i} AS "${c}"`).join(', ')}) AS source
                        ON target."${pkColumn}" = source."${pkColumn}"
                        WHEN MATCHED THEN UPDATE SET ${setClause}
                        WHEN NOT MATCHED THEN INSERT (${quotedCols}) VALUES (${columns.map(c => `source."${c}"`).join(', ')});
                    `;
                    request.query(mergeSql).then(() => { current++; runNext(); }).catch(err => { transaction.rollback(); pool.close(); callback(err); });
                };
                runNext();
            });
        }).catch(err => callback(err));
    }
};

/**
 * Agnostic function to sync generators/sequences after import
 */
const syncGenerators = (options, tableName, pkColumn, callback) => {
    const dbType = options.dbType || 'firebird';
    const maxQuery = `SELECT MAX("${pkColumn}") as MAX_ID FROM "${tableName}"`;

    executeQuery(options, maxQuery, [], (err, result) => {
        if (err || !result || result.length === 0) return callback(err);
        const maxId = result[0].MAX_ID || result[0].max_id;
        if (!maxId) return callback(null);

        let syncSql = '';
        if (dbType === 'firebird') {
            // Find generator name for the column in Firebird
            const findGenSql = `
                SELECT TRIM(RDB$GENERATOR_NAME) as GEN_NAME 
                FROM RDB$GENERATORS 
                WHERE RDB$SYSTEM_FLAG = 0 
                AND (UPPER(RDB$GENERATOR_NAME) LIKE UPPER('%' || ? || '%') OR UPPER(RDB$GENERATOR_NAME) LIKE UPPER('%' || ? || '%'))
            `;
            executeQuery(options, findGenSql, [tableName, pkColumn], (err, gens) => {
                if (!err && gens && gens.length > 0) {
                    const genName = gens[0].GEN_NAME;
                    executeQuery(options, `SET GENERATOR "${genName}" TO ${maxId}`, [], callback);
                } else {
                    callback(null); // No gen found, skip
                }
            });
            return;
        } else if (dbType === 'postgres') {
            syncSql = `SELECT setval(pg_get_serial_sequence('${tableName}', '${pkColumn}'), ${maxId})`;
        } else if (dbType === 'mysql') {
            syncSql = `ALTER TABLE \`${tableName}\` AUTO_INCREMENT = ${maxId + 1}`;
        } else if (dbType === 'mssql') {
            syncSql = `DBCC CHECKIDENT ('${tableName}', RESEED, ${maxId})`;
        } else if (dbType === 'sqlite') {
            syncSql = `UPDATE sqlite_sequence SET seq = ${maxId} WHERE name = '${tableName}'`;
        }

        if (syncSql) {
            executeQuery(options, syncSql, [], callback);
        } else {
            callback(null);
        }
    });
};

module.exports = {
    executeQuery,
    testConnection,
    getSqlDialect,
    bulkInsert,
    bulkUpsert,
    syncGenerators,
    cache
};
