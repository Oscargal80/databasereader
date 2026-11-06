const express = require('express');
const router = express.Router();
const { inspectSystem } = require('../services/requirements');

// Public on purpose: it is shown before anyone signs in ("what do I need to install?")
router.get('/', async (req, res) => {
    try {
        res.json({ success: true, ...(await inspectSystem()) });
    } catch (err) {
        console.error('[REQUIREMENTS]', err.message);
        res.status(500).json({ success: false, message: 'No se pudo revisar el sistema: ' + err.message });
    }
});

module.exports = router;
