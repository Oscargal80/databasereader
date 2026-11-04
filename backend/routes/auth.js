const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const { testConnection } = require('../config/db');

const publicConnection = ({ password, ...connection }) => connection;

// Per-IP limit on the endpoints that can be used to guess credentials or probe hosts
const ATTEMPT_WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 20;
const attempts = new Map();

const limitAttempts = (req, res, next) => {
    const now = Date.now();
    const recent = (attempts.get(req.ip) || []).filter(time => now - time < ATTEMPT_WINDOW_MS);

    if (recent.length >= MAX_ATTEMPTS) {
        return res.status(429).json({ success: false, message: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.' });
    }

    recent.push(now);
    attempts.set(req.ip, recent);
    if (attempts.size > 1000) {
        attempts.forEach((times, ip) => { if (now - times[times.length - 1] > ATTEMPT_WINDOW_MS) attempts.delete(ip); });
    }
    next();
};

// Login and test connection
router.post('/login', limitAttempts, async (req, res) => {
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
            connections: req.session.connections.map(publicConnection)
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
        connections: (req.session.connections || []).map(publicConnection),
        active: req.session.dbOptions ? publicConnection(req.session.dbOptions) : null
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
        res.json({ success: true, message: `Switched to ${database}`, active: publicConnection(target) });
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

    res.json({ success: true, message: 'Connection removed', connections: req.session.connections.map(publicConnection) });
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

// Check session
router.get('/me', (req, res) => {
    const active = req.session.dbOptions;

    if (active) {
        res.json({
            authenticated: true,
            host: active.host,
            database: active.database,
            dbType: active.dbType
        });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

// Test server host (ping)
const HOST_PATTERN = /^(?!-)[A-Za-z0-9._:-]{1,253}$/;

router.post('/test-host', limitAttempts, (req, res) => {
    const { host } = req.body;
    if (!host) return res.status(400).json({ success: false, message: 'Host is required' });
    if (typeof host !== 'string' || !HOST_PATTERN.test(host)) {
        return res.status(400).json({ success: false, message: 'Host inválido' });
    }

    // Mac/Linux use -c 1, Windows uses -n 1
    const isWindows = process.platform === 'win32';
    const args = isWindows ? ['-n', '1', host] : ['-c', '1', '-W', '2', host];

    execFile('ping', args, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Ping failed for ${host}:`, stderr || error.message);
            return res.status(404).json({
                success: false,
                message: `Host ${host} is not reachable from API. ${stderr || error.message}`
            });
        }
        res.json({ success: true, message: `Host ${host} is reachable from API server` });
    });
});

// Test database connection without session
router.post('/test-db', limitAttempts, async (req, res) => {
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
