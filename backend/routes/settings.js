const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const { SETTINGS_FILE } = require('../config/paths');

/**
 * @route GET /api/settings
 * @desc Get current application settings (sanitized)
 */
router.get('/settings', (req, res) => {
    try {
        let savedSettings = {};
        if (fs.existsSync(SETTINGS_FILE)) {
            const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
            if (content.trim()) {
                try {
                    savedSettings = JSON.parse(content);
                } catch (e) {
                    console.error('[SETTINGS-PARSE-ERROR]', e);
                }
            }
        }

        const settings = {
            PORT: savedSettings.PORT || process.env.PORT || 5005,
            NODE_ENV: process.env.NODE_ENV || 'development',
            OPENAI_API_KEY: (savedSettings.OPENAI_API_KEY || process.env.OPENAI_API_KEY) ? '********' : '',
            GEMINI_API_KEY: (savedSettings.GEMINI_API_KEY || process.env.GEMINI_API_KEY) ? '********' : '',
        };
        res.json({ success: true, settings });
    } catch (err) {
        console.error('[SETTINGS-GET-ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve settings' });
    }
});

/**
 * @route POST /api/settings
 * @desc Update application settings
 */
router.post('/settings', (req, res) => {
    try {
        const { OPENAI_API_KEY, GEMINI_API_KEY, PORT } = req.body;

        let settings = {};
        if (fs.existsSync(SETTINGS_FILE)) {
            const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
            if (content.trim()) {
                try {
                    settings = JSON.parse(content);
                } catch (e) {
                    console.error('[SETTINGS-PARSE-ERROR]', e);
                }
            }
        }

        if (OPENAI_API_KEY && OPENAI_API_KEY !== '********') {
            settings.OPENAI_API_KEY = OPENAI_API_KEY;
            process.env.OPENAI_API_KEY = OPENAI_API_KEY;
        }
        if (GEMINI_API_KEY && GEMINI_API_KEY !== '********') {
            settings.GEMINI_API_KEY = GEMINI_API_KEY;
            process.env.GEMINI_API_KEY = GEMINI_API_KEY;
        }
        if (PORT) {
            settings.PORT = PORT;
            process.env.PORT = PORT;
        }

        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));

        console.log('[SETTINGS-UPDATE] Settings updated in persistent storage');
        res.json({ success: true, message: 'Settings updated successfully.' });
    } catch (err) {
        console.error('[SETTINGS-POST-ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to update settings: ' + err.message });
    }
});

module.exports = router;
