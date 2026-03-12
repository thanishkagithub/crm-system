const express = require('express');
const router = express.Router();
const db = require('../config/database');

// @route   GET /api/assignments
// @desc    Get all assignments
// @access  Public
router.get('/', async (req, res, next) => {
    try {
        let query = 'SELECT * FROM assignments';
        const params = [];

        // Support filtering
        if (req.query.projectId) {
            query += ' WHERE project_id = ?';
            params.push(req.query.projectId);
        } else if (req.query.taskId) {
            query += ' WHERE task_id = ?';
            params.push(req.query.taskId);
        } else if (req.query.resourceId) {
            query += ' WHERE resource_id = ?';
            params.push(req.query.resourceId);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// @route   GET /api/assignments/:id
// @desc    Get assignment by ID
// @access  Public
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// @route   POST /api/assignments
// @desc    Create new assignment
// @access  Public
router.post('/', async (req, res, next) => {
    try {
        const { projectId, taskId, resourceId, status, dueDate } = req.body;

        if (!projectId || !taskId || !resourceId) {
            const error = new Error('Project, Task, and Resource IDs are required');
            error.name = 'ValidationError';
            throw error;
        }

        const [result] = await db.query(
            `INSERT INTO assignments 
       (project_id, task_id, resource_id, status, due_date) 
       VALUES (?, ?, ?, ?, ?)`,
            [
                projectId,
                taskId,
                resourceId,
                status || 'pending',
                dueDate || null
            ]
        );

        const newAssignment = {
            id: result.insertId,
            ...req.body,
            created_at: new Date()
        };

        res.status(201).json(newAssignment);
    } catch (err) {
        next(err);
    }
});

// @route   PUT /api/assignments/:id
// @desc    Update assignment (status, etc)
// @access  Public
router.put('/:id', async (req, res, next) => {
    try {
        const { projectId, taskId, resourceId, status, dueDate } = req.body;

        const [exists] = await db.query('SELECT id FROM assignments WHERE id = ?', [req.params.id]);
        if (exists.length === 0) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

        let completedAt = null;
        if (status === 'completed') {
            completedAt = new Date();
        }

        await db.query(
            `UPDATE assignments 
       SET project_id = ?, task_id = ?, resource_id = ?, status = ?, 
           due_date = ?, completed_at = ?
       WHERE id = ?`,
            [
                projectId,
                taskId,
                resourceId,
                status,
                dueDate,
                completedAt,
                req.params.id
            ]
        );

        res.json({ id: req.params.id, ...req.body });
    } catch (err) {
        next(err);
    }
});

// @route   DELETE /api/assignments/:id
// @desc    Delete assignment
// @access  Public
router.delete('/:id', async (req, res, next) => {
    try {
        const [result] = await db.query('DELETE FROM assignments WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

        res.json({ success: true, message: 'Assignment removed' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
