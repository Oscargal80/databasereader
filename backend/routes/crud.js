const express = require('express');
const router = express.Router();
const { executeQuery, getSqlDialect, cache } = require('../config/db');
const tracker = require('../services/usageTracker');

const { quoteIdentifier, normalizeValue, escapeLike } = require('../config/sqlHelpers');

const query = (dbOptions, sql, params) => new Promise((resolve, reject) => {
    executeQuery(dbOptions, sql, params, (err, result) => (err ? reject(err) : resolve(result)));
});

const countMatches = async (dbOptions, quotedTable, quotedColumn, value) => {
    const rows = await query(dbOptions, `SELECT COUNT(*) AS TOTAL_CNT FROM ${quotedTable} WHERE ${quotedColumn} = ?`, [value]);
    const row = (Array.isArray(rows) && rows[0]) || {};
    return parseInt(row.TOTAL_CNT ?? row.total_cnt ?? row.count ?? row.COUNT ?? 0, 10);
};

/**
 * Refuse to touch a record unless the key identifies exactly one row.
 * Returns an error message, or null when it is safe to continue.
 */
const checkSingleRow = async (dbOptions, quotedTable, quotedColumn, pkField, value) => {
    const matches = await countMatches(dbOptions, quotedTable, quotedColumn, value);
    if (matches === 0) return { status: 404, message: 'Registro no encontrado' };
    if (matches > 1) {
        return { status: 409, message: `La columna "${pkField}" no es única: ${matches} filas coinciden. Operación cancelada.` };
    }
    return null;
};

const isMissing = (value) => value === undefined || value === null || value === '';

const MAX_FETCH_ALL_ROWS = 10000;

/**
 * ORDER BY clause over the primary key, so paging and exports are stable.
 * Returns '' when the table has no primary key (or it cannot be determined).
 */
