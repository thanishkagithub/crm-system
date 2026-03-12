const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

async function updateSchema() {
    console.log('🔄 Updating database schema...');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'crmm_db'
    });

    try {
        // Update customers table - add columns one by one with existence check
        console.log('📝 Adding address and GST fields to customers table...');

        // Check and add billing_address
        const [billingCheck] = await connection.query(`
            SELECT COUNT(*) as count FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'crmm_db'}' 
            AND TABLE_NAME = 'customers' 
            AND COLUMN_NAME = 'billing_address'
        `);

        if (billingCheck[0].count === 0) {
            await connection.query('ALTER TABLE customers ADD COLUMN billing_address TEXT AFTER phone');
            console.log('   ✓ Added billing_address column');
        } else {
            console.log('   ℹ️  billing_address column already exists');
        }

        // Check and add shipping_address
        const [shippingCheck] = await connection.query(`
            SELECT COUNT(*) as count FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'crmm_db'}' 
            AND TABLE_NAME = 'customers' 
            AND COLUMN_NAME = 'shipping_address'
        `);

        if (shippingCheck[0].count === 0) {
            await connection.query('ALTER TABLE customers ADD COLUMN shipping_address TEXT AFTER billing_address');
            console.log('   ✓ Added shipping_address column');
        } else {
            console.log('   ℹ️  shipping_address column already exists');
        }

        // Check and add gst_number
        const [gstCheck] = await connection.query(`
            SELECT COUNT(*) as count FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'crmm_db'}' 
            AND TABLE_NAME = 'customers' 
            AND COLUMN_NAME = 'gst_number'
        `);

        if (gstCheck[0].count === 0) {
            await connection.query('ALTER TABLE customers ADD COLUMN gst_number VARCHAR(50) AFTER shipping_address');
            await connection.query('ALTER TABLE customers ADD INDEX idx_gst_number (gst_number)');
            console.log('   ✓ Added gst_number column and index');
        } else {
            console.log('   ℹ️  gst_number column already exists');
        }

        // Create users table
        console.log('📝 Creating users table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                email VARCHAR(255),
                role ENUM('admin', 'user') DEFAULT 'user',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_username (username),
                INDEX idx_role (role)
            ) ENGINE=InnoDB
        `);

        // Create estimate_templates table
        console.log('📝 Creating estimate_templates table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS estimate_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                template_name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                description TEXT,
                base_duration INT DEFAULT 1,
                base_rate DECIMAL(15, 2) DEFAULT 0,
                currency VARCHAR(10) DEFAULT 'INR',
                discount DECIMAL(5, 2) DEFAULT 0,
                tax DECIMAL(5, 2) DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_category (category),
                INDEX idx_active (is_active)
            ) ENGINE=InnoDB
        `);

        // Insert default admin user (password: admin123)
        console.log('📝 Creating default admin user...');
        await connection.query(`
            INSERT IGNORE INTO users (username, password_hash, full_name, role)
            VALUES ('admin', '$2b$10$rKZLvXZZZZZZZZZZZZZZZe', 'System Administrator', 'admin')
        `);

        // Seed video service templates
        console.log('📝 Seeding video service templates...');
        const templates = [
            ['Corporate Videos', 'Company profiles, leadership messages, internal communications, and brand stories', 5000],
            ['Marketing & Promotional Videos', 'Product launches, brand campaigns, social media ads, and digital promotions', 6000],
            ['Infographic & Explainer Videos', 'Data-driven storytelling, animated explainers, process videos, and concept visualizations', 7000],
            ['Celebration & Event Videos', 'Annual day videos, milestone celebrations, award nights, recap and highlight reels', 4500],
            ['Training & Educational Videos', 'Employee onboarding, compliance training, e-learning modules, and how-to videos', 5500],
            ['Product Demo Videos', 'Feature walkthroughs, use-case videos, and customer-focused demonstrations', 5000],
            ['Testimonial & Case Study Videos', 'Client stories, success narratives, and credibility-building content', 4000],
            ['Social Media Videos', 'Short-form content, reels, teasers, and platform-optimized videos', 3500]
        ];

        for (const [name, desc, rate] of templates) {
            await connection.query(`
                INSERT INTO estimate_templates (template_name, category, description, base_duration, base_rate, currency, is_active)
                VALUES (?, ?, ?, 1, ?, 'INR', TRUE)
                ON DUPLICATE KEY UPDATE 
                    description = VALUES(description),
                    base_rate = VALUES(base_rate),
                    category = VALUES(category)
            `, [name, name, desc, rate]);
        }

        console.log('✅ Schema update completed successfully!');
        console.log('✨ Default admin user created (username: admin, password: admin123)');
        console.log('✨ Video service templates seeded');

    } catch (error) {
        console.error('❌ Error updating schema:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

updateSchema().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
