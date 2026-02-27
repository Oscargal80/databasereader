/**
 * Base Driver Interface
 */
class BaseDriver {
    constructor(options) {
        this.options = options;
        this.type = options.dbType;
    }

    /**
     * Test connection to the database
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        throw new Error('testConnection() not implemented');
    }

    /**
     * Execute a single query
     * @param {string} sql 
     * @param {Array} params 
     * @returns {Promise<Array>}
     */
    async query(sql, params) {
        throw new Error('query() not implemented');
    }

    /**
     * Get database metadata for AI context
     * @returns {Promise<Object>} { tables: [], procedures: [], views: [] }
     */
    async getMetadata() {
        throw new Error('getMetadata() not implemented');
    }

    /**
     * Get SQL dialect specific strings or functions
     * @returns {Object}
     */
    getDialect() {
        throw new Error('getDialect() not implemented');
    }
}

module.exports = BaseDriver;
