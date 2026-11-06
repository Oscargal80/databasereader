const FirebirdDriver = require('../drivers/FirebirdDriver');
const PostgresDriver = require('../drivers/PostgresDriver');
const MysqlDriver = require('../drivers/MysqlDriver');
const MssqlDriver = require('../drivers/MssqlDriver');
const BaseDriver = require('../drivers/BaseDriver');
const { quoteIdentifier } = require('./sqlHelpers');
// Add other drivers as they are implemented

class DriverManager {
    constructor() {
        this.drivers = {
            'firebird': FirebirdDriver,
            'postgres': PostgresDriver,
            'mysql': MysqlDriver,
            'mssql': MssqlDriver,
        };
        this.activeConnections = new Map();
    }

    /**
     * Cache key: host, port, database, user and a fingerprint of the password/role,
     * so a login with a different password never reuses an authenticated driver.
     */
    connectionKey(options) {
        const dbType = options.dbType || 'firebird';
        return `${dbType}:${options.host}:${options.port}:${options.database}:${options.user}:${BaseDriver.credentialFingerprint(options)}`;
    }

    evict(options) {
        const key = this.connectionKey(options);
        const driver = this.activeConnections.get(key);
        this.activeConnections.delete(key);
        if (driver && typeof driver.close === 'function') {
            Promise.resolve(driver.close()).catch(() => { });
        }
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

        const connectionKey = this.connectionKey(options);

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

    /**
     * Run a query and return at most `limit` rows. Drivers that can stop reading early implement
     * queryLimited(); the others read everything and cut it (same memory cost as before).
     */
    async executeQueryLimited(options, sql, params, limit, callback) {
        let outcome;
        try {
            const driver = this.getDriver(options);
            if (typeof driver.queryLimited === 'function') {
                outcome = await driver.queryLimited(sql, params, limit);
            } else {
                const result = await driver.query(sql, params);
                outcome = Array.isArray(result)
                    ? { rows: result.slice(0, limit), truncated: result.length > limit, command: result.command, rowCount: result.rowCount }
                    : { rows: result, truncated: false };
            }
        } catch (err) {
            return callback(err);
        }
        callback(null, outcome);
    }

    async testConnection(options) {
        const driver = this.getDriver(options);
        try {
            return await driver.testConnection();
        } catch (err) {
            this.evict(options);
            throw err;
        }
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

// Agnostic bulk insert: a driver's own bulkInsert is preferred
const bulkInsert = async (options, tableName, columns, rows, callback) => {
    const driver = manager.getDriver(options);
    if (driver.bulkInsert) {
        return driver.bulkInsert(tableName, columns, rows, callback);
    }
    if (rows.length === 0) return callback(null, { rowCount: 0 });

    // Fallback for drivers without transactions: sequential, stops at the first error
    const quote = (name) => quoteIdentifier(name, options.dbType);
    const sql = `INSERT INTO ${quote(tableName)} (${columns.map(quote).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
    let inserted = 0;
    try {
        for (const row of rows) {
            await driver.query(sql, columns.map(col => row[col] ?? null));
            inserted++;
        }
    } catch (err) {
        return callback(new Error(`${err.message} (fila ${inserted + 1}; ${inserted} fila(s) ya insertadas, sin transacción)`));
    }
    callback(null, { rowCount: inserted });
};

const bulkUpsert = (options, tableName, columns, rows, pkColumn, callback) => {
    const driver = manager.getDriver(options);
    if (driver.bulkUpsert) {
        return driver.bulkUpsert(tableName, columns, rows, pkColumn, callback);
    }
    callback(new Error(`Upsert no soportado para ${options.dbType}`));
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
    executeQueryLimited: manager.executeQueryLimited.bind(manager),
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
