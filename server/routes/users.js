import express from 'express';
import { getDB } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import { createAuditLog } from './audit.js';
import { JWT_SECRET } from '../security.js';

const router = express.Router();

// Middleware to check admin role (both admin and super_admin can access)
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '权限不足,仅管理员可访问' });
    }
    next();
};

// Middleware to check if user can modify roles (super admin only)
const canModifyRole = (req, res, next) => {
    if (req.body.role && req.user.role !== 'super_admin') {
        // Allow admin to set role to 'user'
        if (req.user.role === 'admin' && req.body.role === 'user') {
            return next();
        }
        return res.status(403).json({ error: '权限不足,仅超级管理员可修改权限' });
    }
    next();
};

// Handle unsubscribe link (Public)
router.get('/unsubscribe', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).send('<h1>缺少令牌 invalid token</h1>');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'unsubscribe') {
            return res.status(400).send('<h1>无效的令牌 invalid token type</h1>');
        }

        const db = getDB();
        await db.query('UPDATE users SET email_notification_enabled = 0 WHERE id = ?', [decoded.userId]);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>取消订阅成功</title>
                <style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f9fafb; }
                    .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; }
                    h1 { color: #10b981; margin-bottom: 1rem; }
                    p { color: #6b7280; }
                    a { color: #4f46e5; text-decoration: none; margin-top: 1rem; display: inline-block; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>✅ 取消订阅成功</h1>
                    <p>您将不再收到工单回复的邮件通知。</p>
                    <a href="/">返回首页</a>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Unsubscribe error:', err);
        res.status(400).send('<h1>链接无效或已过期</h1><p>Link invalid or expired</p>');
    }
});

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    // List users (Admin only)
    const { page = 1, limit = 20, role, search } = req.query;
    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
    if (isNaN(limitNum) || limitNum < 1) limitNum = 20;
    if (limitNum > 100) limitNum = 100; // Cap limit

    const offset = (pageNum - 1) * limitNum;

    try {
        const db = getDB();

        // Build query conditions
        let whereConditions = [];
        let queryParams = [];

        if (role && role !== 'all') {
            whereConditions.push('role = ?');
            queryParams.push(role);
        }

        if (search) {
            whereConditions.push('(username LIKE ? OR email LIKE ? OR real_name LIKE ? OR nickname LIKE ?)');
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        const whereClause = whereConditions.length > 0 ? ' WHERE ' + whereConditions.join(' AND ') : '';

        // 1. Get total count
        const countSql = `SELECT COUNT(*) as total FROM users${whereClause}`;
        const [countResult] = await db.query(countSql, queryParams);
        const total = countResult[0].total;

        // 2. Get paginated users
        const usersSql = `SELECT id, username, email, student_id, real_name, nickname, role, email_notification_enabled, created_at FROM users${whereClause} LIMIT ? OFFSET ?`;
        const [users] = await db.query(usersSql, [...queryParams, limitNum, offset]);

        // 3. Get global stats (efficient enough for admin panel)
        const [adminCountRes] = await db.query("SELECT COUNT(*) as count FROM users WHERE role IN ('admin', 'super_admin')");
        const [userCountRes] = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'user'");

        res.json({
            users,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            },
            stats: {
                total_admins: adminCountRes[0].count,
                total_users: userCountRes[0].count
            }
        });
    } catch (err) {
        console.error('Fetch users error:', err);
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

router.post('/promote', authenticateToken, async (req, res) => {
    // Promote user to admin (Super Admin only)
    const { userId, role } = req.body;
    try {
        const db = getDB();

        // Get old role for audit log
        const [users] = await db.query('SELECT username, role FROM users WHERE id = ?', [userId]);
        const oldRole = users[0]?.role;

        await db.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

        // Create audit log
        await createAuditLog(
            req.user.id,
            req.user.username,
            'change_role',
            'user',
            userId,
            { username: users[0]?.username, oldRole, newRole: role },
            req.ip
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

router.post('/', authenticateToken, requireAdmin, canModifyRole, async (req, res) => {
    const { username, password, role, email, student_id, real_name, nickname } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const db = getDB();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Simple duplicate check (DB will also throw error due to UNIQUE constraint)
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const [result] = await db.query(
            'INSERT INTO users (username, password_hash, role, email, student_id, real_name, nickname, email_notification_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, role || 'user', email || null, student_id || null, real_name || null, nickname || null, 1]
        );

        // Create audit log for user creation
        await createAuditLog(
            req.user.id,
            req.user.username,
            'create_user',
            'user',
            result.insertId,
            { username, role: role || 'user', email, student_id, real_name, nickname },
            req.ip
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

router.put('/:id', authenticateToken, requireAdmin, canModifyRole, async (req, res) => {
    const { id } = req.params;
    const { username, password, role, email, student_id, real_name, nickname } = req.body;
    try {
        const db = getDB();

        // Check target user's role if not super_admin
        if (req.user.role !== 'super_admin') {
            const [targets] = await db.query('SELECT role FROM users WHERE id = ?', [id]);
            const targetRole = targets[0]?.role;
            if (targetRole === 'admin' || targetRole === 'super_admin') {
                return res.status(403).json({ error: '权限不足,无法修改管理员账户' });
            }
        }

        const updates = [];
        const params = [];

        if (username) {
            updates.push('username = ?');
            params.push(username);
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password_hash = ?');
            params.push(hashedPassword);
        }
        if (role) {
            updates.push('role = ?');
            params.push(role);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            params.push(email || null);
        }
        if (student_id !== undefined) {
            updates.push('student_id = ?');
            params.push(student_id || null);
        }
        if (real_name !== undefined) {
            updates.push('real_name = ?');
            params.push(real_name || null);
        }
        if (nickname !== undefined) {
            updates.push('nickname = ?');
            params.push(nickname || null);
        }
        if (req.body.email_notification_enabled !== undefined) {
            updates.push('email_notification_enabled = ?');
            params.push(req.body.email_notification_enabled ? 1 : 0);
        }

        if (updates.length > 0) {
            params.push(id);
            await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

            // Create audit log for user update
            await createAuditLog(
                req.user.id,
                req.user.username,
                'update_user',
                'user',
                id,
                { changes: updates.map(u => u.split(' = ')[0]) },
                req.ip
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

export default router;
