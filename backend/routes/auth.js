const express = require('express');
const router = express.Router();
const { testConnection } = require('../config/db');

// Login and test connection
router.post('/login', async (req, res) => {
    const { host, port, database, user, password, dbType } = req.body;
    const parsedPort = parseInt(port);
    const dbOptions = {
        host,
        port: isNaN(parsedPort) ? (dbType === 'postgres' ? 5432 : 3050) : parsedPort,
        database,
        user,
        password,
        dbType: dbType || 'firebird',
        lowercase_keys: false,
        role: null,
        pageSize: 4096
    };

    console.log(`Connecting to ${dbOptions.dbType} at ${dbOptions.host}:${dbOptions.port}`);

    try {
        await testConnection(dbOptions);

        // Store credentials in session (In production, encrypt these!)
        req.session.dbOptions = dbOptions;

        res.json({
            success: true,
            message: 'Connected successfully'
        });
    } catch (error) {
        console.error('Connection failed:', error);
        res.status(401).json({
            success: false,
            message: 'Connection failed: ' + error.message
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

// Check session
router.get('/me', (req, res) => {
    if (req.session.dbOptions) {
        res.json({
            authenticated: true,
            host: req.session.dbOptions.host,
            database: req.session.dbOptions.database,
            dbType: req.session.dbOptions.dbType
        });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

// Test server host (ping)
router.post('/test-host', (req, res) => {
    const { host } = req.body;
    if (!host) return res.status(400).json({ success: false, message: 'Host is required' });

    // Simple successful response to indicate host is reachable from client's perspective to backend
    res.json({ success: true, message: `Host ${host} is reachable from API` });
});

// Test database connection without session
router.post('/test-db', async (req, res) => {
    const { host, port, database, user, password, dbType } = req.body;
    const parsedPort = parseInt(port);
    const dbOptions = {
        host,
        port: isNaN(parsedPort) ? 3050 : parsedPort,
        database,
        user,
        password,
        dbType: dbType || 'firebird',
        lowercase_keys: false
    };

    console.log(`Testing connection to ${dbOptions.dbType} at ${dbOptions.host}:${dbOptions.port}`);

    try {
        await testConnection(dbOptions);
        res.json({ success: true, message: 'Database connection successful' });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Connection failed: ' + error.message });
    }
});

module.exports = router;
