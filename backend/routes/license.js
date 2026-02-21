const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');

// The file where the valid license will be stored permanently
const LICENSE_FILE = path.join(__dirname, '..', 'data', '.license');

// Helper: Ensure data directory exists
const ensureDataDir = () => {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }
};

// Helper: Get HWID formatted natively
const getMachineCode = () => {
    try {
        const id = machineIdSync({ original: true });
        // Format as XXXX-XXXX-XXXX
        const cleanId = id.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return `${cleanId.substring(0, 4)}-${cleanId.substring(4, 8)}-${cleanId.substring(8, 12)}`;
    } catch (e) {
        return "ERROR-HWID-NULL";
    }
};

// Helper: The Secret Formula to validate licenses based on HWID
// Formula: SHA256(MachineCode + BINARIAOS2026).substring(0, 16) formatted as XXXXX-XXXXX-XXXXX
const generateExpectedKey = (machineCode) => {
    const hash = crypto.createHash('sha256').update(`${machineCode}-BINARIAOS2026`).digest('hex').toUpperCase();
    return `${hash.substring(0, 5)}-${hash.substring(5, 10)}-${hash.substring(10, 15)}`;
};

/**
 * @route GET /api/license/status
 * @desc Get current HWID and license status
 */
router.get('/status', (req, res) => {
    try {
        const machineCode = getMachineCode();
        let isLicensed = false;

        if (fs.existsSync(LICENSE_FILE)) {
            const currentKey = fs.readFileSync(LICENSE_FILE, 'utf8').trim();
            const expectedKey = generateExpectedKey(machineCode);
            if (currentKey === expectedKey) {
                isLicensed = true;
            }
        }

        res.json({
            success: true,
            machineCode,
            isLicensed
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * @route POST /api/license/activate
 * @desc Validate and store a provided Activation Key
 */
router.post('/activate', (req, res) => {
    try {
        const { key } = req.body;
        if (!key) throw new Error("Key is missing.");

        const machineCode = getMachineCode();
        const expectedKey = generateExpectedKey(machineCode);

        // Standardize input format
        const cleanInputKey = key.trim().toUpperCase();

        if (cleanInputKey === expectedKey) {
            ensureDataDir();
            fs.writeFileSync(LICENSE_FILE, cleanInputKey);
            return res.json({ success: true, message: "License Activated Successfully" });
        } else {
            return res.status(401).json({ success: false, message: "Invalid Activation Key for this Machine" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * @route GET /api/license/generate
 * @desc Internal admin utility to test key generation (Should be removed in real production)
 */
router.get('/generate', (req, res) => {
    const hwid = req.query.hwid || getMachineCode();
    res.json({
        hwid,
        key: generateExpectedKey(hwid)
    });
});

module.exports = router;
