const express = require('express');
const router = express.Router();
const { executeQueryLimited } = require('../config/db');
const tracker = require('../services/usageTracker');
const { normalizeValue } = require('../config/sqlHelpers');

const DEFAULT_LIMIT = 500;
// "Traer todo" still has a ceiling: the whole result travels as JSON and lives in the browser's memory
const MAX_FETCH_ALL_ROWS = 100000;

// Middleware to check session
const checkAuth = (req, res, next) => {
    if (!req.session.dbOptions) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    next();
};

router.use(checkAuth);

// Execute custom SQL query
router.post('/execute', (req, res) => {
    const { sql, fetchAll } = req.body;

    if (!sql) {
        return res.status(400).json({ success: false, message: 'SQL query is required' });
    }

    // The driver stops reading after `limit` rows, so a SELECT over millions of rows never fills the memory
    const limit = fetchAll ? MAX_FETCH_ALL_ROWS : DEFAULT_LIMIT;

    executeQueryLimited(req.session.dbOptions, sql, [], limit, (err, outcome) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        const { rows, truncated, command, rowCount } = outcome;

        if (!Array.isArray(rows)) {
            return res.json({ success: true, data: rows });
        }

        const dbType = req.session.dbOptions.dbType;

        // Optimized cleanup: only touch what needs it (Firebird CHAR padding, Date rendering)
        const data = rows.map(row => {
            const cleanRow = {};
            const keys = Object.keys(row);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                cleanRow[key] = normalizeValue(row[key], dbType);
            }
            return cleanRow;
        });

        // Try to track table usage from SQL
        try {
            const dbKey = `${req.session.dbOptions.host}:${req.session.dbOptions.database}`;
            const tableMatches = sql.match(/(FROM|JOIN)\s+([a-zA-Z0-9_$"]+)/gi);
            if (tableMatches) {
                tableMatches.forEach(match => {
                    const tbl = match.split(/\s+/)[1].replace(/"/g, '').toUpperCase();
                    tracker.track(dbKey, tbl);
                });
            }
        } catch (e) {
            console.warn('[SQL-Usage] Failed to parse SQL for usage tracking:', e.message);
        }

        res.json({
            success: true,
            data,
            truncated,
            // The real total is unknown when reading stopped early
            totalRows: truncated ? null : data.length,
            limit,
            capped: Boolean(fetchAll && truncated),
            command,
            rowCount
        });
    });
});

module.exports = router;
