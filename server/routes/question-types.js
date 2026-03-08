import express from 'express';
import { getDB } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createAuditLog } from './audit.js';

const router = express.Router();

// Middleware to check super admin role
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '权限不足，仅超级管理员可访问' });
    }
    next();
};

// Get all active question types (public)
router.get('/', async (req, res) => {
    try {
        const db = getDB();
        const [rows] = await db.query(
            'SELECT id, type_key, label, emoji, description, sort_order FROM question_types WHERE is_active = 1 ORDER BY sort_order ASC'
        );
        res.json(rows);
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Get all question types including inactive (super admin only)
router.get('/all', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const db = getDB();
        const [rows] = await db.query(
            'SELECT * FROM question_types ORDER BY sort_order ASC'
        );
        res.json(rows);
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Create question type (super admin only)
router.post('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { type_key, label, emoji, description, sort_order } = req.body;

        if (!type_key || !label || !emoji) {
            return res.status(400).json({ error: '类型标识、名称和图标为必填项' });
        }

        // Validate type_key format (alphanumeric and underscore only)
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(type_key)) {
            return res.status(400).json({ error: '类型标识必须以字母开头，只能包含字母、数字和下划线' });
        }

        const db = getDB();

        // Check if type_key already exists
        const [existing] = await db.query('SELECT id FROM question_types WHERE type_key = ?', [type_key]);
        if (existing.length > 0) {
            return res.status(400).json({ error: '该类型标识已存在' });
        }

        const [result] = await db.query(
            'INSERT INTO question_types (type_key, label, emoji, description, sort_order) VALUES (?, ?, ?, ?, ?)',
            [type_key, label, emoji, description || '', sort_order || 0]
        );

        // Create audit log
        await createAuditLog(
            req.user.id,
            req.user.username,
            'create_question_type',
            'question_type',
            result.insertId,
            { type_key, label, emoji },
            req.ip
        );

        res.json({
            success: true,
            id: result.insertId,
            message: '问题类型添加成功'
        });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Update question type (super admin only)
router.put('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { type_key, label, emoji, description, sort_order, is_active } = req.body;

        if (!type_key || !label || !emoji) {
            return res.status(400).json({ error: '类型标识、名称和图标为必填项' });
        }

        // Validate type_key format
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(type_key)) {
            return res.status(400).json({ error: '类型标识必须以字母开头，只能包含字母、数字和下划线' });
        }

        const db = getDB();

        // Check if type_key already exists (for another record)
        const [existing] = await db.query('SELECT id FROM question_types WHERE type_key = ? AND id != ?', [type_key, id]);
        if (existing.length > 0) {
            return res.status(400).json({ error: '该类型标识已被其他类型使用' });
        }

        await db.query(
            'UPDATE question_types SET type_key = ?, label = ?, emoji = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ?',
            [type_key, label, emoji, description || '', sort_order || 0, is_active !== undefined ? is_active : 1, id]
        );

        // Create audit log
        await createAuditLog(
            req.user.id,
            req.user.username,
            'update_question_type',
            'question_type',
            id,
            { type_key, label, emoji, is_active },
            req.ip
        );

        res.json({ success: true, message: '问题类型更新成功' });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Delete question type (super admin only)
router.delete('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();

        // Check if any tickets are using this type
        const [typeInfo] = await db.query('SELECT type_key FROM question_types WHERE id = ?', [id]);
        if (typeInfo.length === 0) {
            return res.status(404).json({ error: '问题类型不存在' });
        }

        const [tickets] = await db.query('SELECT COUNT(*) as count FROM tickets WHERE type = ?', [typeInfo[0].type_key]);
        if (tickets[0].count > 0) {
            return res.status(400).json({
                error: `该类型下有 ${tickets[0].count} 个工单，无法删除。建议禁用该类型。`
            });
        }

        // Create audit log before deletion
        await createAuditLog(
            req.user.id,
            req.user.username,
            'delete_question_type',
            'question_type',
            id,
            { type_key: typeInfo[0].type_key },
            req.ip
        );

        await db.query('DELETE FROM question_types WHERE id = ?', [id]);
        res.json({ success: true, message: '问题类型删除成功' });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

export default router;
