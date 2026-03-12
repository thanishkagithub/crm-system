require('dotenv').config();
const db = require('./config/database');

async function updateSchema() {
    try {
        console.log('🔄 Updating Database Schema for Vendors...');

        // Check if columns exist first to avoid errors? Or just try ADD COLUMN IF NOT EXISTS (MySQL 8.0+)
        // Or catch error. simpler to try ADD and catch "Duplicate column name".

        const queries = [
            "ALTER TABLE vendors ADD COLUMN payment_terms VARCHAR(50) DEFAULT 'Net 30'",
            "ALTER TABLE vendors ADD COLUMN tax_id VARCHAR(50)",
            "ALTER TABLE vendors ADD COLUMN total_payable DECIMAL(15, 2) DEFAULT 0"
        ];

        for (const query of queries) {
            try {
                await db.query(query);
                console.log(`✅ Executed: ${query}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`ℹ️ Column already exists, skipping: ${query}`);
                } else {
                    console.error(`❌ Failed: ${query}`, err.message);
                }
            }
        }

        console.log('✅ Schema update complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating schema:', error);
        process.exit(1);
    }
}

updateSchema();