const primaryKeyOrder = async (dbOptions, tableName) => {
    const { dbType, host, port, user, database } = dbOptions;
    const cacheKey = `pkorder_${dbType}_${host}_${port}_${user}_${database}_${tableName}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    try {
        const dialect = getSqlDialect(dbType);
        let params = [tableName];
        if (dbType === 'postgres') params = [tableName, tableName];
        if (dbType === 'firebird') params = [tableName.toUpperCase()];

        const rows = await query(dbOptions, dialect.structure, params);
        const columns = (Array.isArray(rows) ? rows : [])
            .filter(row => row.IS_PK || row.is_pk || row.COLUMN_KEY === 'PRI')
            .map(row => String(row.FIELD_NAME || row.field_name || row.COLUMN_NAME || row.column_name || '').trim())
            .filter(Boolean);

        const orderBy = columns.map(name => quoteIdentifier(name, dbType)).join(', ');
        cache.set(cacheKey, orderBy);
        return orderBy;
    } catch (err) {
        return '';
    }
};

const csvCell = (value, delimiter) => {
    if (value === null || value === undefined) return '';
    if (Buffer.isBuffer(value)) value = value.toString('utf8');
    let text = String(value);
    // Neutralize spreadsheet formulas coming from data
    if (typeof value === 'string' && /^[=@\t\r]|^[+-](?![\d.\s])/.test(text)) text = `'${text}`;
    if (text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r')) {
        text = `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

// Middleware to check session
const checkAuth = (req, res, next) => {
    if (!req.session.dbOptions) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    next();
};

router.use(checkAuth);

// GET - List data from table with pagination
router.get('/:tableName', async (req, res) => {
    const { tableName } = req.params;
    const { type } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limitParam = parseInt(req.query.limit);
    const limit = limitParam === -1 ? MAX_FETCH_ALL_ROWS : (limitParam || 20);
    const skip = limitParam === -1 ? 0 : (page - 1) * limit;

    const dbOptions = req.session.dbOptions;
    const isPostgres = dbOptions.dbType === 'postgres';
    const isMySQL = dbOptions.dbType === 'mysql';
    const dialect = getSqlDialect(dbOptions.dbType);

    // Quote table name based on engine
    const quotedTableName = quoteIdentifier(tableName, dbOptions.dbType);

    const isSpecialObject = ['Generators', 'Procedures', 'Triggers', 'ViewSource'].includes(type);
    const orderBy = isSpecialObject ? '' : await primaryKeyOrder(dbOptions, tableName);

    let sql = dialect.pagination(quotedTableName, limit, skip, orderBy);
    let countSql = `SELECT COUNT(*) AS TOTAL_CNT FROM ${quotedTableName}`;

    // Specialized queries for metadata objects
    if (type === 'Generators') {
        sql = isPostgres
            ? `SELECT last_value as CURRENT_VALUE, is_called FROM ${quotedTableName}`
            : `SELECT GEN_ID(${quotedTableName}, 0) as CURRENT_VALUE FROM RDB$DATABASE`;
        countSql = `SELECT 1 as TOTAL_CNT FROM ${isPostgres ? 'information_schema.sequences' : 'RDB$DATABASE'}`;
    } else if (type === 'Procedures' || type === 'Triggers' || type === 'ViewSource') {
        const objectType = { Procedures: 'procedure', Triggers: 'trigger', ViewSource: 'view' }[type];
        sql = dialect.sourceCode[objectType];

        let searchName = tableName;
        if (dbOptions.dbType === 'firebird') searchName = tableName.toUpperCase();

        // Execute with searchName as param
        executeQuery(dbOptions, sql, [searchName], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            const data = (Array.isArray(result) ? result : []).map(row => ({
                SOURCE: (row.SOURCE || row.source || row.definition || '').trim()
            }));

            res.json({
                success: true,
                data,
                pagination: { total: 1, page: 1, limit: 1, totalPages: 1 }
            });
        });
        return; // Exit early as we already sent response
    }

    console.log(`Executing CRUD list - Type: ${type}, Table: ${tableName}`);
    console.log(`Count SQL: ${countSql}`);
    console.log(`Select SQL: ${sql}`);

    executeQuery(req.session.dbOptions, countSql, [], (err, countResult) => {
        if (err) {
            console.error('Count query error:', err);
            return res.status(500).json({ success: false, message: 'Count error: ' + err.message });
        }

        // Handle possible case variations for TOTAL_CNT (Firebird/Postgres)
        const total = countResult && countResult[0]
            ? (countResult[0].TOTAL_CNT || countResult[0].total_cnt || countResult[0].TOTAL || parseInt(countResult[0].count) || 0)
            : 0;

        executeQuery(req.session.dbOptions, sql, [], (err, result) => {
            if (err) {
                console.error('Select query error:', err);
                return res.status(500).json({ success: false, message: 'Select error: ' + err.message });
            }

            if (!Array.isArray(result)) {
                return res.json({ success: true, data: [], pagination: { total, page, limit, totalPages: 0 } });
            }

            const data = result.map(row => {
                const cleanRow = {};
                for (let key in row) {
                    let val = row[key];
                    // Handle Buffers (common in Firebird/MySQL binary types)
                    if (Buffer.isBuffer(val)) {
                        val = val.toString('utf8');
                    }
                    cleanRow[key] = normalizeValue(val, dbOptions.dbType);
                }
                return cleanRow;
            });

            // Track usage
            const dbKey = `${req.session.dbOptions.host}:${req.session.dbOptions.database}`;
            tracker.track(dbKey, tableName);

            res.json({
                success: true,
                data,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    truncated: limitParam === -1 && total > limit
                }
            });
        });
    });
});

// GET - Export table data as streamed CSV
router.get('/:tableName/export', async (req, res) => {
    const { tableName } = req.params;
    const dbOptions = req.session.dbOptions;

    if (!dbOptions) return res.status(401).send('Not authenticated');

    const dialect = getSqlDialect(dbOptions.dbType);
    const quotedTableName = quoteIdentifier(tableName, dbOptions.dbType);
    const delimiter = req.query.delimiter === ';' ? ';' : ',';

    console.log(`[Export Stream] Initiating CSV export for ${tableName}`);

    let aborted = false;
    res.on('close', () => { aborted = true; });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${tableName.replace(/[^\w.-]/g, '_')}_export.csv"`);

    const chunkSize = 5000;
    let offset = 0;
    let hasMore = true;
    let isFirstBatch = true;

    try {
        // Stable order: without it OFFSET paging can repeat or skip rows between chunks
        const orderBy = (await primaryKeyOrder(dbOptions, tableName)) || '1';

        while (hasMore && !aborted) {
            const sql = dialect.pagination(quotedTableName, chunkSize, offset, orderBy);
            const rows = await query(dbOptions, sql, []);

            if (!Array.isArray(rows) || rows.length === 0) {
                hasMore = false;
                break;
            }

            if (isFirstBatch) {
                // BOM so Excel reads the file as UTF-8
                res.write('\uFEFF' + Object.keys(rows[0]).map(h => csvCell(h, delimiter)).join(delimiter) + '\n');
                isFirstBatch = false;
            }

            let chunkStr = '';
            for (const row of rows) {
                chunkStr += Object.values(row).map(val => csvCell(normalizeValue(val, dbOptions.dbType), delimiter)).join(delimiter) + '\n';
            }
            res.write(chunkStr);

            if (rows.length < chunkSize) {
                hasMore = false;
            } else {
                offset += chunkSize;
            }
        }
        res.end();
        console.log(`[Export Stream] ${aborted ? 'Aborted' : 'Finished'} CSV export for ${tableName}`);
    } catch (err) {
        console.error('[Export Stream] Error:', err);
        if (!res.headersSent) {
            res.status(500).send('Export failed: ' + err.message);
        } else {
            res.end('\nError during export: ' + err.message);
        }
    }
});

