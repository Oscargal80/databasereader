const { executeQuery, getSqlDialect } = require('./config/db');

// Mock session options for the PostgreSQL DB seen in logs
const dbOptions = {
    dbType: 'postgres',
    host: '192.168.119.239',
    port: 5432,
    database: 'ALTOQUE',
    user: 'postgres',
    password: 'password' // Still a placeholder
};

console.log('--- STARTING DIAGNOSTIC ---');
const dialect = getSqlDialect(dbOptions.dbType);

executeQuery(dbOptions, dialect.explorer.userTables, [], async (err, tablesResult) => {
    if (err) {
        console.error('UserTables Fetch FAILED:', err.message);
        process.exit(1);
    }

    const tableNames = (Array.isArray(tablesResult) ? tablesResult : []).map(r => (r.NAME || r.name || r.table_name || '').trim());
    console.log(`Tables found: ${tableNames.length}`);

    if (dialect.fullSchema) {
        console.log('Executing fullSchema...');
        executeQuery(dbOptions, dialect.fullSchema, [], (err, fullSchemaRows) => {
            if (err) {
                console.error('fullSchema FAILED:', err.message);
            } else {
                console.log(`fullSchema returned ${fullSchemaRows.length} rows`);
                const tableMap = {};
                fullSchemaRows.forEach(row => {
                    const tName = (row.TABLE_NAME || row.table_name || '').trim();
                    if (!tableMap[tName]) tableMap[tName] = [];
                    tableMap[tName].push(row.FIELD_NAME || row.field_name);
                });
                console.log(`Mapped ${Object.keys(tableMap).length} tables from fullSchema`);
            }
            process.exit(0);
        });
    } else {
        console.log('No fullSchema defined.');
        process.exit(0);
    }
});
