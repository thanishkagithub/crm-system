const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Generic helper for CRUD operations (Same as sales.js)
const createCrudRoutes = (table) => {
    const router = express.Router();

    // GET all
    router.get('/', async (req, res, next) => {
        try {
            const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
            const processedRows = rows.map(row => {
                if (row.items && typeof row.items === 'string') {
                    try { row.items = JSON.parse(row.items); } catch (e) { }
                }
                return row;
            });
            res.json(processedRows);
        } catch (err) {
            next(err);
        }
    });

    // GET by ID
    router.get('/:id', async (req, res, next) => {
        try {
            const [rows] = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });

            const row = rows[0];
            if (row.items && typeof row.items === 'string') {
                try { row.items = JSON.parse(row.items); } catch (e) { }
            }
            res.json(row);
        } catch (err) {
            next(err);
        }
    });

    // POST
    router.post('/', async (req, res, next) => {
        try {
            const keys = Object.keys(req.body);
            const values = Object.values(req.body).map(val =>
                (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val
            );

            const placeholders = keys.map(() => '?').join(', ');
            const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;

            const [result] = await db.query(query, values);
            res.status(201).json({ id: result.insertId, ...req.body });
        } catch (err) {
            next(err);
        }
    });

    // PUT
    router.put('/:id', async (req, res, next) => {
        try {
            const updates = [];
            const values = [];

            Object.keys(req.body).forEach(key => {
                if (key !== 'id' && key !== 'created_at') {
                    updates.push(`${key} = ?`);
                    const val = req.body[key];
                    values.push((typeof val === 'object' && val !== null) ? JSON.stringify(val) : val);
                }
            });

            values.push(req.params.id);

            const query = `UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`;

            const [result] = await db.query(query, values);
            if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });

            res.json({ id: req.params.id, ...req.body });
        } catch (err) {
            next(err);
        }
    });

    // DELETE
    router.delete('/:id', async (req, res, next) => {
        try {
            const [result] = await db.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
            if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
            res.json({ success: true, message: 'Deleted successfully' });
        } catch (err) {
            next(err);
        }
    });

    return router;
};

// Mount sub-routers for each accounts module
router.use('/vendors', createCrudRoutes('vendors'));
router.use('/expenses', createCrudRoutes('expenses'));
router.use('/bills', createCrudRoutes('bills'));
router.use('/purchase-orders', createCrudRoutes('purchase_orders'));
router.use('/documents', createCrudRoutes('accounts_documents'));

module.exports = router;
