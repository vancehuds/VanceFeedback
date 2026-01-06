import express from 'express';
import { getDB } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getSetting } from '../services/email.js';
import { answerKnowledgeBaseQuestion, isAIAvailable } from '../services/ai.js';
import { createAuditLog } from './audit.js';

const router = express.Router();

// Middleware to check super admin role
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '权限不足，仅超级管理员可访问' });
    }
    next();
};

// Middleware to check if AI Q&A feature is enabled
const requireAIQAEnabled = async (req, res, next) => {
    // Check if KB itself is enabled
    const kbEnabled = await getSetting('knowledge_base_enabled');
    if (kbEnabled === false || kbEnabled === 'false') {
        return res.status(403).json({ error: '知识库功能已关闭，AI 问答暂不可用' });
    }

    const aiQaEnabled = await getSetting('ai_qa_enabled');
    if (aiQaEnabled !== true && aiQaEnabled !== 'true') {
        return res.status(403).json({ error: 'AI 知识库问答功能已关闭' });
    }
    next();
};

// Middleware to check if user is AI-banned
const checkAIBan = async (req, res, next) => {
    try {
        const db = getDB();
        const [bans] = await db.query(
            'SELECT id FROM ai_bans WHERE user_id = ?',
            [req.user.id]
        );
        if (bans.length > 0) {
            return res.status(403).json({ error: '您已被禁止使用 AI 功能' });
        }
        next();
    } catch (err) {
        next(err);
    }
};

// Helper to get today's usage count
const getTodayUsageCount = async (userId) => {
    const db = getDB();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [rows] = await db.query(
        `SELECT COUNT(*) as count FROM ai_usage_logs 
         WHERE user_id = ? AND action_type = 'ai_qa' AND created_at >= ?`,
        [userId, today.toISOString().slice(0, 19).replace('T', ' ')]
    );
    return rows[0].count || 0;
};

