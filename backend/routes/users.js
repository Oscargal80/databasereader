const express = require('express');
const router = express.Router();
const { executeQuery, getSqlDialect } = require('../config/db');

// Middleware to check session
const checkAuth = (req, res, next) => {
    if (!req.session.dbOptions) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    next();
};

router.use(checkAuth);

// List users
router.get('/users', (req, res) => {
    const dialect = getSqlDialect(req.session.dbOptions.dbType);
    const sql = dialect.users.list;
    const isPostgres = req.session.dbOptions.dbType === 'postgres';

    executeQuery(req.session.dbOptions, sql, [], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({
            success: true,
            data: result.map(u => ({
                username: (u.USERNAME || u.username || '').trim(),
                firstName: u.SEC$FIRST_NAME?.trim(),
                lastName: u.SEC$LAST_NAME?.trim()
            }))
        });
    });
});

// Create user
router.post('/users', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required' });

    const dialect = getSqlDialect(req.session.dbOptions.dbType);
    const sql = dialect.users.create(username, password);
    executeQuery(req.session.dbOptions, sql, [], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'User created' });
    });
});

// Delete user
router.delete('/users/:username', (req, res) => {
    const { username } = req.params;
    const dialect = getSqlDialect(req.session.dbOptions.dbType);
    const sql = dialect.users.delete(username);
    executeQuery(req.session.dbOptions, sql, [], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'User deleted' });
    });
});

module.exports = router;
