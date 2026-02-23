const express = require('express');
const router = express.Router();
const { executeQuery, getSqlDialect, cache } = require('../config/db');
const tracker = require('../services/usageTracker');

// DB Status / Metadata
router.get('/status', (req, res) => {
    const dbOptions = req.session.dbOptions;
    if (!dbOptions) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const dbType = dbOptions.dbType || 'firebird';
    let versionQuery = '';

    if (dbType === 'firebird') versionQuery = 'SELECT rdb$get_context(\'SYSTEM\', \'ENGINE_VERSION\') as version FROM rdb$database';
    else if (dbType === 'postgres') versionQuery = 'SELECT version() as version';
    else if (dbType === 'mysql') versionQuery = 'SELECT version() as version';
    else if (dbType === 'sqlite') versionQuery = 'SELECT sqlite_version() as version';
    else if (dbType === 'mssql') versionQuery = 'SELECT @@VERSION as version';

    executeQuery(dbOptions, versionQuery, [], (err, result) => {
        const info = {
            host: dbOptions.host,
            database: dbOptions.database,
            user: dbOptions.user,
            dbType: dbType,
            version: err ? 'Unknown' : (result[0]?.VERSION || result[0]?.version || Object.values(result[0] || {})[0]),
            serverTime: new Date().toISOString()
        };
        res.json({ success: true, data: info });
    });
});

// Middleware to check session
const checkAuth = (req, res, next) => {
    if (!req.session.dbOptions) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    next();
};

router.use(checkAuth);

// List tables, procedures, triggers, views, generators
router.get('/explorer', (req, res) => {
    const dbType = req.session.dbOptions.dbType;
    const host = req.session.dbOptions.host || 'localhost';
    const dbName = req.session.dbOptions.database || 'default';
    const refresh = req.query.refresh === 'true';

    const cacheKey = `explorer_${dbType}_${host}_${dbName}`;

    // Return cached data if available and not forced to refresh
    if (!refresh && cache.has(cacheKey)) {
        console.log(`[Cache HIT] Explorer metadata for ${cacheKey}`);
        return res.json({ success: true, data: cache.get(cacheKey) });
    }

    console.log(`[Cache MISS/REFRESH] Fetching Explorer metadata for ${cacheKey}`);

    const dialect = getSqlDialect(dbType);
    const queries = dialect.explorer;

    const results = {
        userTables: [],
        systemTables: [],
        views: [],
        procedures: [],
        triggers: [],
        generators: []
    };
    const keys = Object.keys(queries);
    let completed = 0;

    keys.forEach(key => {
        executeQuery(req.session.dbOptions, queries[key], [], (err, result) => {
            if (err) {
                console.error(`Error fetching ${key}:`, err.message);
                results[key] = { error: err.message };
            } else {
                // Ensure result is array and extract name
                const rows = Array.isArray(result) ? result : [];
                results[key] = rows.map(r => (r.NAME || r.name || r.table_name || r.routine_name || r.trigger_name || '').trim());
            }

            completed++;
            if (completed === keys.length) {
                // Store in cache and return
                cache.set(cacheKey, results);
                res.json({ success: true, data: results });
            }
        });
    });
});

// Get row counts for all user tables
router.get('/tableCounts', (req, res) => {
    const dbType = req.session.dbOptions.dbType;
    const dialect = getSqlDialect(dbType);

    const quote = (name) => {
        if (dbType === 'mysql') return `\`${name}\``;
        if (dbType === 'postgres' || dbType === 'sqlite') return `"${name}"`;
        if (dbType === 'mssql') return `[${name}]`;
        return name;
    };

    executeQuery(req.session.dbOptions, dialect.explorer.userTables, [], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        const tables = (Array.isArray(result) ? result : []).map(r => (r.NAME || r.name || r.table_name || '').trim());
        const counts = {};

        if (tables.length === 0) return res.json({ success: true, data: counts });

        let completed = 0;
        tables.forEach(tbl => {
            const sql = `SELECT COUNT(*) as cnt FROM ${quote(tbl)}`;
            executeQuery(req.session.dbOptions, sql, [], (e, cntResult) => {
                if (!e && Array.isArray(cntResult) && cntResult[0]) {
                    counts[tbl] = cntResult[0].cnt || cntResult[0].COUNT || cntResult[0].count || 0;
                } else {
                    counts[tbl] = 0;
                }
                completed++;
                if (completed === tables.length) {
                    res.json({ success: true, data: counts });
                }
            });
        });
    });
});

