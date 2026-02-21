require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const dbRoutes = require('./routes/db');
const crudRoutes = require('./routes/crud');
const sqlRoutes = require('./routes/sql');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Prevent the process from crashing on external library errors (e.g. Firebird on Node v25)
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow all origins for the MVP to avoid CORS issues
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true
}));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    next();
});

app.set('trust proxy', 1);

app.use(bodyParser.json());
app.use(session({
    secret: 'firebird-admin-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Force false because Electron runs over HTTP localhost, not HTTPS
        sameSite: false // Force false so Webkit doesn't drop cross-origin-like local requests
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
app.use('/api/license', require('./routes/license'));

// Serve frontend static files in production
app.use(express.static(path.join(__dirname, 'frontend-dist')));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// Only listen if executed directly (e.g., node server.js)
// Otherwise, export for testing or Electron hosting
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
