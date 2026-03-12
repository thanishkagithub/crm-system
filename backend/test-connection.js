const mysql = require('mysql2/promise');
const fs = require('fs');

const passwordsToTry = [
    'rootpw',     // User provided
    '',           // Empty (XAMPP default)
    'root',       // Common default
    'password',   // Common default
    'admin',      // Common default
    '123456',     // Common default
    'mysql'       // Common default
];

async function testConnection() {
    console.log('🔍 Testing database connections with common passwords...\n');

    for (const password of passwordsToTry) {
        console.log(`Trying user: "root", password: "${password}"...`);

        try {
            const connection = await mysql.createConnection({
                host: 'localhost',
                user: 'root',
                password: password
            });

            console.log(`\n✅ SUCCESS! Connected successfully with password: "${password}"`);

            // Save password to file
            fs.writeFileSync('backend/password.txt', password);
            console.log('Using fs to write password to "backend/password.txt"...');

            await connection.end();
            return;

        } catch (error) {
            if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                // console.log('Access denied');
            } else {
                console.log(` ❌ Error: ${error.code}`);
            }
        }
    }

    console.log('\n❌ Failed to connect with all tried passwords.');
}

testConnection();
