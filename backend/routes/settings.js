const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

/**
 * @route GET /api/settings
 * @desc Get current application settings (sanitized)
 */
router.get('/settings', (req, res) => {
    try {
        const settings = {
            PORT: process.env.PORT || 5005,
            NODE_ENV: process.env.NODE_ENV || 'development',
            OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '********' : '',
            GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '********' : '',
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

        let envContent = '';
        if (fs.existsSync(ENV_PATH)) {
            envContent = fs.readFileSync(ENV_PATH, 'utf8');
        }

        const updateEnv = (key, value) => {
            if (value === undefined || value === '********') return;
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (envContent.match(regex)) {
                envContent = envContent.replace(regex, `${key}=${value}`);
            } else {
                envContent += `\n${key}=${value}`;
            }
            process.env[key] = value;
        };

        updateEnv('OPENAI_API_KEY', OPENAI_API_KEY);
        updateEnv('GEMINI_API_KEY', GEMINI_API_KEY);
        if (PORT) updateEnv('PORT', PORT);

        fs.writeFileSync(ENV_PATH, envContent.trim() + '\n');

        console.log('[SETTINGS-UPDATE] Environment updated successfully');
        res.json({ success: true, message: 'Settings updated successfully. Some changes may require a restart.' });
    } catch (err) {
        console.error('[SETTINGS-POST-ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
});

module.exports = router;
