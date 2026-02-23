const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');

const MASTER_KEY = 'BINARIA-ADMIN-2026';
const { LICENSE_FILE, APP_DATA_DIR } = require('../config/paths');

// Helper: Ensure data directory exists
const ensureDataDir = () => {
    if (!fs.existsSync(APP_DATA_DIR)) {
        fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    }
};

// Helper: Get HWID (resilient)
const getMachineCode = () => {
    try {
        const id = machineIdSync({ original: true });
        if (!id) return "NO-HWID-FOUND";
        const cleanId = String(id).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return `${cleanId.substring(0, 4)}-${cleanId.substring(4, 8)}-${cleanId.substring(8, 12)}`;
    } catch (e) {
        console.error('[HWID-ERROR]', e.message);
        return "ERROR-HWID-NULL";
    }
};

/**
 * @route GET /api/sys-check/status
 */
router.get('/status', (req, res) => {
    try {
        console.log(`[SYS-CHECK] GET /status - Checking ${LICENSE_FILE}`);
        let isLicensed = false;

        if (fs.existsSync(LICENSE_FILE)) {
            const currentKey = fs.readFileSync(LICENSE_FILE, 'utf8').trim();
            console.log(`[SYS-CHECK] Found key: ${currentKey}`);
            if (currentKey === MASTER_KEY) {
                isLicensed = true;
            }
        } else {
            console.log('[SYS-CHECK] No license file found.');
        }

        const machineCode = getMachineCode();
        res.json({
            success: true,
            machineCode,
            isLicensed
        });
    } catch (err) {
        console.error('[SYS-CHECK] STATUS CRASH:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route POST /api/sys-check/activate
 */
router.post('/activate', (req, res) => {
    try {
        console.log(`[SYS-CHECK] POST /activate - Body:`, req.body);
        const { key } = req.body;
        if (!key) throw new Error("Key is missing.");

        const cleanInputKey = String(key).trim().toUpperCase();

        if (cleanInputKey === MASTER_KEY) {
            ensureDataDir();
            fs.writeFileSync(LICENSE_FILE, cleanInputKey);
            console.log('[SYS-CHECK] Activation successful!');
            return res.json({ success: true, message: "System Activated Successfully" });
        } else {
            console.log(`[SYS-CHECK] Invalid key attempt: ${cleanInputKey}`);
            return res.status(401).json({ success: false, message: "Invalid Activation Key" });
        }
    } catch (err) {
        console.error('[SYS-CHECK] ACTIVATE CRASH:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
