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

// GET - List data from table with pagination
router.get('/:tableName', (req, res) => {
    const { tableName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const dialect = getSqlDialect(req.session.dbOptions.dbType);
    const sql = dialect.pagination(tableName, limit, skip);
    const countSql = `SELECT COUNT(*) AS TOTAL_CNT FROM ${tableName}`;

    console.log(`Executing CRUD list - Table: ${tableName}, Page: ${page}, Limit: ${limit}`);
    console.log(`Count SQL: ${countSql}`);
    console.log(`Select SQL: ${sql}`);

    executeQuery(req.session.dbOptions, countSql, [], (err, countResult) => {
        if (err) {
            console.error('Count query error:', err);
            return res.status(500).json({ success: false, message: 'Count error: ' + err.message });
        }

        // Handle possible case variations for TOTAL_CNT (Firebird/Postgres)
        const total = countResult && countResult[0]
            ? (countResult[0].TOTAL_CNT || countResult[0].total_cnt || countResult[0].TOTAL || parseInt(countResult[0].count) || 0)
            : 0;

        executeQuery(req.session.dbOptions, sql, [], (err, result) => {
            if (err) {
                console.error('Select query error:', err);
                return res.status(500).json({ success: false, message: 'Select error: ' + err.message });
            }

            if (!Array.isArray(result)) {
                return res.json({ success: true, data: [], pagination: { total, page, limit, totalPages: 0 } });
            }

            // Clean up Firebird buffer results if any
            const data = result.map(row => {
                const cleanRow = {};
                for (let key in row) {
                    cleanRow[key] = (typeof row[key] === 'string') ? row[key].trim() : row[key];
                }
                return cleanRow;
            });

            res.json({
                success: true,
                data,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        });
    });
});

// POST - Insert record
router.post('/:tableName', (req, res) => {
    const { tableName } = req.params;
    const data = req.body;
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');

    const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;

    executeQuery(req.session.dbOptions, sql, values, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Record inserted' });
    });
});

// DELETE - Delete record (requires PK in query)
router.delete('/:tableName', (req, res) => {
    const { tableName } = req.params;
    const { pkField, pkValue } = req.query;

    if (!pkField || !pkValue) {
        return res.status(400).json({ success: false, message: 'pkField and pkValue are required' });
    }

    const sql = `DELETE FROM ${tableName} WHERE ${pkField} = ?`;

    executeQuery(req.session.dbOptions, sql, [pkValue], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Record deleted' });
    });
});

module.exports = router;
