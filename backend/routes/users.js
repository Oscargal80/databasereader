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

const toStatement = (built) => (typeof built === 'string' ? { sql: built, params: [] } : built);

// Resolve the dialect's user-management section, or answer 501 when the engine has none
const userDialect = (req, res) => {
    const dialect = getSqlDialect(req.session.dbOptions.dbType);
    if (!dialect.users) {
        res.status(501).json({ success: false, message: `La gestión de usuarios no está disponible para ${req.session.dbOptions.dbType}` });
        return null;
    }
    return dialect.users;
};

const run = (req, res, build, okMessage) => {
    let statement;
    try {
        statement = toStatement(build());
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    executeQuery(req.session.dbOptions, statement.sql, statement.params, (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: okMessage });
    });
};

// List users
router.get('/users', (req, res) => {
    const users = userDialect(req, res);
    if (!users) return;

    executeQuery(req.session.dbOptions, users.list, [], (err, result) => {
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

    const users = userDialect(req, res);
    if (users) run(req, res, () => users.create(username, password), 'User created');
});

// Update user
router.put('/users/:username', (req, res) => {
    const { username } = req.params;
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password required' });

    const users = userDialect(req, res);
    if (users) run(req, res, () => users.update(username, password), 'User updated');
});

// Delete user
router.delete('/users/:username', (req, res) => {
    const { username } = req.params;

    if (username.toLowerCase() === String(req.session.dbOptions.user || '').toLowerCase()) {
        return res.status(400).json({ success: false, message: 'No puedes eliminar el usuario con el que estás conectado' });
    }

    const users = userDialect(req, res);
    if (users) run(req, res, () => users.delete(username), 'User deleted');
});

module.exports = router;