// POST - Insert record
router.post('/:tableName', (req, res) => {
    const { tableName } = req.params;
    const data = req.body;
    const fields = Object.keys(data);
    const values = Object.values(data);
    if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to insert' });
    }
    const placeholders = fields.map(() => '?').join(', ');

    const dbOptions = req.session.dbOptions;
    const quotedTableName = quoteIdentifier(tableName, dbOptions.dbType);
    const quotedFields = fields.map(f => quoteIdentifier(f, dbOptions.dbType));

    const sql = `INSERT INTO ${quotedTableName} (${quotedFields.join(', ')}) VALUES (${placeholders})`;

    executeQuery(req.session.dbOptions, sql, values, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Record inserted' });
    });
});

// PUT - Update record (requires PK in body or query)
router.put('/:tableName', async (req, res) => {
    const { tableName } = req.params;
    const { pkField, pkValue, ...data } = req.body;

    if (!pkField || isMissing(pkValue)) {
        return res.status(400).json({ success: false, message: 'pkField and pkValue are required' });
    }

    const fields = Object.keys(data);
    const values = Object.values(data);

    if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const dbOptions = req.session.dbOptions;
    const quotedTableName = quoteIdentifier(tableName, dbOptions.dbType);
    const quotedPkField = quoteIdentifier(pkField, dbOptions.dbType);

    const setClauses = fields.map(f => `${quoteIdentifier(f, dbOptions.dbType)} = ?`).join(', ');
    const sql = `UPDATE ${quotedTableName} SET ${setClauses} WHERE ${quotedPkField} = ?`;

    // Add pkValue to the end of values array for the WHERE clause
    values.push(pkValue);

    try {
        const problem = await checkSingleRow(dbOptions, quotedTableName, quotedPkField, pkField, pkValue);
        if (problem) return res.status(problem.status).json({ success: false, message: problem.message });

        console.log(`Executing UPDATE on ${tableName}: ${sql}`);
        await query(dbOptions, sql, values);
        res.json({ success: true, message: 'Record updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST - Bulk Find and Replace (only rows containing the text; dryRun just counts them)
router.post('/:tableName/bulk-replace', async (req, res) => {
    const { tableName } = req.params;
    const { column, find, replace, dryRun } = req.body;

    if (!column || typeof find !== 'string' || find === '' || typeof replace !== 'string') {
        return res.status(400).json({ success: false, message: 'column, find, and replace are required' });
    }

    const dbOptions = req.session.dbOptions;
    const quotedTableName = quoteIdentifier(tableName, dbOptions.dbType);
    const quotedColumn = quoteIdentifier(column, dbOptions.dbType);
    const where = `${quotedColumn} LIKE ? ESCAPE '!'`;
    const pattern = `%${escapeLike(find)}%`;

    try {
        const countRows = await query(dbOptions, `SELECT COUNT(*) AS TOTAL_CNT FROM ${quotedTableName} WHERE ${where}`, [pattern]);
        const row = (Array.isArray(countRows) && countRows[0]) || {};
        const affected = parseInt(row.TOTAL_CNT ?? row.total_cnt ?? row.count ?? row.COUNT ?? 0, 10);

        if (dryRun) return res.json({ success: true, affected });

        if (affected > 0) {
            const sql = `UPDATE ${quotedTableName} SET ${quotedColumn} = REPLACE(${quotedColumn}, ?, ?) WHERE ${where}`;
            console.log(`Executing BULK REPLACE on ${tableName}.${column}: ${sql}`);
            await query(dbOptions, sql, [find, replace, pattern]);
        }
        res.json({ success: true, affected, message: `Bulk update completed: ${affected} row(s)` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE - Delete record (requires PK in query)
router.delete('/:tableName', async (req, res) => {
    const { tableName } = req.params;
    const { pkField, pkValue } = req.query;

    if (!pkField || isMissing(pkValue)) {
        return res.status(400).json({ success: false, message: 'pkField and pkValue are required' });
    }

    const dbOptions = req.session.dbOptions;
    const quotedTableName = quoteIdentifier(tableName, dbOptions.dbType);
    const quotedPkField = quoteIdentifier(pkField, dbOptions.dbType);

    try {
        const problem = await checkSingleRow(dbOptions, quotedTableName, quotedPkField, pkField, pkValue);
        if (problem) return res.status(problem.status).json({ success: false, message: problem.message });

        await query(dbOptions, `DELETE FROM ${quotedTableName} WHERE ${quotedPkField} = ?`, [pkValue]);
        res.json({ success: true, message: 'Record deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
