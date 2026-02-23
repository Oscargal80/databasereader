const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { bulkInsert, bulkUpsert, syncGenerators } = require('../config/db');
const { STAGING_DIR } = require('../config/paths');

// Ensure staging directory exists
if (!fs.existsSync(STAGING_DIR)) {
    fs.mkdirSync(STAGING_DIR, { recursive: true });
}

// Middleware to check session
const checkAuth = (req, res, next) => {
    if (!req.session.dbOptions) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    next();
};

router.use(checkAuth);

/**
 * @route POST /api/import/stage/:tableName
 * @desc Save mapping, data and import mode to staging file
 */
router.post('/stage/:tableName', (req, res) => {
    const { tableName } = req.params;
    const { data, mapping, importMode, pkColumn } = req.body;
    const sessionId = req.sessionID;

    if (!data || !mapping) {
        return res.status(400).json({ success: false, message: 'Data and mapping are required' });
    }

    const fileName = `${sessionId}_${tableName}.json`;
    const filePath = path.join(STAGING_DIR, fileName);

    try {
        fs.writeFileSync(filePath, JSON.stringify({
            tableName,
            mapping,
            data,
            importMode: importMode || 'insert',
            pkColumn: pkColumn || null
        }));
        res.json({ success: true, message: 'Data staged successfully', rowCount: data.length });
    } catch (err) {
        console.error('[IMPORT-STAGE-ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to stage data' });
    }
});

/**
 * @route GET /api/import/stage/:tableName
 * @desc Get staged data for preview
 */
router.get('/stage/:tableName', (req, res) => {
    const { tableName } = req.params;
    const sessionId = req.sessionID;
    const fileName = `${sessionId}_${tableName}.json`;
    const filePath = path.join(STAGING_DIR, fileName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'No staged data found' });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const staged = JSON.parse(content);
        res.json({ success: true, data: staged });
    } catch (err) {
        console.error('[IMPORT-PREVIEW-ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to read staged data' });
    }
});

/**
 * @route POST /api/import/commit/:tableName
 * @desc Commit staged data to the database using bulk insert or upsert
 */
router.post('/commit/:tableName', (req, res) => {
    const { tableName } = req.params;
    const sessionId = req.sessionID;
    const fileName = `${sessionId}_${tableName}.json`;
    const filePath = path.join(STAGING_DIR, fileName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'No staged data found to commit' });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const { mapping, data, importMode, pkColumn } = JSON.parse(content);

        if (!data || data.length === 0) {
            return res.status(400).json({ success: false, message: 'Staged data is empty' });
        }

        const columns = Object.values(mapping).filter(v => v !== "");
        const rows = data.map(row => {
            const mappedRow = {};
            Object.keys(mapping).forEach(excelCol => {
                if (mapping[excelCol]) {
                    mappedRow[mapping[excelCol]] = row[excelCol];
                }
            });
            return mappedRow;
        });

        const callback = (err, result) => {
            if (err) {
                console.error('[IMPORT-COMMIT-ERROR]', err);
                return res.status(500).json({ success: false, message: 'Migration failed: ' + err.message });
            }

            // Sync generators/sequences after import to prevent collision if PKs were manual or upserted
            // We look for a PK column in mapping if not explicitly provided
            const targetPk = pkColumn || columns.find(c => c.toLowerCase() === 'id' || c.toLowerCase().includes('_id'));

            if (targetPk) {
                syncGenerators(req.session.dbOptions, tableName, targetPk, (syncErr) => {
                    if (syncErr) console.warn('[SYNC-GEN-WARN] Failed to sync generators:', syncErr.message);

                    // Cleanup staging file on success
                    fs.unlinkSync(filePath);
                    res.json({ success: true, message: `Successfully imported ${result.rowCount} rows`, rowCount: result.rowCount });
                });
            } else {
                fs.unlinkSync(filePath);
                res.json({ success: true, message: `Successfully imported ${result.rowCount} rows`, rowCount: result.rowCount });
            }
        };

        if (importMode === 'upsert' && pkColumn) {
            bulkUpsert(req.session.dbOptions, tableName, columns, rows, pkColumn, callback);
        } else {
            bulkInsert(req.session.dbOptions, tableName, columns, rows, callback);
        }

    } catch (err) {
        console.error('[IMPORT-COMMIT-ERROR]', err);
        res.status(500).json({ success: false, message: 'Internal server error during commit' });
    }
});

/**
 * @route POST /api/import/rollback/:tableName
 * @desc Discard staged data
 */
router.post('/rollback/:tableName', (req, res) => {
    const { tableName } = req.params;
    const sessionId = req.sessionID;
    const fileName = `${sessionId}_${tableName}.json`;
    const filePath = path.join(STAGING_DIR, fileName);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'Staged data discarded' });
    } else {
        res.status(404).json({ success: false, message: 'No staged data found' });
    }
});

module.exports = router;
