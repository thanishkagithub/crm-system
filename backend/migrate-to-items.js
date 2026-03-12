const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

async function migrate() {
    console.log('🔄 Migrating database to relational line items...');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'rootpw',
        database: process.env.DB_NAME || 'crmm_db'
    });

    try {
        // Create estimate_items table
        console.log('📝 Creating estimate_items table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS estimate_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                estimate_id INT NOT NULL,
                description TEXT NOT NULL,
                quantity DECIMAL(15, 2) DEFAULT 1,
                rate DECIMAL(15, 2) DEFAULT 0,
                discount DECIMAL(5, 2) DEFAULT 0,
                tax DECIMAL(5, 2) DEFAULT 0,
                subtotal DECIMAL(15, 2) DEFAULT 0,
                total DECIMAL(15, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        // Create estimate_template_items table
        console.log('📝 Creating estimate_template_items table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS estimate_template_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                template_id INT NOT NULL,
                description TEXT NOT NULL,
                quantity DECIMAL(15, 2) DEFAULT 1,
                rate DECIMAL(15, 2) DEFAULT 0,
                discount DECIMAL(5, 2) DEFAULT 0,
                tax DECIMAL(5, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (template_id) REFERENCES estimate_templates(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        console.log('✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

migrate();