// Get table structure
router.get('/structure/:tableName', (req, res) => {
    const { tableName } = req.params;
    const { type } = req.query;
    const dbType = req.session.dbOptions.dbType;
    const dialect = getSqlDialect(dbType);

    let sql = dialect.structure;
    // Parameters handling: Postgres/MySQL usually need more flexible param binding
    let params = [tableName];
    if (dbType === 'postgres') params = [tableName, tableName];
    if (dbType === 'firebird') params = [tableName.toUpperCase()];
    if (dbType === 'sqlite' || dbType === 'mssql') params = [tableName];

    // Specialized structure for Procedures in Firebird
    if (type === 'Procedures' && dbType === 'firebird') {
        sql = `
            SELECT 
                RDB$PARAMETER_NAME AS FIELD_NAME,
                RDB$FIELD_SOURCE AS FIELD_TYPE,
                RDB$PARAMETER_TYPE AS PARAM_TYPE
            FROM RDB$PROCEDURE_PARAMETERS
            WHERE RDB$PROCEDURE_NAME = ?
            ORDER BY RDB$PARAMETER_NUMBER
        `;
    } else if (type === 'Triggers' || type === 'Generators' || type === 'Procedures') {
        // For non-Firebird procedures or other objects, we might use a generic approach or mock
        if (dbType === 'firebird' && (type === 'Triggers' || type === 'Generators')) {
            return res.json({
                success: true,
                data: [{ name: 'VALUE/SOURCE', type: 'BLOB/VARCHAR', length: 0, nullable: false, isPk: false }]
            });
        }
    }

    executeQuery(req.session.dbOptions, sql, params, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        const rows = Array.isArray(result) ? result : [];
        console.log(`Structure for ${tableName}: Found ${rows.length} columns.`);

        const typeMap = {
            7: 'SMALLINT', 8: 'INTEGER', 10: 'FLOAT', 12: 'DATE', 13: 'TIME',
            14: 'CHAR', 16: 'BIGINT', 27: 'DOUBLE PRECISION', 35: 'TIMESTAMP',
            37: 'VARCHAR', 40: 'CSTRING', 261: 'BLOB'
        };

        const structure = rows.map(row => {
            const fieldName = (row.FIELD_NAME || row.field_name || row.COLUMN_NAME || row.column_name || '').trim();
            const rawType = row.FIELD_TYPE || row.field_type || row.DATA_TYPE || row.data_type;

            // Agnostic type mapping
            let mappedType = rawType;
            if (typeof rawType === 'number') {
                mappedType = typeMap[rawType] || `TYPE_${rawType}`;
            }

            return {
                name: fieldName,
                type: mappedType,
                length: row.FIELD_LENGTH || row.field_length || row.CHARACTER_MAXIMUM_LENGTH || row.character_maximum_length,
                precision: row.FIELD_PRECISION || row.NUMERIC_PRECISION,
                scale: row.FIELD_SCALE || row.NUMERIC_SCALE,
                nullable: (row.NULL_FLAG !== 1 && row.is_nullable !== 'NO' && row.IS_NULLABLE !== 'NO'),
                isPk: !!(row.IS_PK || row.is_pk || row.is_primary || row.COLUMN_KEY === 'PRI'),
                isFk: !!(row.IS_FK || row.is_fk)
            };
        });

        if (structure.length === 0) {
            console.warn(`WARNING: No columns found for ${tableName}. Check if the table exists and is accessible for user in the current database.`);
        }

        res.json({ success: true, data: structure });
    });
});

// Get table metadata (Indexes, FKs, Dependencies)
router.get('/metadata/:tableName', (req, res) => {
    const { tableName } = req.params;
    const dbType = req.session.dbOptions.dbType;
    const host = req.session.dbOptions.host || 'localhost';
    const dbName = req.session.dbOptions.database || 'default';
    const refresh = req.query.refresh === 'true';

    const cacheKey = `metadata_${dbType}_${host}_${dbName}_${tableName}`;

    // Return cached data if available and not forced to refresh
    if (!refresh && cache.has(cacheKey)) {
        console.log(`[Cache HIT] Table Metadata for ${cacheKey}`);
        return res.json({ success: true, data: cache.get(cacheKey) });
    }

    console.log(`[Cache MISS/REFRESH] Fetching Table Metadata for ${cacheKey}`);

    const dialect = getSqlDialect(dbType);
    const queries = dialect.metadata;

    // Use correct casing/params based on engine
    let searchName = tableName;
    if (dbType === 'firebird') searchName = tableName.toUpperCase();

    const results = {};
    const keys = Object.keys(queries);
    let completed = 0;

    keys.forEach(key => {
        executeQuery(req.session.dbOptions, queries[key], [searchName], (err, result) => {
            if (err) {
                console.error(`Error fetching ${key}:`, err.message);
                results[key] = [];
            } else {
                results[key] = (Array.isArray(result) ? result : []).map(row => {
                    const cleanRow = {};
                    for (let k in row) {
                        cleanRow[k] = row[k] && typeof row[k] === 'string' ? row[k].trim() : row[k];
                    }
                    return cleanRow;
                });
            }

            completed++;
            if (completed === keys.length) {
                cache.set(cacheKey, results);
                res.json({ success: true, data: results });
            }
        });
    });
});

