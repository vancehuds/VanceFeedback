import express from 'express';
import { getDB } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper function to clean IPv6-mapped IPv4 addresses
const cleanIPAddress = (ip) => {
    if (!ip) return ip;
    // Remove IPv6-mapped IPv4 prefix (::ffff:)
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    return ip;
};

// Helper function to create audit log entry
export const createAuditLog = async (userId, username, action, targetType, targetId, details, ipAddress) => {
    try {
        const db = getDB();
        const cleanedIP = cleanIPAddress(ipAddress);
        await db.query(
            'INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, username, action, targetType, targetId, JSON.stringify(details), cleanedIP]
        );
    } catch (err) {
        console.error('Failed to create audit log:', err.message);
    }
};

// Middleware to check super_admin role
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '仅超级管理员可访问' });
    }
    next();
};

// Get audit logs (super_admin only)
router.get('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { page = 1, limit = 20, action, targetType } = req.query;
    const offset = (page - 1) * limit;

    try {
        const db = getDB();
        let query = 'SELECT * FROM audit_logs';
        let countQuery = 'SELECT COUNT(*) as total FROM audit_logs';
        const conditions = [];
        const params = [];

        if (action) {
            conditions.push('action = ?');
            params.push(action);
        }
        if (targetType) {
            conditions.push('target_type = ?');
            params.push(targetType);
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [logs] = await db.query(query, params);
        const [countResult] = await db.query(countQuery, params.slice(0, -2));
        const total = countResult[0]?.total || 0;

        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Get action types for filtering
router.get('/actions', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const db = getDB();
        const [actions] = await db.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
        res.json(actions.map(a => a.action));
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

export default router;
