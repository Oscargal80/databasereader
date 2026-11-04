/**
 * Quote an identifier for the given engine, escaping any embedded quote character.
 */
const quoteIdentifier = (name, dbType) => {
    const value = String(name);
    switch (dbType) {
        case 'mysql': return `\`${value.replace(/`/g, '``')}\``;
        case 'postgres':
        case 'firebird': return `"${value.replace(/"/g, '""')}"`;
        case 'mssql': return `[${value.replace(/]/g, ']]')}]`;
        default: return value;
    }
};

const quoteLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

const pad = (n) => String(n).padStart(2, '0');

/**
 * Render a JS Date exactly as the database stored it.
 * node-firebird builds Dates from local-time fields; mssql builds them in UTC.
 */
const formatDate = (date, dbType) => {
    if (Number.isNaN(date.getTime())) return null;
    const local = dbType === 'firebird';
    const y = local ? date.getFullYear() : date.getUTCFullYear();
    const mo = (local ? date.getMonth() : date.getUTCMonth()) + 1;
    const d = local ? date.getDate() : date.getUTCDate();
    const h = local ? date.getHours() : date.getUTCHours();
    const mi = local ? date.getMinutes() : date.getUTCMinutes();
    const s = local ? date.getSeconds() : date.getUTCSeconds();
    return `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(s)}`;
};

/**
 * Normalize a driver value for the client without altering it:
 * only Firebird pads CHAR columns, so only Firebird strings are trimmed.
 */
const normalizeValue = (val, dbType) => {
    if (val instanceof Date) return formatDate(val, dbType);
    if (typeof val === 'string' && dbType === 'firebird') return val.trim();
    return val;
};

const escapeLike = (text) => String(text).replace(/[!%_[]/g, (ch) => `!${ch}`);

module.exports = { quoteIdentifier, quoteLiteral, formatDate, normalizeValue, escapeLike };
