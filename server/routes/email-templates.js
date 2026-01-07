import express from 'express';
import { getDB } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware to ensure Super Admin
const requireSuperAdmin = async (req, res, next) => {
    try {
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Permission denied' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /api/email-templates - List all templates
router.get('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const db = getDB();
        const [rows] = await db.query('SELECT * FROM email_templates ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching email templates:', err);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// PUT /api/email-templates/:key - Update a template
router.put('/:key', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { key } = req.params;
    const { subject, content } = req.body;

    if (!subject || !content) {
        return res.status(400).json({ error: 'Subject and content are required' });
    }

    try {
        const db = getDB();
        // Check if exists
        const [existing] = await db.query('SELECT id FROM email_templates WHERE template_key = ?', [key]);

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Update
        const isSQLite = db.db && db.db.driver; // Simple check if SQLiteAdapter
        if (isSQLite) {
            await db.query(
                'UPDATE email_templates SET subject = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE template_key = ?',
                [subject, content, key]
            );
        } else {
            await db.query(
                'UPDATE email_templates SET subject = ?, content = ? WHERE template_key = ?',
                [subject, content, key]
            );
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating email template:', { key, error: err });
        res.status(500).json({ error: 'Failed to update template' });
    }
});

export default router;
