import express from 'express';
import { getDB } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

import { getSetting } from '../services/email.js';
import { createAuditLog } from './audit.js';

const router = express.Router();

// Helper function to generate slug from title
const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-') // Keep Chinese characters - replace sequences of non-word/non-Chinese chars with single dash
        .replace(/^-|-$/g, '') // Remove leading/trailing dashes
        .substring(0, 100);
};

// Middleware to check if KB is enabled
const checkKBEnabled = async (req, res, next) => {
    // Super admin can always access
    if (req.user && req.user.role === 'super_admin') {
        return next();
    }

    const enabled = await getSetting('knowledge_base_enabled');
    if (enabled === false || enabled === 'false') {
        return res.status(403).json({ error: '知识库功能已关闭' });
    }
    next();
};

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '权限不足' });
    }
    next();
};

// ============ PUBLIC ENDPOINTS ============

// Get all active categories (public)
router.get('/categories', checkKBEnabled, async (req, res) => {
    try {
        const db = getDB();
        const [categories] = await db.query(`
            SELECT c.id, c.name, c.slug, c.description, c.icon,
                   (SELECT COUNT(*) FROM kb_articles a WHERE a.category_id = c.id AND a.is_published = 1) as article_count
            FROM kb_categories c
            WHERE c.is_active = 1
            ORDER BY c.sort_order ASC, c.name ASC
        `);
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get published articles (public, with search & filter)
router.get('/articles', checkKBEnabled, async (req, res) => {
    const { category, search, page = 1, limit = 10 } = req.query;

    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
    if (isNaN(limitNum) || limitNum < 1) limitNum = 10;
    if (limitNum > 50) limitNum = 50;
    const offset = (pageNum - 1) * limitNum;

    try {
        const db = getDB();
        let conditions = ['a.is_published = 1'];
        let params = [];

        if (category) {
            conditions.push('c.slug = ?');
            params.push(category);
        }

        if (search) {
            conditions.push('(a.title LIKE ? OR a.content LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count total
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM kb_articles a 
             LEFT JOIN kb_categories c ON a.category_id = c.id 
             ${whereClause}`,
            params
        );
        const total = countResult[0].total;

        // Get paginated articles
        const [articles] = await db.query(
            `SELECT a.id, a.title, a.slug, a.views, a.created_at, a.updated_at,
                    c.id as category_id, c.name as category_name, c.slug as category_slug, c.icon as category_icon,
                    SUBSTRING(a.content, 1, 200) as excerpt
             FROM kb_articles a
             LEFT JOIN kb_categories c ON a.category_id = c.id
             ${whereClause}
             ORDER BY a.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limitNum, offset]
        );

        res.json({
            articles,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single article by slug (public, increments view count)
router.get('/articles/:slug', checkKBEnabled, async (req, res) => {
    const { slug } = req.params;

    try {
        const db = getDB();

        // Get article
        const [articles] = await db.query(
            `SELECT a.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon,
                    u.username as author_name
             FROM kb_articles a
             LEFT JOIN kb_categories c ON a.category_id = c.id
             LEFT JOIN users u ON a.created_by = u.id
             WHERE a.slug = ? AND a.is_published = 1`,
            [slug]
        );

        if (articles.length === 0) {
            return res.status(404).json({ error: '文章不存在' });
        }

        const article = articles[0];

        // Increment view count (fire and forget)
        db.query('UPDATE kb_articles SET views = views + 1 WHERE id = ?', [article.id]).catch(() => { });

        // Get related articles in same category
        const [related] = await db.query(
            `SELECT id, title, slug, views FROM kb_articles 
             WHERE category_id = ? AND id != ? AND is_published = 1
             ORDER BY views DESC LIMIT 5`,
            [article.category_id, article.id]
        );

        res.json({ article, related });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============ ADMIN ENDPOINTS ============

// Get all categories (admin)
router.get('/admin/categories', authenticateToken, requireAdmin, checkKBEnabled, async (req, res) => {
    try {
        const db = getDB();
        const [categories] = await db.query(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM kb_articles a WHERE a.category_id = c.id) as article_count
            FROM kb_categories c
            ORDER BY c.sort_order ASC, c.name ASC
        `);
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create category (admin)
router.post('/admin/categories', authenticateToken, requireAdmin, checkKBEnabled, async (req, res) => {
    const { name, description, icon = '📁', sort_order = 0, is_active = 1 } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: '分类名称不能为空' });
    }

    const slug = generateSlug(name) + '-' + Date.now().toString(36);

    try {
        const db = getDB();
        const [result] = await db.query(
            'INSERT INTO kb_categories (name, slug, description, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            [name.trim(), slug, description || '', icon, sort_order, is_active]
        );

        await createAuditLog(
            req.user.id, req.user.username, 'create_kb_category', 'kb_category',
            result.insertId, { name }, req.ip
        );

        res.json({ success: true, id: result.insertId, slug });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update category (admin)
router.put('/admin/categories/:id', authenticateToken, requireAdmin, checkKBEnabled, async (req, res) => {
    const { id } = req.params;
    const { name, description, icon, sort_order, is_active } = req.body;

    try {
        const db = getDB();

        const [existing] = await db.query('SELECT * FROM kb_categories WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: '分类不存在' });
        }

        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (icon !== undefined) {
            updates.push('icon = ?');
            params.push(icon);
        }
        if (sort_order !== undefined) {
            updates.push('sort_order = ?');
            params.push(sort_order);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active);
        }

        if (updates.length > 0) {
            params.push(id);
            await db.query(`UPDATE kb_categories SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        await createAuditLog(
            req.user.id, req.user.username, 'update_kb_category', 'kb_category',
            parseInt(id), { name: name || existing[0].name }, req.ip
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete category (admin)
router.delete('/admin/categories/:id', authenticateToken, requireAdmin, checkKBEnabled, async (req, res) => {
    const { id } = req.params;

    try {
        const db = getDB();

        const [existing] = await db.query('SELECT * FROM kb_categories WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: '分类不存在' });
        }

        // Check if category has articles
        const [articles] = await db.query('SELECT COUNT(*) as count FROM kb_articles WHERE category_id = ?', [id]);
        if (articles[0].count > 0) {
            return res.status(400).json({ error: '该分类下还有文章，无法删除' });
        }

        await db.query('DELETE FROM kb_categories WHERE id = ?', [id]);

        await createAuditLog(
            req.user.id, req.user.username, 'delete_kb_category', 'kb_category',
            parseInt(id), { name: existing[0].name }, req.ip
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all articles (admin)
router.get('/admin/articles', authenticateToken, requireAdmin, checkKBEnabled, async (req, res) => {
    const { category, search, page = 1, limit = 20 } = req.query;

    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
    if (isNaN(limitNum) || limitNum < 1) limitNum = 20;
    const offset = (pageNum - 1) * limitNum;

    try {
        const db = getDB();
        let conditions = [];
        let params = [];

        if (category) {
            conditions.push('a.category_id = ?');
            params.push(category);
        }

        if (search) {
            conditions.push('(a.title LIKE ? OR a.content LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM kb_articles a ${whereClause}`,
            params
        );
        const total = countResult[0].total;

        const [articles] = await db.query(
            `SELECT a.*, c.name as category_name, u.username as author_name
             FROM kb_articles a
             LEFT JOIN kb_categories c ON a.category_id = c.id
             LEFT JOIN users u ON a.created_by = u.id
             ${whereClause}
             ORDER BY a.updated_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limitNum, offset]
        );

        res.json({
            articles,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create article (admin)
router.post('/admin/articles', authenticateToken, requireAdmin, checkKBEnabled, async (req, res) => {
    const { title, category_id, content, is_published = 0 } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: '文章标题不能为空' });
    }
    if (!content || !content.trim()) {
        return res.status(400).json({ error: '文章内容不能为空' });
    }

    const slug = generateSlug(title) + '-' + Date.now().toString(36);

    try {
        const db = getDB();
        const [result] = await db.query(
            'INSERT INTO kb_articles (title, slug, category_id, content, is_published, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [title.trim(), slug, category_id || null, content, is_published, req.user.id]
        );

        await createAuditLog(
            req.user.id, req.user.username, 'create_kb_article', 'kb_article',
            result.insertId, { title }, req.ip
        );

        res.json({ success: true, id: result.insertId, slug });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update article (admin)
router.put('/admin/articles/:id', authenticateToken, requireAdmin, checkKBEnabled, async (req, res) => {
    const { id } = req.params;
    const { title, category_id, content, is_published } = req.body;

    try {
        const db = getDB();

        const [existing] = await db.query('SELECT * FROM kb_articles WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: '文章不存在' });
        }

        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (category_id !== undefined) {
            updates.push('category_id = ?');
            params.push(category_id || null);
        }
        if (content !== undefined) {
            updates.push('content = ?');
            params.push(content);
        }
        if (is_published !== undefined) {
            updates.push('is_published = ?');
            params.push(is_published);
        }

        if (updates.length > 0) {
            params.push(id);
            await db.query(`UPDATE kb_articles SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        await createAuditLog(
            req.user.id, req.user.username, 'update_kb_article', 'kb_article',
            parseInt(id), { title: title || existing[0].title }, req.ip
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete article (admin)
router.delete('/admin/articles/:id', authenticateToken, requireAdmin, checkKBEnabled, async (req, res) => {
    const { id } = req.params;

    try {
        const db = getDB();

        const [existing] = await db.query('SELECT * FROM kb_articles WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: '文章不存在' });
        }

        await db.query('DELETE FROM kb_articles WHERE id = ?', [id]);

        await createAuditLog(
            req.user.id, req.user.username, 'delete_kb_article', 'kb_article',
            parseInt(id), { title: existing[0].title }, req.ip
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle article publish status (admin)
router.put('/admin/articles/:id/toggle', authenticateToken, requireAdmin, checkKBEnabled, async (req, res) => {
    const { id } = req.params;

    try {
        const db = getDB();

        const [articles] = await db.query('SELECT * FROM kb_articles WHERE id = ?', [id]);
        if (articles.length === 0) {
            return res.status(404).json({ error: '文章不存在' });
        }

        const newStatus = articles[0].is_published ? 0 : 1;
        await db.query('UPDATE kb_articles SET is_published = ? WHERE id = ?', [newStatus, id]);

        await createAuditLog(
            req.user.id, req.user.username, 'toggle_kb_article', 'kb_article',
            parseInt(id), { title: articles[0].title, is_published: newStatus }, req.ip
        );

        res.json({ success: true, is_published: newStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
