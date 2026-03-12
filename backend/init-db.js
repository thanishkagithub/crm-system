const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

async function initDatabase() {
    console.log('🔄 Initializing database...');

    // Create connection without database selected first
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    try {
        // Read SQL file
        const sqlPath = path.join(__dirname, 'models', 'db.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon to get individual queries
        // This is a naive split, but sufficient for our schema file
        const queries = sql
            .split(';')
            .filter(query => query.trim().length > 0);

        console.log(`📝 Found ${queries.length} queries to execute.`);

        // Execute each query
        for (const query of queries) {
            if (query.trim()) {
                await connection.query(query);
            }
        }

        console.log('✅ Database initialization completed successfully!');
        console.log('✨ All tables have been created.');

    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('\n⚠️  Could not connect to MySQL server.');
            console.error('   Please make sure MySQL is installed and running.');
            console.error('   If you are using XAMPP/WAMP, start the MySQL module.');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\n⚠️  Access denied. Please check your username and password in .env file.');
        }
    } finally {
        await connection.end();
    }
}

initDatabase();
