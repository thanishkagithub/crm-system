const mysql = require('mysql2');

// Create a dummy pool that returns empty results when DB is not configured
const isDbConfigured = process.env.DB_HOST && process.env.DB_HOST !== 'localhost';

if (!isDbConfigured && process.env.NODE_ENV !== 'development') {
    // Running on Netlify/production without a real DB — return a stub pool
    // that returns empty arrays so the app doesn't crash
    console.warn('⚠️  No external DB configured. Using in-memory stub (data will not persist).');

    const stub = {
        query: async () => [[]],
        execute: async () => [[]],
        getConnection: async () => ({
            query: async () => [[]],
            execute: async () => [[]],
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {}
        })
    };

    module.exports = stub;
} else {
    // Create connection pool
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'rootpw',
        database: process.env.DB_NAME || 'crmm_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    // Get promise-based pool
    const promisePool = pool.promise();

    // Test connection
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('❌ Database connection failed:', err.message);
            return;
        }
        console.log('✅ Database connected successfully!');
        connection.release();
    });

    module.exports = promisePool;
}
