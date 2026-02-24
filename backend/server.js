const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load persistent settings if they exist
try {
    const { SETTINGS_FILE } = require('./config/paths');
    if (fs.existsSync(SETTINGS_FILE)) {
        const savedSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        Object.keys(savedSettings).forEach(key => {
            const value = savedSettings[key];
            if (value && String(value).trim() !== '') {
                process.env[key] = value;
            }
        });
        console.log('[SERVER-STARTUP] Persistent settings loaded.');
    }
} catch (e) {
    console.warn('[SERVER-STARTUP] Failed to load persistent settings:', e.message);
}
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const dbRoutes = require('./routes/db');
const crudRoutes = require('./routes/crud');
const sqlRoutes = require('./routes/sql');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5005;

// Prevent the process from crashing on external library errors (e.g. Firebird on Node v25)
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

// Middleware
app.use(cors({
    origin: true, // Allow current origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use((req, res, next) => {
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Connectivity test route
app.get('/api/ping', (req, res) => {
    res.json({ success: true, message: 'pong', time: new Date().toISOString() });
});

app.set('trust proxy', 1);

app.use(bodyParser.json());
app.use(session({
    secret: 'firebird-admin-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Force false because Electron runs over HTTP localhost, not HTTPS
        sameSite: 'lax' // 'lax' is well supported for local cookies; 'none' requires secure:true
    }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/db', require('./routes/db'));
app.use('/api/crud', require('./routes/crud'));
app.use('/api/sql', require('./routes/sql'));
app.use('/api/users', require('./routes/users'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/queries', require('./routes/queries'));
app.use('/api/sys-check', require('./routes/license'));
app.use('/api/import', require('./routes/import'));
app.use('/api', require('./routes/settings'));

// Production Documentation Route
app.get('/api/docs/readme', (req, res) => {
    res.sendFile(path.join(__dirname, 'README_PROD.md'));
});

// Serve frontend static files in production
const staticPath = path.join(__dirname, 'frontend-dist');
console.log('Serving static files from:', staticPath);
app.use(express.static(staticPath));

// SPA Wildcard fallback - use a middleware at the end to catch all non-matched routes
app.use((req, res, next) => {
    // If it's an API call that wasn't matched, let it go to error handler
    if (req.url.startsWith('/api')) return next();

    // Log if we are falling back for what looks like an asset
    if (req.url.includes('.') && !req.url.endsWith('.html')) {
        console.warn(`Fallback triggered for asset: ${req.url}`);
    }

    res.sendFile(path.join(staticPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(`[SERVER-ERROR] ${new Date().toISOString()}: ${req.method} ${req.url}`);
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        path: req.url,
        method: req.method
    });
});

// Start the server
if (require.main === module) {
    app.listen(PORT, '127.0.0.1', () => {
        console.log(`Server running on port ${PORT} (local loopback)`);
    });
}

module.exports = app;
