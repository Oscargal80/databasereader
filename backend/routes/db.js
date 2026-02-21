const express = require('express');
const router = express.Router();
const { executeQuery, getSqlDialect } = require('../config/db');

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
                res.json({ success: true, data: results });
            }
        });
    });
});

module.exports = router;
