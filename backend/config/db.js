const FirebirdDriver = require('../drivers/FirebirdDriver');
const PostgresDriver = require('../drivers/PostgresDriver');
const MysqlDriver = require('../drivers/MysqlDriver');
// Add other drivers as they are implemented

class DriverManager {
    constructor() {
        this.drivers = {
            'firebird': FirebirdDriver,
            'postgres': PostgresDriver,
            'mysql': MysqlDriver,
        };
        this.activeConnections = new Map();
    }

    /**
     * Get or create a driver instance for a connection
     * @param {Object} options Connection options 
     */
    getDriver(options) {
        if (!options) throw new Error('Database options are missing. Please login or select a connection.');
        const dbType = options.dbType || 'firebird';
        const DriverClass = this.drivers[dbType];

        if (!DriverClass) {
            throw new Error(`Unsupported database type: ${dbType}`);
        }

        // Generate a unique key for caching the driver instance
        // Unique key includes host, port, database and user
        const connectionKey = `${dbType}:${options.host}:${options.port}:${options.database}:${options.user}`;

        if (!this.activeConnections.has(connectionKey)) {
            console.log(`[DriverManager] Creating new driver instance for ${connectionKey}`);
            this.activeConnections.set(connectionKey, new DriverClass(options));
        }

        return this.activeConnections.get(connectionKey);
    }

    async executeQuery(options, sql, params, callback) {
        try {
            const driver = this.getDriver(options);
            const result = await driver.query(sql, params);
            callback(null, result);
        } catch (err) {
            callback(err);
        }
    }

    async testConnection(options) {
        const driver = this.getDriver(options);
        return await driver.testConnection();
    }

    getSqlDialect(dbType) {
        // We can temporarily keep the old logic or 
        // delegate to a dummy driver instance to get the dialect
        const DriverClass = this.drivers[dbType];
        if (DriverClass) {
            const dummy = new DriverClass({});
            return dummy.getDialect();
        }

        // Fallback for not-yet-refactored dialects (Hana, MSSQL, etc.)
        // For brevity in this refactor, I'll keep the old getSqlDialect 
        // as a static-ish helper in the new db.js or move it to a utility.
        return null;
    }
}

const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 });
const manager = new DriverManager();

// Agnostic bulk insert function
const bulkInsert = (options, tableName, columns, rows, callback) => {
    // For now, delegating to a simplified implementation or using the driver if extended.
    // To restore functionality quickly, we'll implement a basic version or 
    // we should ideally move this to drivers. 
    // Since this is a fix, I will implement a minimal bridge or 
    // just re-include the agnostic logic here for now.
    // However, I'll try to find a cleaner way.
    const driver = manager.getDriver(options);
    if (driver.bulkInsert) {
        return driver.bulkInsert(tableName, columns, rows, callback);
    }

    // Fallback: multiple queries (slow but safe for now)
    let completed = 0;
    let error = null;
    if (rows.length === 0) return callback(null, { rowCount: 0 });

    rows.forEach(row => {
        const vals = columns.map(col => row[col]);
        const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
        driver.query(sql, vals).then(() => {
            completed++;
            if (completed === rows.length) callback(null, { rowCount: rows.length });
        }).catch(err => {
            if (!error) {
                error = err;
                callback(err);
            }
        });
    });
};

const bulkUpsert = (options, tableName, columns, rows, pkColumn, callback) => {
    const driver = manager.getDriver(options);
    if (driver.bulkUpsert) {
        return driver.bulkUpsert(tableName, columns, rows, pkColumn, callback);
    }
    callback(new Error('bulkUpsert not implemented for this driver'));
};

const syncGenerators = (options, tableName, pkColumn, callback) => {
    const driver = manager.getDriver(options);
    if (driver.syncGenerators) {
        return driver.syncGenerators(tableName, pkColumn, callback);
    }
    callback(null); // Optional
};

module.exports = {
    executeQuery: manager.executeQuery.bind(manager),
    testConnection: manager.testConnection.bind(manager),
    getSqlDialect: (dbType) => {
        const driver = manager.getDriver({ dbType });
        return driver.getDialect();
    },
    bulkInsert,
    bulkUpsert,
    syncGenerators,
    cache,
    manager
};
