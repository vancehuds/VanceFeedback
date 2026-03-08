import express from 'express';
import { getDB } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createAuditLog } from './audit.js';

const router = express.Router();

// Middleware to check super_admin role
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '仅超级管理员可访问' });
    }
    next();
};

// Get all active announcements (public, no auth required)
router.get('/public', async (req, res) => {
    try {
        const db = getDB();
        const [announcements] = await db.query(
            'SELECT id, title, content, priority, created_at FROM announcements WHERE is_active = 1 ORDER BY priority DESC, created_at DESC'
        );
        res.json(announcements);
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Get all announcements (super_admin only)
router.get('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const db = getDB();
        const [announcements] = await db.query(
            'SELECT * FROM announcements ORDER BY priority DESC, created_at DESC'
        );
        res.json(announcements);
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Create announcement (super_admin only)
router.post('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { title, content, priority = 0, is_active = 1 } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: '标题和内容不能为空' });
    }

    try {
        const db = getDB();
        const [result] = await db.query(
            'INSERT INTO announcements (title, content, priority, is_active) VALUES (?, ?, ?, ?)',
            [title, content, priority, is_active]
        );

        // Create audit log
        await createAuditLog(
            req.user.id,
            req.user.username,
            'create_announcement',
            'announcement',
            result.insertId,
            { title, priority },
            req.ip
        );

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Update announcement (super_admin only)
router.put('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, content, priority, is_active } = req.body;

    try {
        const db = getDB();

        // Check if announcement exists
        const [existing] = await db.query('SELECT * FROM announcements WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: '公告不存在' });
        }

        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (content !== undefined) {
            updates.push('content = ?');
            params.push(content);
        }
        if (priority !== undefined) {
            updates.push('priority = ?');
            params.push(priority);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active);
        }

        if (updates.length > 0) {
            params.push(id);
            await db.query(
                `UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        // Create audit log
        await createAuditLog(
            req.user.id,
            req.user.username,
            'update_announcement',
            'announcement',
            parseInt(id),
            { title: title || existing[0].title },
            req.ip
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Toggle announcement active status (super_admin only)
router.put('/:id/toggle', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const db = getDB();

        // Get current status
        const [announcements] = await db.query('SELECT * FROM announcements WHERE id = ?', [id]);
        if (announcements.length === 0) {
            return res.status(404).json({ error: '公告不存在' });
        }

        const newStatus = announcements[0].is_active ? 0 : 1;
        await db.query('UPDATE announcements SET is_active = ? WHERE id = ?', [newStatus, id]);

        // Create audit log
        await createAuditLog(
            req.user.id,
            req.user.username,
            'toggle_announcement',
            'announcement',
            parseInt(id),
            { title: announcements[0].title, is_active: newStatus },
            req.ip
        );

        res.json({ success: true, is_active: newStatus });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Delete announcement (super_admin only)
router.delete('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const db = getDB();

        // Check if announcement exists
        const [announcements] = await db.query('SELECT * FROM announcements WHERE id = ?', [id]);
        if (announcements.length === 0) {
            return res.status(404).json({ error: '公告不存在' });
        }

        await db.query('DELETE FROM announcements WHERE id = ?', [id]);

        // Create audit log
        await createAuditLog(
            req.user.id,
            req.user.username,
            'delete_announcement',
            'announcement',
            parseInt(id),
            { title: announcements[0].title },
            req.ip
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

export default router;
