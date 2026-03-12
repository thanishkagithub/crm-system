const express = require('express');
const router = express.Router();
const db = require('../config/database');

// @route   GET /api/tasks
// @desc    Get all tasks (with optional project filter)
// @access  Public
router.get('/', async (req, res, next) => {
    try {
        let query = 'SELECT * FROM tasks';
        const params = [];

        if (req.query.projectId) {
            query += ' WHERE project_id = ?';
            params.push(req.query.projectId);
        }

        query += ' ORDER BY task_order ASC, created_at ASC';

        const [rows] = await db.query(query, params);

        // Parse notify_users JSON
        const tasks = rows.map(task => ({
            ...task,
            notify_users: typeof task.notify_users === 'string'
                ? JSON.parse(task.notify_users || '[]')
                : task.notify_users
        }));

        res.json(tasks);
    } catch (err) {
        next(err);
    }
});

// @route   GET /api/tasks/:id
// @desc    Get task by ID
// @access  Public
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        const task = rows[0];
        task.notify_users = typeof task.notify_users === 'string'
            ? JSON.parse(task.notify_users || '[]')
            : task.notify_users;

        res.json(task);
    } catch (err) {
        next(err);
    }
});

// @route   POST /api/tasks
// @desc    Create new task
// @access  Public
router.post('/', async (req, res, next) => {
    try {
        const {
            projectId, title, description, estimate, priority,
            taskOwnerId, startDate, dueDate, time, notifyUsers, phase, order
        } = req.body;

        if (!projectId || !title) {
            const error = new Error('Project ID and Title are required');
            error.name = 'ValidationError';
            throw error;
        }

        const [result] = await db.query(
            `INSERT INTO tasks 
       (project_id, title, description, estimate, priority, 
        task_owner_id, start_date, due_date, time, notify_users, phase, task_order) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                projectId,
                title,
                description || '',
                estimate || '',
                priority || 'none',
                taskOwnerId || null,
                startDate || null,
                dueDate || null,
                time || '',
                JSON.stringify(notifyUsers || []),
                phase || '',
                order || 0
            ]
        );

        const newTask = {
            id: result.insertId,
            ...req.body,
            created_at: new Date()
        };

        res.status(201).json(newTask);
    } catch (err) {
        next(err);
    }
});

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Public
router.put('/:id', async (req, res, next) => {
    try {
        const {
            projectId, title, description, estimate, priority,
            taskOwnerId, startDate, dueDate, time, notifyUsers, phase, order
        } = req.body;

        // Check if exists
        const [exists] = await db.query('SELECT id FROM tasks WHERE id = ?', [req.params.id]);
        if (exists.length === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        await db.query(
            `UPDATE tasks 
       SET project_id = ?, title = ?, description = ?, estimate = ?, priority = ?, 
           task_owner_id = ?, start_date = ?, due_date = ?, time = ?, notify_users = ?, 
           phase = ?, task_order = ?
       WHERE id = ?`,
            [
                projectId,
                title,
                description,
                estimate,
                priority,
                taskOwnerId,
                startDate,
                dueDate,
                time,
                JSON.stringify(notifyUsers || []),
                phase,
                order,
                req.params.id
            ]
        );

        res.json({ id: req.params.id, ...req.body });
    } catch (err) {
        next(err);
    }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Public
router.delete('/:id', async (req, res, next) => {
    try {
        const [result] = await db.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        res.json({ success: true, message: 'Task removed' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
