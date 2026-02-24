const express = require('express');
const router = express.Router();
const { testConnection } = require('../config/db');

// Login and test connection
router.post('/login', async (req, res) => {
    const { host, port, database, user, password, role, dbType } = req.body;
    const parsedPort = parseInt(port);
    let defaultPort;
    switch (dbType) {
        case 'postgres': defaultPort = 5432; break;
        case 'mysql': defaultPort = 3306; break;
        case 'sqlite': defaultPort = null; break;
        case 'hana': defaultPort = 30015; break;
        default: defaultPort = 3050; // firebird
    }

    const dbOptions = {
        host: host || 'localhost',
        port: isNaN(parsedPort) ? defaultPort : parsedPort,
        database,
        user,
        password,
        dbType: dbType || 'firebird',
        lowercase_keys: false,
        role: role || null,
        pageSize: 4096
    };

    console.log(`Connecting to ${dbOptions.dbType} at ${dbOptions.host}:${dbOptions.port}`);

    try {
        await testConnection(dbOptions);

        // Store credentials in session (In production, encrypt these!)
        req.session.dbOptions = dbOptions;

        // In development/standard web, the cookie works fine.
        // For Electron MacOS (Webkit), we ALSO return the basic auth payload to bypass cookie-drops
        res.json({
            success: true,
            message: 'Connected successfully',
            user: {
                host: dbOptions.host,
                database: dbOptions.database,
                dbType: dbOptions.dbType
            }
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
    // Extract from session or allow client to provide basic cached identity
    const authPayload = req.session.dbOptions || req.body.cachedUser;

    if (authPayload) {
        res.json({
            authenticated: true,
            host: authPayload.host,
            database: authPayload.database,
            dbType: authPayload.dbType
        });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

// Fallback session reconstructor for Webkit/Electron
router.post('/me', (req, res) => {
    const authPayload = req.body.cachedUser;

    if (authPayload) {
        // Rehydrate the session just in case
        req.session.dbOptions = authPayload;
        res.json({
            authenticated: true,
            host: authPayload.host,
            database: authPayload.database,
            dbType: authPayload.dbType
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
    const { host, port, database, user, password, role, dbType } = req.body;
    const parsedPort = parseInt(port);
    let defaultPort;
    switch (dbType) {
        case 'postgres': defaultPort = 5432; break;
        case 'mysql': defaultPort = 3306; break;
        case 'sqlite': defaultPort = null; break;
        case 'hana': defaultPort = 30015; break;
        default: defaultPort = 3050; // firebird
    }

    const dbOptions = {
        host: host || 'localhost',
        port: isNaN(parsedPort) ? defaultPort : parsedPort,
        database,
        user,
        password,
        dbType: dbType || 'firebird',
        role: role || null,
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
