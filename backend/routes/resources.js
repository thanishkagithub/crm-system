const express = require('express');
const router = express.Router();
const db = require('../config/database');

// @route   GET /api/resources
// @desc    Get all resources
// @access  Public
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM resources ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// @route   GET /api/resources/:id
// @desc    Get resource by ID
// @access  Public
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM resources WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// @route   POST /api/resources
// @desc    Create new resource
// @access  Public
router.post('/', async (req, res, next) => {
    try {
        const { name, role, department, email } = req.body;

        // Validation
        if (!name || !role || !department || !email) {
            const error = new Error('Please provide all required fields');
            error.name = 'ValidationError';
            throw error;
        }

        const [result] = await db.query(
            'INSERT INTO resources (name, role, department, email) VALUES (?, ?, ?, ?)',
            [name, role, department, email]
        );

        const newResource = {
            id: result.insertId,
            name,
            role,
            department,
            email,
            created_at: new Date()
        };

        res.status(201).json(newResource);
    } catch (err) {
        next(err);
    }
});

// @route   PUT /api/resources/:id
// @desc    Update resource
// @access  Public
router.put('/:id', async (req, res, next) => {
    try {
        const { name, role, department, email } = req.body;

        // Check if exists
        const [exists] = await db.query('SELECT id FROM resources WHERE id = ?', [req.params.id]);
        if (exists.length === 0) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        await db.query(
            'UPDATE resources SET name = ?, role = ?, department = ?, email = ? WHERE id = ?',
            [name, role, department, email, req.params.id]
        );

        res.json({ id: req.params.id, name, role, department, email });
    } catch (err) {
        next(err);
    }
});

// @route   DELETE /api/resources/:id
// @desc    Delete resource
// @access  Public
router.delete('/:id', async (req, res, next) => {
    try {
        const [result] = await db.query('DELETE FROM resources WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        res.json({ success: true, message: 'Resource removed' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
