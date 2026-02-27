const Firebird = require('node-firebird');
const BaseDriver = require('./BaseDriver');

/**
 * Firebird Database Driver
 */
class FirebirdDriver extends BaseDriver {
    async testConnection() {
        return new Promise((resolve, reject) => {
            Firebird.attach({
                host: this.options.host,
                port: this.options.port,
                database: this.options.database,
                user: this.options.user,
                password: this.options.password,
                role: this.options.role || null
            }, (err, db) => {
                if (err) return reject(err);
                db.detach();
                resolve(true);
            });
        });
    }

    async query(sql, params) {
        return new Promise((resolve, reject) => {
            Firebird.attach({
                host: this.options.host,
                port: this.options.port,
                database: this.options.database,
                user: this.options.user,
                password: this.options.password,
                role: this.options.role || null,
                lowercase_keys: this.options.lowercase_keys
            }, (err, db) => {
                if (err) return reject(err);
                db.query(sql, params, (err, result) => {
                    db.detach();
                    if (err) return reject(err);
                    resolve(result);
                });
            });
        });
    }

    async getMetadata() {
        const metadataSql = `
            SELECT 
                rf.RDB$RELATION_NAME AS TABLE_NAME,
                rf.RDB$FIELD_NAME AS FIELD_NAME,
                f.RDB$FIELD_SOURCE AS FIELD_TYPE
            FROM RDB$RELATION_FIELDS rf
            JOIN RDB$RELATIONS r ON rf.RDB$RELATION_NAME = r.RDB$RELATION_NAME
            JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
            WHERE r.RDB$SYSTEM_FLAG = 0 AND r.RDB$VIEW_BLR IS NULL
            ORDER BY rf.RDB$RELATION_NAME, rf.RDB$FIELD_POSITION
        `;
        const rows = await this.query(metadataSql, []);

        // Group by table
        const tables = {};
        rows.forEach(row => {
            const tName = row.TABLE_NAME.trim();
            const fName = row.FIELD_NAME.trim();
            if (!tables[tName]) tables[tName] = [];
            tables[tName].push(fName);
        });

        // Get procedures
        const procSql = `SELECT RDB$PROCEDURE_NAME as NAME FROM RDB$PROCEDURES`;
        const procs = await this.query(procSql, []);

        return {
            tables,
            procedures: procs.map(p => p.NAME.trim())
        };
    }