// Get consolidated metadata for ER Diagram
router.get('/visual-metadata', async (req, res) => {
    const dbType = req.session.dbOptions.dbType;
    const dialect = getSqlDialect(dbType);

    try {
        console.log(`[VISUAL-METADATA] Starting fetch for ${dbType}...`);

        // 1. Get Tables
        const tablesResult = await new Promise((resolve, reject) => {
            executeQuery(req.session.dbOptions, dialect.explorer.userTables, [], (err, result) => {
                if (err) reject(err); else resolve(result);
            });
        });

        const tableNames = (Array.isArray(tablesResult) ? tablesResult : []).map(r => (r.NAME || r.name || r.table_name || '').trim());
        const schema = { tables: [], relationships: [] };

        if (tableNames.length === 0) {
            console.log('[VISUAL-METADATA] No tables found.');
            return res.json({ success: true, data: schema });
        }

        console.log(`[VISUAL-METADATA] Processing ${tableNames.length} tables`);

        // 2. Fetch Columns (optimized)
        if (dialect.fullSchema) {
            console.log(`[VISUAL-METADATA] Using bulk schema query...`);
            const fullSchemaRows = await new Promise((resolve, reject) => {
                executeQuery(req.session.dbOptions, dialect.fullSchema, [], (err, rows) => {
                    if (err) reject(err); else resolve(rows);
                });
            });

            const tableMap = {};
            (fullSchemaRows || []).forEach(row => {
                const tName = (row.TABLE_NAME || row.table_name || '').trim();
                if (!tableMap[tName]) tableMap[tName] = [];
                tableMap[tName].push({
                    name: (row.FIELD_NAME || row.field_name || row.column_name || '').trim(),
                    type: row.FIELD_TYPE || row.field_type || row.data_type,
                    isPk: !!(row.IS_PK || row.is_pk)
                });
            });

            for (let tName in tableMap) {
                schema.tables.push({ name: tName, columns: tableMap[tName] });
            }
        }

        // Fallback for tables missing in fullSchema or if fullSchema not supported
        const missingTables = tableNames.filter(name => !schema.tables.find(t => t.name === name));
        if (missingTables.length > 0) {
            console.log(`[VISUAL-METADATA] Fetching ${missingTables.length} tables manually...`);
            // Limit manual fetch to avoid long hang if many tables
            const tablesToFetch = missingTables.slice(0, 50);

            const manualPromises = tablesToFetch.map(table => {
                return new Promise((resolve) => {
                    let structSql = dialect.structure;
                    let params = [table];
                    if (dbType === 'postgres') params = [table, table];
                    if (dbType === 'firebird') params = [table.toUpperCase()];

                    executeQuery(req.session.dbOptions, structSql, params, (err, struct) => {
                        if (!err && Array.isArray(struct)) {
                            schema.tables.push({
                                name: table,
                                columns: struct.map(c => ({
                                    name: (c.FIELD_NAME || c.field_name || c.COLUMN_NAME || '').trim(),
                                    type: c.FIELD_TYPE || c.field_type || c.DATA_TYPE || '',
                                    isPk: !!(c.IS_PK || c.is_pk)
                                }))
                            });
                        }
                        resolve();
                    });
                });
            });
            await Promise.all(manualPromises);
        }

        // 3. Fetch Foreign Keys (limited to first 100 tables for safety)
        console.log(`[VISUAL-METADATA] Fetching FKs...`);
        const tablesToScanFKs = tableNames.slice(0, 100);
        const fkPromises = tablesToScanFKs.map(table => {
            return new Promise((resolve) => {
                const fkSql = dialect.metadata.foreignKeys;
                let fkParams = [table];
                if (dbType === 'firebird') fkParams = [table.toUpperCase()];

                executeQuery(req.session.dbOptions, fkSql, fkParams, (err, fks) => {
                    if (!err && Array.isArray(fks)) {
                        fks.forEach(fk => {
                            const rel = {
                                fromTable: table,
                                fromField: (fk.FIELD_NAME || fk.column_name || fk.columnName || '').trim(),
                                toTable: (fk.REF_TABLE || fk.referencedTable || fk.ref_table || '').trim(),
                                toField: (fk.REF_FIELD || fk.referencedColumn || fk.ref_field || '').trim(),
                                name: (fk.CONSTRAINT_NAME || fk.fkName || fk.constraint_name || '').trim()
                            };
                            if (rel.toTable && rel.toField) {
                                schema.relationships.push(rel);
                            }
                        });
                    }
                    resolve();
                });
            });
        });

        await Promise.all(fkPromises);
        console.log(`[VISUAL-METADATA] Success: ${schema.tables.length} tables, ${schema.relationships.length} relationships.`);
        res.json({ success: true, data: schema });

    } catch (error) {
        console.error('[VISUAL-METADATA-ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
});



// Get table usage statistics
router.get('/usage-stats', (req, res) => {
    const dbKey = `${req.session.dbOptions.host}:${req.session.dbOptions.database}`;
    const stats = tracker.getStats(dbKey);
    res.json({ success: true, data: stats });
});

module.exports = router;