// Get rate limit status and feature availability
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const aiQaEnabled = await getSetting('ai_qa_enabled');
        const isEnabled = aiQaEnabled === true || aiQaEnabled === 'true';

        if (!isEnabled) {
            return res.json({ enabled: false });
        }

        // Check if user is banned
        const db = getDB();
        const [bans] = await db.query(
            'SELECT id FROM ai_bans WHERE user_id = ?',
            [req.user.id]
        );

        if (bans.length > 0) {
            return res.json({ enabled: true, banned: true });
        }

        // Get usage and limit
        const dailyLimit = parseInt(await getSetting('ai_qa_daily_limit')) || 10;
        const usedCount = await getTodayUsageCount(req.user.id);

        res.json({
            enabled: true,
            banned: false,
            dailyLimit,
            usedCount,
            remaining: Math.max(0, dailyLimit - usedCount)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit a question
router.post('/ask', authenticateToken, requireAIQAEnabled, checkAIBan, async (req, res) => {
    const { question } = req.body;

    if (!question || !question.trim()) {
        return res.status(400).json({ error: '请输入问题' });
    }

    if (question.length > 500) {
        return res.status(400).json({ error: '问题过长，请控制在500字以内' });
    }

    try {
        const db = getDB();

        // Check rate limit
        const dailyLimit = parseInt(await getSetting('ai_qa_daily_limit')) || 10;
        const usedCount = await getTodayUsageCount(req.user.id);

        if (usedCount >= dailyLimit) {
            return res.status(429).json({
                error: '今日问答次数已用完',
                dailyLimit,
                usedCount
            });
        }

        // Check if AI is available
        if (!isAIAvailable()) {
            console.warn('AI Q&A request failed: AI service not initialized');
            return res.status(503).json({ error: 'AI 服务暂不可用' });
        }

        // Search for related articles in knowledge base
        // const db = getDB(); // Already declared
        let articles = [];
        const cleanQuestion = question.trim();

        // Check if "Use All Content" is enabled
        const useAllContent = await getSetting('ai_qa_use_all_content');

        if (useAllContent === true || useAllContent === 'true') {
            const [rows] = await db.query(
                `SELECT title, content FROM kb_articles 
                 WHERE is_published = 1 
                 ORDER BY id DESC 
                 LIMIT 100`
            );
            articles = rows;
            console.log(`[AI-QA] Mode: ALL CONTENT. Question: "${cleanQuestion}", Articles fetched: ${articles.length}`);
        } else {
            // Strategy 1: Search by keywords (split by space)
            const keywords = cleanQuestion.split(/\s+/).filter(k => k.length > 0);

            if (keywords.length > 0) {
                // Build dynamic query
                const conditions = [];
                const params = [];

                keywords.forEach(kw => {
                    conditions.push('(title LIKE ? OR content LIKE ?)');
                    params.push(`%${kw}%`, `%${kw}%`);
                });

                // Allow matching ANY keyword, but we could prioritize?
                const sql = `SELECT title, content FROM kb_articles 
                             WHERE is_published = 1 AND (${conditions.join(' OR ')})
                             LIMIT 5`;

                const [rows] = await db.query(sql, params);
                articles = rows;
            }
            console.log(`[AI-QA] Mode: KEYWORD SEARCH. Question: "${cleanQuestion}", Keywords: [${keywords.join(', ')}], Articles found: ${articles.length}`);
        }

        // Generate answer
        const answer = await answerKnowledgeBaseQuestion(question, articles);

        // Log usage
        await db.query(
            'INSERT INTO ai_usage_logs (user_id, action_type) VALUES (?, ?)',
            [req.user.id, 'ai_qa']
        );

        // Get updated count
        const newUsedCount = usedCount + 1;

        res.json({
            answer,
            usedCount: newUsedCount,
            remaining: Math.max(0, dailyLimit - newUsedCount)
        });
    } catch (err) {
        console.error('AI Q&A error:', err);
        res.status(500).json({ error: err.message || 'AI 问答失败' });
    }
});

// ============ ADMIN ENDPOINTS ============

// Get banned users list
router.get('/admin/banned', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const db = getDB();
        const [bans] = await db.query(`
            SELECT ab.id, ab.user_id, ab.reason, ab.created_at,
                   u.username, u.email,
                   admin.username as banned_by_username
            FROM ai_bans ab
            JOIN users u ON ab.user_id = u.id
            LEFT JOIN users admin ON ab.banned_by = admin.id
            ORDER BY ab.created_at DESC
        `);
        res.json(bans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ban a user from AI
router.post('/admin/ban/:userId', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { userId } = req.params;
    const { reason } = req.body;

    try {
        const db = getDB();

        // Check if user exists
        const [users] = await db.query('SELECT id, username FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // Check if already banned
        const [existing] = await db.query('SELECT id FROM ai_bans WHERE user_id = ?', [userId]);
        if (existing.length > 0) {
            return res.status(400).json({ error: '用户已被封禁' });
        }

        // Create ban
        await db.query(
            'INSERT INTO ai_bans (user_id, reason, banned_by) VALUES (?, ?, ?)',
            [userId, reason || null, req.user.id]
        );

        await createAuditLog(
            req.user.id, req.user.username, 'ai_ban_user', 'user',
            parseInt(userId), { reason, username: users[0].username }, req.ip
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Unban a user
router.delete('/admin/ban/:userId', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { userId } = req.params;

    try {
        const db = getDB();

        // Check if user is banned
        const [existing] = await db.query('SELECT id FROM ai_bans WHERE user_id = ?', [userId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: '用户未被封禁' });
        }

        // Get username for audit log
        const [users] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);

        // Remove ban
        await db.query('DELETE FROM ai_bans WHERE user_id = ?', [userId]);

        await createAuditLog(
            req.user.id, req.user.username, 'ai_unban_user', 'user',
            parseInt(userId), { username: users[0]?.username }, req.ip
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset user's rate limit
router.post('/admin/reset-limit/:userId', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { userId } = req.params;

    try {
        const db = getDB();

        // Check if user exists
        const [users] = await db.query('SELECT id, username FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // Delete today's usage logs for this user
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await db.query(
            `DELETE FROM ai_usage_logs 
             WHERE user_id = ? AND action_type = 'ai_qa' AND created_at >= ?`,
            [userId, today.toISOString().slice(0, 19).replace('T', ' ')]
        );

        await createAuditLog(
            req.user.id, req.user.username, 'ai_reset_limit', 'user',
            parseInt(userId), { username: users[0].username }, req.ip
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get user's AI Q&A usage
router.get('/admin/usage/:userId', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { userId } = req.params;

    try {
        const db = getDB();
        const dailyLimit = parseInt(await getSetting('ai_qa_daily_limit')) || 10;
        const usedCount = await getTodayUsageCount(userId);

        // Check if banned
        const [bans] = await db.query('SELECT id, reason, created_at FROM ai_bans WHERE user_id = ?', [userId]);

        res.json({
            dailyLimit,
            usedCount,
            remaining: Math.max(0, dailyLimit - usedCount),
            banned: bans.length > 0,
            banInfo: bans[0] || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
