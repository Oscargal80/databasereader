const { Pool } = require('pg');

const options = {
    host: '192.168.119.239', // From logs earlier
    port: 5432,
    database: 'ALTOQUE',
    user: 'postgres',
    password: 'password' // If I knew it, but I don't. I'll use placeholders.
};

console.log('Testing PG connection...');
const pool = new Pool(options);

pool.query('SELECT tablename as name FROM pg_catalog.pg_tables WHERE schemaname = \'public\'', (err, res) => {
    if (err) {
        console.error('FAILED:', err.message);
    } else {
        console.log('SUCCESS:', res.rows.length, 'tables found');
    }
    pool.end();
    process.exit(0);
});
