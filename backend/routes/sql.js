const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');
const tracker = require('../services/usageTracker');

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
    const DEFAULT_LIMIT = 500;

    if (!sql) {
        return res.status(400).json({ success: false, message: 'SQL query is required' });
    }

    // Attempt to inject limit if not fetching all and no limit present (very basic check)
    let processedSql = sql;
    // Note: Injecting limits is brittle via regex, but we'll trust the driver's query method for now.
    // However, the best way is to let the driver handle it or just truncate the array in JS.
    // Truncating in JS saves network/browser memory but not DB memory.
    // For now, let's truncate in JS to fix the "crashes/cuts off" issue which is often network/JSON serialization.

    executeQuery(req.session.dbOptions, sql, [], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        if (!Array.isArray(result)) {
            return res.json({ success: true, data: result });
        }

        const totalCount = result.length;
        const shouldTruncate = !fetchAll && totalCount > DEFAULT_LIMIT;
        const dataToProcess = shouldTruncate ? result.slice(0, DEFAULT_LIMIT) : result;

        // Optimized cleanup: only trip if it's a string and avoid heavy object creation if not needed
        const data = dataToProcess.map(row => {
            const cleanRow = {};
            const keys = Object.keys(row);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const val = row[key];
                cleanRow[key] = (typeof val === 'string') ? val.trim() : val;
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
            truncated: shouldTruncate,
            totalRows: totalCount,
            limit: DEFAULT_LIMIT
        });
    });
});

module.exports = router;
