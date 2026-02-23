const Firebird = require('node-firebird');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const options = {
    host: '127.0.0.1',
    port: 3050,
    database: process.env.DB_PATH || '/Users/scarx80/Desktop/firebird/database.fdb',
    user: 'SYSDBA',
    password: 'masterkey',
    lowercase_keys: false
};

Firebird.attach(options, function (err, db) {
    if (err) {
        console.error('Attach error:', err);
        return;
    }

    const tableName = 'ACTIVIDADES';
    const limit = 10;
    const skip = 0;

    const countSql = `SELECT COUNT(*) AS TOTAL_CNT FROM ${tableName}`;
    const pagSql = `SELECT FIRST ${limit} SKIP ${skip} * FROM ${tableName}`;

    console.log('Testing Count SQL:', countSql);
    db.query(countSql, [], function (err, result) {
        if (err) console.error('Count Error:', err);
        else console.log('Count Result:', result);

        console.log('Testing Pagination SQL:', pagSql);
        db.query(pagSql, [], function (err, result) {
            if (err) console.error('Pagination Error:', err);
            else console.log('Pagination Result size:', result ? result.length : 0);

            db.detach();
        });
    });
});
