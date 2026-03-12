require('dotenv').config();
const db = require('./config/database');

async function checkDatabase() {
    try {
        console.log('🔍 Checking Database Records...\n');

        const tables = [
            'resources',
            'projects',
            'tasks',
            'assignments',
            'customers',
            'estimates',
            'sales_orders',
            'invoices',
            'payments',
            'vendors',
            'expenses',
            'bills'
        ];

        for (const table of tables) {
            const [rows] = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
            console.log(`📊 ${table.padEnd(15)}: ${rows[0].count} records`);

            if (rows[0].count > 0) {
                // Show latest entry
                const [latest] = await db.query(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 1`);
                const sample = JSON.stringify(latest[0]).substring(0, 100); // Truncate for display
                console.log(`   └─ Latest: ${sample}...\n`);
            } else {
                console.log(`   └─ (Empty)\n`);
            }
        }

        console.log('✅ Check complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error checking database:', error);
        process.exit(1);
    }
}

checkDatabase();
