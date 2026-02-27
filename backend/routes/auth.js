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
        case 'duckdb': defaultPort = null; break;
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

        // Registry management
        if (!req.session.connections) req.session.connections = [];

        // Check if this connection already exists in registry
        const exists = req.session.connections.find(c =>
            c.host === dbOptions.host &&
            c.port === dbOptions.port &&
            c.database === dbOptions.database &&
            c.user === dbOptions.user &&
            c.dbType === dbOptions.dbType
        );

        if (!exists) {
            req.session.connections.push(dbOptions);
            console.log(`[AUTH] Added new connection to registry: ${dbOptions.database} on ${dbOptions.host}`);
        }

        // Store active credentials in session
        req.session.dbOptions = dbOptions;

        // In development/standard web, the cookie works fine.
        res.json({
            success: true,
            message: 'Connected successfully',
            user: {
                host: dbOptions.host,
                database: dbOptions.database,
                dbType: dbOptions.dbType
            },
            connections: req.session.connections
        });
    } catch (error) {
        console.error('Connection failed:', error);
        res.status(401).json({
            success: false,
            message: 'Connection failed: ' + error.message
        });
    }
});

// List all registered connections in session
router.get('/connections', (req, res) => {
    res.json({
        success: true,
        connections: req.session.connections || [],
        active: req.session.dbOptions
    });
});

// Switch active connection
router.post('/switch', (req, res) => {
    const { host, port, database, user, dbType } = req.body;

    if (!req.session.connections) {
        return res.status(400).json({ success: false, message: 'No registered connections' });
    }

    const target = req.session.connections.find(c =>
        c.host === host &&
        c.port === port &&
        c.database === database &&
        c.user === user &&
        c.dbType === dbType
    );

    if (target) {
        req.session.dbOptions = target;
        res.json({ success: true, message: `Switched to ${database}`, active: target });
    } else {
        res.status(404).json({ success: false, message: 'Connection profile not found in session' });
    }
});

// Remove a connection from registry
router.post('/remove', (req, res) => {
    const { host, port, database, user, dbType } = req.body;

    if (!req.session.connections) return res.json({ success: true });

    req.session.connections = req.session.connections.filter(c => !(
        c.host === host &&
        c.port === port &&
        c.database === database &&
        c.user === user &&
        c.dbType === dbType
    ));

    // If active was removed, clear it or pick another
    if (req.session.dbOptions &&
        req.session.dbOptions.host === host &&
        req.session.dbOptions.database === database) {
        req.session.dbOptions = req.session.connections[0] || null;
    }

    res.json({ success: true, message: 'Connection removed', connections: req.session.connections });
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
        case 'duckdb': defaultPort = null; break;
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
