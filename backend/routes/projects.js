const express = require('express');
const router = express.Router();
const db = require('../config/database');

// @route   GET /api/projects
// @desc    Get all projects
// @access  Public
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// @route   GET /api/projects/:id
// @desc    Get project by ID
// @access  Public
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// @route   POST /api/projects
// @desc    Create new project
// @access  Public
router.post('/', async (req, res, next) => {
    try {
        const {
            name, type, department, priority,
            start_date, end_date, project_owner_id, template
        } = req.body;

        if (!name || !department) {
            const error = new Error('Name and Department are required');
            error.name = 'ValidationError';
            throw error;
        }

        const [result] = await db.query(
            `INSERT INTO projects 
       (name, type, department, priority, start_date, end_date, project_owner_id, template) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                type || '',
                department,
                priority || 'none',
                start_date || null,
                end_date || null,
                project_owner_id || null,
                template || ''
            ]
        );

        const newProject = {
            id: result.insertId,
            ...req.body,
            created_at: new Date()
        };

        res.status(201).json(newProject);
    } catch (err) {
        next(err);
    }
});

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Public
router.put('/:id', async (req, res, next) => {
    try {
        const {
            name, type, department, priority,
            start_date, end_date, project_owner_id, template
        } = req.body;

        const [exists] = await db.query('SELECT id FROM projects WHERE id = ?', [req.params.id]);
        if (exists.length === 0) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        await db.query(
            `UPDATE projects 
       SET name = ?, type = ?, department = ?, priority = ?, 
           start_date = ?, end_date = ?, project_owner_id = ?, template = ? 
       WHERE id = ?`,
            [
                name,
                type,
                department,
                priority,
                start_date,
                end_date,
                project_owner_id,
                template,
                req.params.id
            ]
        );

        res.json({ id: req.params.id, ...req.body });
    } catch (err) {
        next(err);
    }
});

// @route   DELETE /api/projects/:id
// @desc    Delete project
// @access  Public
router.delete('/:id', async (req, res, next) => {
    try {
        const [result] = await db.query('DELETE FROM projects WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        res.json({ success: true, message: 'Project removed' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
