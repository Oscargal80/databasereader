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
    const { sql } = req.body;

    if (!sql) {
        return res.status(400).json({ success: false, message: 'SQL query is required' });
    }

    executeQuery(req.session.dbOptions, sql, [], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        // Clean up results
        const data = Array.isArray(result) ? result.map(row => {
            const cleanRow = {};
            for (let key in row) {
                cleanRow[key] = (typeof row[key] === 'string') ? row[key].trim() : row[key];
            }
            return cleanRow;
        }) : result;

        // Try to track table usage from SQL
        try {
            const dbKey = `${req.session.dbOptions.host}:${req.session.dbOptions.database}`;
            // Simple regex for FROM and JOIN
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
            data
        });
    });
});

module.exports = router;
