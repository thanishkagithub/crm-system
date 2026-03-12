const express = require('express');
const router = express.Router();
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../debug.log');
const log = (msg) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
};

// Generic helper for CRUD operations
const createCrudRoutes = (table, fields) => {
    const router = express.Router();

    // GET all
    router.get('/', async (req, res, next) => {
        try {
            const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
            // Parse JSON fields
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
            log(`📥 POST /api/sales/${table} - Body: ${JSON.stringify(req.body)}`);
            const keys = Object.keys(req.body);
            const values = Object.values(req.body).map(val =>
                (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val
            );

            const placeholders = keys.map(() => '?').join(', ');
            const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;

            const [result] = await db.query(query, values);
            log(`   ✓ Success! Created ID: ${result.insertId}`);
            res.status(201).json({ id: result.insertId, ...req.body });
        } catch (err) {
            log(`❌ POST /api/sales/${table} ERROR: ${err.message}`);
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

// Specialized router for Estimates
const estimateRouter = express.Router();

estimateRouter.get('/', async (req, res, next) => {
    try {
        const [estimates] = await db.query('SELECT * FROM estimates ORDER BY created_at DESC');
        for (let est of estimates) {
            const [items] = await db.query('SELECT * FROM estimate_items WHERE estimate_id = ?', [est.id]);
            est.items = items;
        }
        res.json(estimates);
    } catch (err) {
        next(err);
    }
});

estimateRouter.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM estimates WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });

        const est = rows[0];
        const [items] = await db.query('SELECT * FROM estimate_items WHERE estimate_id = ?', [est.id]);
        est.items = items;
        res.json(est);
    } catch (err) {
        next(err);
    }
});

estimateRouter.post('/', async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { customer_id, estimate_number, estimate_date, expiry_date, items, subtotal, tax, total, notes } = req.body;

        const [result] = await connection.query(
            'INSERT INTO estimates (customer_id, estimate_number, estimate_date, expiry_date, subtotal, tax, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [customer_id, estimate_number, estimate_date, expiry_date, subtotal, tax, total, notes]
        );

        const estimateId = result.insertId;
        if (items && Array.isArray(items)) {
            for (let item of items) {
                await connection.query(
                    'INSERT INTO estimate_items (estimate_id, description, quantity, rate, discount, tax, subtotal, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [estimateId, item.description, item.quantity, item.rate, item.discount, item.tax, item.subtotal, item.total]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ id: estimateId, ...req.body });
    } catch (err) {
        await connection.rollback();
        next(err);
    } finally {
        connection.release();
    }
});

estimateRouter.put('/:id', async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { customer_id, estimate_number, estimate_date, expiry_date, items, subtotal, tax, total, notes } = req.body;

        await connection.query(
            'UPDATE estimates SET customer_id = ?, estimate_number = ?, estimate_date = ?, expiry_date = ?, subtotal = ?, tax = ?, total = ?, notes = ? WHERE id = ?',
            [customer_id, estimate_number, estimate_date, expiry_date, subtotal, tax, total, notes, req.params.id]
        );

        // Delete existing items and re-insert
        await connection.query('DELETE FROM estimate_items WHERE estimate_id = ?', [req.params.id]);
        if (items && Array.isArray(items)) {
            for (let item of items) {
                await connection.query(
                    'INSERT INTO estimate_items (estimate_id, description, quantity, rate, discount, tax, subtotal, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [req.params.id, item.description, item.quantity, item.rate, item.discount, item.tax, item.subtotal, item.total]
                );
            }
        }

        await connection.commit();
        res.json({ id: req.params.id, ...req.body });
    } catch (err) {
        await connection.rollback();
        next(err);
    } finally {
        connection.release();
    }
});

estimateRouter.delete('/:id', async (req, res, next) => {
    try {
        const [result] = await db.query('DELETE FROM estimates WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
        next(err);
    }
});

// Mount sub-routers for each sales module
router.use('/customers', createCrudRoutes('customers'));
router.use('/estimates', estimateRouter);
router.use('/orders', createCrudRoutes('sales_orders'));
router.use('/challans', createCrudRoutes('delivery_challans'));
router.use('/invoices', createCrudRoutes('invoices'));
router.use('/payments', createCrudRoutes('payments'));
router.use('/recurring', createCrudRoutes('recurring_invoices'));
router.use('/credit-notes', createCrudRoutes('credit_notes'));

module.exports = router;
