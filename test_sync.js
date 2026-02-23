const { syncGenerators, executeQuery } = require('./backend/config/db');

// Mock options (adjust to your environment for local testing if needed)
const options = {
    dbType: 'firebird',
    host: '127.0.0.1',
    port: 3050,
    database: 'C:/DB/TEST.FDB',
    user: 'SYSDBA',
    password: 'masterkey'
};

console.log('--- Testing Sync Generators Logic ---');
syncGenerators(options, 'USERS', 'ID', (err) => {
    if (err) {
        console.error('FAILED:', err.message);
    } else {
        console.log('SUCCESS: Logic executed without errors.');
    }
    process.exit();
});