    getDialect() {
        return {
            explorer: {
                userTables: 'SELECT RDB$RELATION_NAME as NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_BLR IS NULL ORDER BY 1',
                systemTables: 'SELECT RDB$RELATION_NAME as NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 1 ORDER BY 1',
                views: 'SELECT RDB$RELATION_NAME as NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_BLR IS NOT NULL ORDER BY 1',
                materializedViews: 'SELECT CAST(\'No disponible\' AS VARCHAR(20)) as NAME FROM RDB$DATABASE WHERE 1=0',
                procedures: 'SELECT RDB$PROCEDURE_NAME as NAME FROM RDB$PROCEDURES ORDER BY 1',
                triggers: 'SELECT RDB$TRIGGER_NAME as NAME FROM RDB$TRIGGERS ORDER BY 1',
                generators: 'SELECT RDB$GENERATOR_NAME as NAME FROM RDB$GENERATORS WHERE RDB$SYSTEM_FLAG = 0 ORDER BY 1',
                reports: 'SELECT name FROM (SELECT \'MON$DATABASE\' as name FROM RDB$DATABASE UNION SELECT \'MON$ATTACHMENTS\' FROM RDB$DATABASE UNION SELECT \'MON$STATEMENTS\' FROM RDB$DATABASE UNION SELECT \'MON$TRANSACTIONS\' FROM RDB$DATABASE UNION SELECT \'MON$IO_STATS\' FROM RDB$DATABASE) ORDER BY 1'
            },
            metadata: {
                indexes: `
                    SELECT 
                        ix.RDB$INDEX_NAME AS INDEX_NAME,
                        iseg.RDB$FIELD_NAME AS FIELD_NAME,
                        ix.RDB$UNIQUE_FLAG AS IS_UNIQUE
                    FROM RDB$INDICES ix
                    JOIN RDB$INDEX_SEGMENTS iseg ON ix.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
                    WHERE ix.RDB$RELATION_NAME = ? AND ix.RDB$SYSTEM_FLAG = 0
                    ORDER BY ix.RDB$INDEX_NAME, iseg.RDB$FIELD_POSITION
                `,
                foreignKeys: `
                    SELECT 
                        rc.RDB$CONSTRAINT_NAME AS CONSTRAINT_NAME,
                        iseg.RDB$FIELD_NAME AS FIELD_NAME,
                        rc_ref.RDB$RELATION_NAME AS REF_TABLE,
                        iseg_ref.RDB$FIELD_NAME AS REF_FIELD
                    FROM RDB$RELATION_CONSTRAINTS rc
                    JOIN RDB$REF_CONSTRAINTS ref ON rc.RDB$CONSTRAINT_NAME = ref.RDB$CONSTRAINT_NAME
                    JOIN RDB$INDEX_SEGMENTS iseg ON rc.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
                    JOIN RDB$RELATION_CONSTRAINTS rc_ref ON ref.RDB$CONST_NAME_UQ = rc_ref.RDB$INDEX_NAME
                    JOIN RDB$INDEX_SEGMENTS iseg_ref ON rc_ref.RDB$INDEX_NAME = iseg_ref.RDB$INDEX_NAME
                    WHERE rc.RDB$RELATION_NAME = ? AND rc.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY'
                `,
                dependencies: `
                    SELECT 
                        RDB$DEPENDED_ON_NAME AS DEP_NAME,
                        RDB$DEPENDED_ON_TYPE AS DEP_TYPE
                    FROM RDB$DEPENDENCIES
                    WHERE RDB$DEPENDENT_NAME = ?
                `
            },
            sourceCode: {
                procedure: "SELECT RDB$PROCEDURE_SOURCE as SOURCE FROM RDB$PROCEDURES WHERE RDB$PROCEDURE_NAME = ?",
                trigger: "SELECT RDB$TRIGGER_SOURCE as SOURCE FROM RDB$TRIGGERS WHERE RDB$TRIGGER_NAME = ?",
                view: "SELECT RDB$VIEW_SOURCE as SOURCE FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = ?"
            },
            users: {
                list: 'SELECT SEC$USER_NAME AS USERNAME, SEC$FIRST_NAME, SEC$LAST_NAME FROM SEC$USERS',
                create: (username, password) => `CREATE USER ${username} PASSWORD '${password}'`,
                update: (username, password) => `ALTER USER ${username} PASSWORD '${password}'`,
                delete: (username) => `DROP USER ${username}`
            },
            structure: `
                SELECT 
                    rf.RDB$FIELD_NAME AS FIELD_NAME,
                    f.RDB$FIELD_TYPE AS FIELD_TYPE,
                    f.RDB$FIELD_SUB_TYPE AS SUB_TYPE,
                    f.RDB$FIELD_LENGTH AS FIELD_LENGTH,
                    f.RDB$FIELD_PRECISION AS FIELD_PRECISION,
                    f.RDB$FIELD_SCALE AS FIELD_SCALE,
                    rf.RDB$NULL_FLAG AS NULL_FLAG,
                    (SELECT COUNT(*) FROM RDB$RELATION_CONSTRAINTS rc, RDB$INDEX_SEGMENTS iseg
                     WHERE rc.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
                     AND rc.RDB$RELATION_NAME = rf.RDB$RELATION_NAME 
                     AND rc.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY' 
                     AND iseg.RDB$FIELD_NAME = rf.RDB$FIELD_NAME) AS IS_PK,
                    (SELECT COUNT(*) FROM RDB$RELATION_CONSTRAINTS rc, RDB$INDEX_SEGMENTS iseg
                     WHERE rc.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
                     AND rc.RDB$RELATION_NAME = rf.RDB$RELATION_NAME 
                     AND rc.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY' 
                     AND iseg.RDB$FIELD_NAME = rf.RDB$FIELD_NAME) AS IS_FK
                FROM RDB$RELATION_FIELDS rf
                JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
                WHERE rf.RDB$RELATION_NAME = ?
                ORDER BY rf.RDB$FIELD_POSITION
            `,
            pagination: (tableName, limit, offset) => `SELECT FIRST ${limit} SKIP ${offset} * FROM ${tableName}`
        };
    }
}

module.exports = FirebirdDriver;
