const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware to check admin role (simplified - in production use proper auth)
const requireAdmin = (req, res, next) => {
    // For now, we'll accept a header or query param
    // In production, this should check JWT token or session
    const isAdmin = req.headers['x-user-role'] === 'admin' || req.query.admin === 'true';

    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
};

// GET all active templates (public - all users can view)
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await db.query(`
            SELECT * FROM estimate_templates 
            WHERE is_active = TRUE 
            ORDER BY category, template_name
        `);
        for (let row of rows) {
            const [items] = await db.query('SELECT * FROM estimate_template_items WHERE template_id = ?', [row.id]);
            row.items = items;
        }
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET all templates including inactive (admin only)
router.get('/all', requireAdmin, async (req, res, next) => {
    try {
        const [rows] = await db.query(`
            SELECT * FROM estimate_templates 
            ORDER BY category, template_name
        `);
        for (let row of rows) {
            const [items] = await db.query('SELECT * FROM estimate_template_items WHERE template_id = ?', [row.id]);
            row.items = items;
        }
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET template by ID
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM estimate_templates WHERE id = ?',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        const template = rows[0];
        const [items] = await db.query('SELECT * FROM estimate_template_items WHERE template_id = ?', [template.id]);
        template.items = items;
        res.json(template);
    } catch (err) {
        next(err);
    }
});

// POST - Create new template (admin only)
router.post('/', requireAdmin, async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const {
            template_name,
            category,
            description,
            base_duration,
            base_rate,
            currency,
            discount,
            tax,
            is_active,
            items
        } = req.body;

        if (!template_name || !category) {
            return res.status(400).json({
                success: false,
                message: 'Template name and category are required'
            });
        }

        const [result] = await connection.query(`
            INSERT INTO estimate_templates 
            (template_name, category, description, base_duration, base_rate, currency, discount, tax, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            template_name,
            category,
            description || null,
            base_duration || 1,
            base_rate || 0,
            currency || 'INR',
            discount || 0,
            tax || 0,
            is_active !== undefined ? is_active : true
        ]);

        const templateId = result.insertId;

        if (items && Array.isArray(items)) {
            for (let item of items) {
                await connection.query(`
                    INSERT INTO estimate_template_items 
                    (template_id, description, quantity, rate, discount, tax)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [templateId, item.description, item.quantity, item.rate, item.discount, item.tax]);
            }
        }

        await connection.commit();
        res.status(201).json({ id: templateId, ...req.body });
    } catch (err) {
        await connection.rollback();
        next(err);
    } finally {
        connection.release();
    }
});

// PUT - Update template (admin only)
router.put('/:id', requireAdmin, async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const {
            template_name,
            category,
            description,
            base_duration,
            base_rate,
            currency,
            discount,
            tax,
            is_active,
            items
        } = req.body;

        const updates = [];
        const values = [];

        const allowedFields = [
            'template_name', 'category', 'description',
            'base_duration', 'base_rate', 'currency',
            'discount', 'tax', 'is_active'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(req.body[field]);
            }
        });

        if (updates.length > 0) {
            values.push(req.params.id);
            await connection.query(
                `UPDATE estimate_templates SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Handle items update (delete and re-insert)
        await connection.query('DELETE FROM estimate_template_items WHERE template_id = ?', [req.params.id]);
        if (items && Array.isArray(items)) {
            for (let item of items) {
                await connection.query(`
                    INSERT INTO estimate_template_items 
                    (template_id, description, quantity, rate, discount, tax)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [req.params.id, item.description, item.quantity, item.rate, item.discount, item.tax]);
            }
        }

        await connection.commit();

        // Fetch and return updated template
        const [rows] = await connection.query(
            'SELECT * FROM estimate_templates WHERE id = ?',
            [req.params.id]
        );
        const template = rows[0];
        const [itemRows] = await connection.query('SELECT * FROM estimate_template_items WHERE template_id = ?', [template.id]);
        template.items = itemRows;

        res.json(template);
    } catch (err) {
        await connection.rollback();
        next(err);
    } finally {
        connection.release();
    }
});

// DELETE - Delete template (admin only)
router.delete('/:id', requireAdmin, async (req, res, next) => {
    try {
        const [result] = await db.query(
            'DELETE FROM estimate_templates WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        res.json({
            success: true,
            message: 'Template deleted successfully'
        });
    } catch (err) {
        next(err);
    }
});

// PATCH - Toggle template active status (admin only)
router.patch('/:id/toggle', requireAdmin, async (req, res, next) => {
    try {
        const [result] = await db.query(
            'UPDATE estimate_templates SET is_active = NOT is_active WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        const [rows] = await db.query(
            'SELECT * FROM estimate_templates WHERE id = ?',
            [req.params.id]
        );

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
