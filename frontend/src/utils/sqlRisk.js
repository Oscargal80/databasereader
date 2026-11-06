const WRITE_STATEMENTS = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'MERGE', 'REPLACE', 'CALL', 'EXEC', 'EXECUTE', 'GRANT', 'REVOKE'];

// Remove comments and string/identifier contents so keywords inside them are not mistaken for SQL
const stripNoise = (sql) => sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');

/**
 * Heuristic classification of a SQL script.
 * level: 'read' | 'write' | 'destructive'; reasons explain a destructive result.
 * It is a safety net for the user, not a parser: nested subqueries can hide a WHERE.
 */
export const analyzeSql = (sql) => {
    const statements = stripNoise(String(sql || '')).split(';').map(s => s.trim()).filter(Boolean);
    const reasons = [];
    let level = 'read';

    statements.forEach(statement => {
        const upper = statement.toUpperCase();
        const first = upper.split(/\s+/)[0];
        const hasWhere = /\bWHERE\b/.test(upper);

        if (first === 'DROP' || first === 'TRUNCATE') {
            reasons.push(`${first} elimina ${first === 'DROP' ? 'objetos' : 'todas las filas'} de forma irreversible`);
        } else if (first === 'DELETE' && !hasWhere) {
            reasons.push('DELETE sin WHERE borra todas las filas de la tabla');
        } else if (first === 'UPDATE' && !hasWhere) {
            reasons.push('UPDATE sin WHERE modifica todas las filas de la tabla');
        } else if (first === 'ALTER' && /\bDROP\b/.test(upper)) {
            reasons.push('ALTER ... DROP elimina columnas u objetos');
        }

        const writesInCte = first === 'WITH' && /\b(INSERT|UPDATE|DELETE)\b/.test(upper);
        if (WRITE_STATEMENTS.includes(first) || writesInCte) level = 'write';
    });

    if (reasons.length > 0) level = 'destructive';
    return { level, reasons };
};
