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
    const dialect = getSqlDialect(req.session.dbOptions.dbType);
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
                results[key] = result.map(r => (r.NAME || r.name || '').trim());
            }

            completed++;
            if (completed === keys.length) {
                res.json({ success: true, data: results });
            }
        });
    });
});

// Get table structure (enhanced)
router.get('/structure/:tableName', (req, res) => {
    const { tableName } = req.params;
    const dialect = getSqlDialect(req.session.dbOptions.dbType);
    const sql = dialect.structure;
    const isPostgres = req.session.dbOptions.dbType === 'postgres';
    const params = isPostgres ? [tableName, tableName] : [tableName.toUpperCase()];

    console.log(`Fetching structure for table: ${tableName}`);
    console.log(`Structure SQL: ${sql}`);
    console.log(`Params: ${JSON.stringify(params)}`);

    executeQuery(req.session.dbOptions, sql, params, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        const typeMap = {
            7: 'SMALLINT', 8: 'INTEGER', 10: 'FLOAT', 12: 'DATE', 13: 'TIME',
            14: 'CHAR', 16: 'BIGINT', 27: 'DOUBLE PRECISION', 35: 'TIMESTAMP',
            37: 'VARCHAR', 40: 'CSTRING', 261: 'BLOB'
        };

        const structure = result.map(row => ({
            name: (row.FIELD_NAME || row.field_name || '').trim(),
            type: isPostgres ? row.field_type : (typeMap[row.FIELD_TYPE] || `TYPE_${row.FIELD_TYPE}`),
            length: row.FIELD_LENGTH || row.field_length,
            precision: row.FIELD_PRECISION,
            scale: row.FIELD_SCALE,
            nullable: isPostgres ? row.is_nullable === 'YES' : row.NULL_FLAG !== 1,
            isPk: !!(row.IS_PK || row.is_pk),
            isFk: !!(row.IS_FK || row.is_fk)
        }));

        res.json({ success: true, data: structure });
    });
});

// Get table metadata (Indexes, FKs, Dependencies)
router.get('/metadata/:tableName', (req, res) => {
    const { tableName } = req.params;
    const upperTable = tableName.toUpperCase();

    const queries = {
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
    };

    const results = {};
    const keys = Object.keys(queries);
    let completed = 0;

    keys.forEach(key => {
        executeQuery(req.session.dbOptions, queries[key], [upperTable], (err, result) => {
            if (err) {
                console.error(`Error fetching ${key}:`, err.message);
                results[key] = []; // Return empty array on error
            } else {
                results[key] = result.map(row => {
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
