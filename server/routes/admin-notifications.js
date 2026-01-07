import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getDB } from '../db.js';

const router = express.Router();

// Middleware to check if user is an admin or super admin
const requireAdminRole = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '权限不足,仅管理员可访问' });
    }
    next();
};

// Middleware to check super admin role
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '权限不足,仅超级管理员可访问' });
    }
    next();
};

// Get current admin's notification emails
router.get('/', authenticateToken, requireAdminRole, async (req, res) => {
    try {
        const db = getDB();
        const [rows] = await db.query(
            'SELECT id, email, created_at FROM admin_notification_emails WHERE admin_id = ?',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all notification emails (Super admin only)
router.get('/all', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const db = getDB();
        const [rows] = await db.query(`
            SELECT 
                ane.id,
                ane.email,
                ane.admin_id,
                ane.created_at,
                u.username as admin_username,
                u.role as admin_role
            FROM admin_notification_emails ane
            INNER JOIN users u ON ane.admin_id = u.id
            ORDER BY ane.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a notification email
router.post('/', authenticateToken, requireAdminRole, async (req, res) => {
    const { email } = req.body;

    if (!email || !email.trim()) {
        return res.status(400).json({ error: '邮箱地址不能为空' });
    }

    // Email validation - using a safer regex pattern to prevent ReDoS
    const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: '邮箱地址格式不正确' });
    }

    try {
        const db = getDB();

        // Check count limit for non-super admins
        if (req.user.role !== 'super_admin') {
            const [existing] = await db.query(
                'SELECT COUNT(*) as count FROM admin_notification_emails WHERE admin_id = ?',
                [req.user.id]
            );

            if (existing[0].count >= 1) {
                return res.status(400).json({ error: '普通管理员仅可设置1个通知邮箱' });
            }
        }

        // Check for duplicate email for this admin
        const [duplicate] = await db.query(
            'SELECT id FROM admin_notification_emails WHERE admin_id = ? AND email = ?',
            [req.user.id, email.trim()]
        );

        if (duplicate.length > 0) {
            return res.status(400).json({ error: '该邮箱已添加' });
        }

        // Insert the email
        await db.query(
            'INSERT INTO admin_notification_emails (admin_id, email) VALUES (?, ?)',
            [req.user.id, email.trim()]
        );

        res.json({ success: true, message: '通知邮箱添加成功' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a notification email
router.delete('/:id', authenticateToken, requireAdminRole, async (req, res) => {
    const { id } = req.params;

    try {
        const db = getDB();

        // Check if the email belongs to this admin or if user is super admin
        const [rows] = await db.query(
            'SELECT admin_id FROM admin_notification_emails WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: '通知邮箱不存在' });
        }

        // Only allow deletion if it's the admin's own email or if user is super admin
        if (rows[0].admin_id !== req.user.id && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: '无权删除其他管理员的通知邮箱' });
        }

        await db.query('DELETE FROM admin_notification_emails WHERE id = ?', [id]);
        res.json({ success: true, message: '通知邮箱删除成功' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
