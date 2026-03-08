import express from 'express';
import { getDB } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createAuditLog } from './audit.js';
import { recaptchaMiddleware } from '../middleware/recaptcha.js';
import { sendFeedbackNotification, sendTicketReplyNotification, getSetting } from '../services/email.js';
import { generateReplySuggestion, isAIAvailable, summarizeTicket, analyzeTrends } from '../services/ai.js';
import { sendDingTalkNotification } from '../services/dingtalk.js';
import crypto from 'crypto';

const router = express.Router();


// ============ AI Summary Cache (Database-backed for Serverless) ============
// Stores AI ticket summaries in the database for persistence across serverless instances.
// Key: (ticket_id, reply_count) - auto-invalidates when replies change

// Helper to generate content hash
function generateContentHash(ticket, replies) {
    const data = JSON.stringify({
        ticket_content: ticket.content,
        replies: replies.map(r => ({ id: r.id, content: r.content, updated_at: r.updated_at || r.created_at }))
    });
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Get cached summary from database or null if not found
 */
async function getCachedSummary(ticketId, contentHash) {
    try {
        const db = getDB();
        // Check by content_hash OR (legacy: reply_count for backward compat during migration)
        // But prioritizing content_hash. Since we want strict caching, we only assume hit if content_hash matches.
        // If the table doesn't support content_hash yet (migration lag), this might fail, so we should be careful.
        // CHECK: If migration added content_hash, we use it. 

        const [rows] = await db.query(
            'SELECT summary, key_points, action_items FROM ticket_summaries WHERE ticket_id = ? AND content_hash = ?',
            [ticketId, contentHash]
        );
        if (rows.length > 0) {
            return {
                summary: rows[0].summary,
                keyPoints: rows[0].key_points ? JSON.parse(rows[0].key_points) : [],
                actionItems: rows[0].action_items ? JSON.parse(rows[0].action_items) : []
            };
        }
        return null;
    } catch (err) {
        console.error('Failed to get cached summary:', err.message);
        return null;
    }
}

/**
 * Helper: Ensure schema has content_hash (Self-Healing)
 */
async function ensureSchemaExistance() {
    try {
        const db = getDB();
        // Try simple select to check column
        try {
            await db.query('SELECT content_hash FROM ticket_summaries LIMIT 1');
        } catch (e) {
            console.log('[Self-Healing] content_hash column missing, adding it...');
            // Determine DB type by checking config or error message ideally, but we can try generic SQL or check config
            // Since we don't have config object here easily, let's try strict approach
            try {
                // Try MySQL syntax first
                await db.query("ALTER TABLE ticket_summaries ADD COLUMN content_hash VARCHAR(64)");
                await db.query("ALTER TABLE ticket_summaries ADD INDEX idx_content_hash (ticket_id, content_hash)");
            } catch (mysqlErr) {
                // If MySQL syntax fails, try SQLite
                try {
                    await db.query("ALTER TABLE ticket_summaries ADD COLUMN content_hash TEXT");
                } catch (sqliteErr) {
                    console.error('[Self-Healing] Failed to add column:', sqliteErr.message);
                }
            }
        }
    } catch (err) {
        console.error('[Self-Healing] Schema check failed:', err);
    }
}

/**
 * Store summary in database cache
 */
async function setCachedSummary(ticketId, replyCount, contentHash, data) {
    const db = getDB();
    const keyPointsJson = JSON.stringify(data.keyPoints || []);
    const actionItemsJson = JSON.stringify(data.actionItems || []);

    const doInsert = async () => {
        // Delete old cache for this ticket
        await db.query('DELETE FROM ticket_summaries WHERE ticket_id = ?', [ticketId]);
        // Insert new
        await db.query(
            'INSERT INTO ticket_summaries (ticket_id, reply_count, content_hash, summary, key_points, action_items) VALUES (?, ?, ?, ?, ?, ?)',
            [ticketId, replyCount, contentHash, data.summary, keyPointsJson, actionItemsJson]
        );
    };

    try {
        await doInsert();
    } catch (err) {
        // Check for missing column error
        if (err.message && (err.message.includes('Unknown column') || err.message.includes('no such column'))) {
            console.warn('Schema mismatch detected, attempting self-heal...');
            await ensureSchemaExistance();
            try {
                await doInsert(); // Retry once
                console.log('Self-heal successful, record inserted.');
            } catch (retryErr) {
                console.error('Failed to cache summary after retry:', retryErr.message);
            }
        } else {
            console.error('Failed to cache summary:', err.message);
        }
    }
}

// Get all tickets (with optional userId filter, publicOnly filter, search, status, and isPublic filters)
// Get ticket statistics (Global)
router.get('/stats', async (req, res) => {
    const { startDate, endDate, days = 30 } = req.query;
    try {
        const db = getDB();

        // Define now for consistent usage throughout the handler
        const now = new Date();

        // Calculate date range
        // Calculate date range in Beijing Time (UTC+8)
        const daysNum = parseInt(days) || 30;

        // Helper to get Beijing Date string (YYYY-MM-DD)
        const getBeijingDateStr = (offsetDays = 0) => {
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000); // Standard UTC
            const beijingTime = new Date(utc + (3600000 * 8)); // Beijing is UTC+8
            if (offsetDays) {
                beijingTime.setDate(beijingTime.getDate() - offsetDays);
            }
            return beijingTime.toISOString().split('T')[0];
        };

        const currentPeriodEnd = endDate || getBeijingDateStr(0);
        const currentPeriodStart = startDate || getBeijingDateStr(daysNum);

        // Previous period for comparison
        const periodLength = Math.ceil((new Date(currentPeriodEnd) - new Date(currentPeriodStart)) / (24 * 60 * 60 * 1000));

        // Ensure accurate date calculation for previous period
        const prevEndObj = new Date(currentPeriodStart);
        prevEndObj.setDate(prevEndObj.getDate() - 1);
        const prevPeriodEnd = prevEndObj.toISOString().split('T')[0];

        const prevStartObj = new Date(prevPeriodEnd);
        prevStartObj.setDate(prevStartObj.getDate() - periodLength);
        const prevPeriodStart = prevStartObj.toISOString().split('T')[0];

        // Build base query for current period
        let overviewQuery = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as reviewed,
                SUM(CASE WHEN is_public = 0 THEN 1 ELSE 0 END) as unreviewed,
                AVG(CASE WHEN rating IS NOT NULL THEN rating END) as avg_rating,
                COUNT(CASE WHEN rating IS NOT NULL THEN 1 END) as rating_count
            FROM tickets
        `;

        const params = [];
        const conditions = [];
        if (startDate || endDate) {
            if (startDate) {
                conditions.push('created_at >= ?');
                params.push(startDate);
            }
            if (endDate) {
                conditions.push('created_at <= ?');
                params.push(endDate + ' 23:59:59');
            }
            overviewQuery += ' WHERE ' + conditions.join(' AND ');
        }

        const [rows] = await db.query(overviewQuery, params);

        // Get previous period stats for comparison
        const [prevRows] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
                AVG(CASE WHEN rating IS NOT NULL THEN rating END) as avg_rating
            FROM tickets
            WHERE created_at >= ? AND created_at <= ?
        `, [prevPeriodStart, prevPeriodEnd + ' 23:59:59']);

        // Type distribution
        let typeQuery = 'SELECT type, COUNT(*) as count FROM tickets';
        if (startDate || endDate) {
            const typeConditions = [];
            if (startDate) typeConditions.push('created_at >= ?');
            if (endDate) typeConditions.push('created_at <= ?');
            typeQuery += ' WHERE ' + typeConditions.join(' AND ');
        }
        typeQuery += ' GROUP BY type';
        const [typeRows] = await db.query(typeQuery, params);

        // Rating distribution (1-5 stars)
        const [ratingRows] = await db.query(`
            SELECT 
                rating,
                COUNT(*) as count
            FROM tickets
            WHERE rating IS NOT NULL
            GROUP BY rating
            ORDER BY rating ASC
        `);

        // Daily trend data (last N days)
        const trendDays = Math.min(daysNum, 90);
        // Fix: Use the now variable defined at top scope
        const trendStartDate = new Date(now.getTime() - trendDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const [dailyTrend] = await db.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as created,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
            FROM tickets
            WHERE created_at >= ?
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [trendStartDate]);

        // Fill in missing dates with zeros
        const trendData = [];
        const dateMap = new Map(dailyTrend.map(d => [d.date.toISOString ? d.date.toISOString().split('T')[0] : d.date, d]));

        // Generate date sequence for the trend period
        const trendEndDateObj = new Date(Date.now() + 8 * 3600 * 1000); // Beijing Time now

        for (let i = trendDays - 1; i >= 0; i--) {
            const d = new Date(trendEndDateObj);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            const existing = dateMap.get(dateStr);
            trendData.push({
                date: dateStr,
                created: existing ? parseInt(existing.created) : 0,
                resolved: existing ? parseInt(existing.resolved) : 0
            });
        }

        // Calculate comparison metrics
        const currentTotal = parseInt(rows[0].total) || 0;
        const prevTotal = parseInt(prevRows[0].total) || 0;
        const currentResolved = parseInt(rows[0].resolved) || 0;
        const prevResolved = parseInt(prevRows[0].resolved) || 0;
        const currentAvgRating = parseFloat(rows[0].avg_rating) || 0;
        const prevAvgRating = parseFloat(prevRows[0].avg_rating) || 0;

        const comparison = {
            totalChange: prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : 0,
            resolvedChange: prevResolved > 0 ? Math.round(((currentResolved - prevResolved) / prevResolved) * 100) : 0,
            ratingChange: prevAvgRating > 0 ? (currentAvgRating - prevAvgRating).toFixed(2) : 0
        };

        res.json({
            overview: rows[0],
            distribution: typeRows,
            ratingDistribution: ratingRows,
            dailyTrend: trendData,
            comparison,
            period: {
                current: { start: currentPeriodStart, end: currentPeriodEnd },
                previous: { start: prevPeriodStart, end: prevPeriodEnd }
            }
        });
    } catch (err) {
        console.error('Stats API Error:', err);
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Get all tickets (with optional userId filter, publicOnly filter, search, status, and isPublic filters)
router.get('/', async (req, res) => {
    const { userId, publicOnly, search, status, isPublic, page = 1, limit = 10 } = req.query;

    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
    if (isNaN(limitNum) || limitNum < 1) limitNum = 10;
    if (limitNum > 100) limitNum = 100; // Cap limit

    const offset = (pageNum - 1) * limitNum;

    try {
        const db = getDB();
        let queryBase = 'FROM tickets';
        let conditions = [];
        let params = [];

        if (userId) {
            conditions.push('user_id = ?');
            params.push(userId);
        }

        // Filter only public tickets (for homepage display)
        if (publicOnly === 'true') {
            conditions.push('is_public = 1');
        }

        // Search by ID or content
        if (search) {
            conditions.push('(CAST(id AS CHAR) LIKE ? OR content LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        // Filter by status (pending, processing, resolved)
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }

        // Filter by review status (is_public)
        if (isPublic !== undefined && isPublic !== '') {
            conditions.push('is_public = ?');
            params.push(isPublic === 'true' ? 1 : 0);
        }

        let whereClause = '';
        if (conditions.length > 0) {
            whereClause = ' WHERE ' + conditions.join(' AND ');
        }

        // 1. Get exact total count for pagination with same filters
        const countQuery = `SELECT COUNT(*) as total ${queryBase} ${whereClause}`;
        const [countResult] = await db.query(countQuery, params);
        const total = countResult[0].total;

        // 2. Get paginated data
        const dataQuery = `SELECT * ${queryBase} ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        // Add limit and offset to params for the second query
        const dataParams = [...params, limitNum, offset];

        const [tickets] = await db.query(dataQuery, dataParams);

        // Batch-fetch all replies for the current page's tickets (avoids N+1)
        if (tickets.length > 0) {
            const ticketIds = tickets.map(t => t.id);
            const placeholders = ticketIds.map(() => '?').join(',');
            const [allReplies] = await db.query(
                `SELECT * FROM ticket_replies WHERE ticket_id IN (${placeholders}) ORDER BY created_at ASC`,
                ticketIds
            );
            // Group replies by ticket_id
            const repliesByTicket = new Map();
            for (const reply of allReplies) {
                if (!repliesByTicket.has(reply.ticket_id)) {
                    repliesByTicket.set(reply.ticket_id, []);
                }
                repliesByTicket.get(reply.ticket_id).push(reply);
            }
            for (const ticket of tickets) {
                ticket.replies = repliesByTicket.get(ticket.id) || [];
            }
        } else {
            // No tickets, no replies to fetch
        }

        // Compatibility: Return wrapping object if pagination parameters are used, 
        // OR if the client specifically expects this format. 
        // For now, let's ALWAYS return the new format. 
        // BUT WAIT: Existing frontend expects an array. breaking change?
        // Yes, this is a breaking change for existing frontend code. 
        // However, I am updating the frontend in the same task. 
        // I will return the new object structure.
        res.json({
            tickets,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Create a new ticket
router.post('/', recaptchaMiddleware, async (req, res) => {
    const { userId, type, content, location, contact } = req.body;
    try {
        const db = getDB();
        const [result] = await db.query(
            'INSERT INTO tickets (user_id, type, content, location, contact) VALUES (?, ?, ?, ?, ?)',
            [userId, type, content, location, contact]
        );

        const ticketId = result.insertId;
        const ticketData = { id: ticketId, type, content, location, contact };

        // Send email notification (async, non-blocking)
        sendFeedbackNotification(ticketData).catch(err =>
            console.error('Failed to send notification email:', err.message)
        );

        // Send DingTalk notification (async, non-blocking)
        sendDingTalkNotification(ticketData).catch(err =>
            console.error('Failed to send DingTalk notification:', err.message)
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Rate a resolved ticket - User only
router.put('/:id/rate', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Validate rating
    const ratingVal = parseInt(rating);
    if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
        return res.status(400).json({ error: '评分必须在1-5之间' });
    }

    try {
        const db = getDB();

        // Verify ticket ownership and status
        const [tickets] = await db.query('SELECT * FROM tickets WHERE id = ?', [id]);
        if (tickets.length === 0) {
            return res.status(404).json({ error: '工单不存在' });
        }

        const ticket = tickets[0];
        if (ticket.user_id !== req.user.id) {
            return res.status(403).json({ error: '只能评价自己的工单' });
        }

        if (ticket.status !== 'resolved') {
            return res.status(400).json({ error: '只能评价已解决的工单' });
        }

        // Update ticket
        await db.query(
            'UPDATE tickets SET rating = ?, rating_comment = ? WHERE id = ?',
            [ratingVal, comment || null, id]
        );

        // Create audit log (optional but good for tracking)
        await createAuditLog(
            req.user.id,
            req.user.username,
            'rate_ticket',
            'ticket',
            parseInt(id),
            { rating: ratingVal, comment },
            req.ip
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Batch review tickets - Admin only
// NOTE: Must be registered BEFORE /:id to avoid Express matching 'batch-review' as an id param
router.put('/batch-review', authenticateToken, async (req, res) => {
    const { ticketIds, is_public } = req.body;

    // Check if user is admin or super_admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '仅管理员可以审核工单' });
    }

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
        return res.status(400).json({ error: '请选择要审核的工单' });
    }

    try {
        const db = getDB();
        const newValue = is_public ? 1 : 0;

        // Batch update is_public field
        await db.query(
            'UPDATE tickets SET is_public = ? WHERE id IN (?)',
            [newValue, ticketIds]
        );

        // Create audit log
        await createAuditLog(
            req.user.id,
            req.user.username,
            'batch_review_tickets',
            'ticket',
            null,
            {
                ticket_ids: ticketIds,
                count: ticketIds.length,
                action: is_public ? '批量设为公开' : '批量设为待审核'
            },
            req.ip
        );

        res.json({ success: true, count: ticketIds.length });
    } catch (err) {
        console.error('Batch review error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Update ticket status
router.put('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status, reply } = req.body;
    try {
        const db = getDB();
        const updates = [];
        const params = [];

        if (status) {
            updates.push('status = ?');
            params.push(status);
        }

        // Legacy support: if reply is sent directly, create a ticket_reply entry
        if (reply !== undefined && reply.trim() !== '') {
            await db.query(
                'INSERT INTO ticket_replies (ticket_id, admin_id, admin_name, content) VALUES (?, ?, ?, ?)',
                [id, req.user.id, req.user.username, reply]
            );

            // Also update legacy fields for backward compatibility
            updates.push('reply = ?');
            params.push(reply);
            updates.push('reply_by = ?');
            params.push(req.user.username);
            updates.push('reply_at = ?');
            params.push(new Date());

            // Send notification
            sendTicketReplyNotification(id, reply).catch(err =>
                console.error('Failed to send reply notification:', err.message)
            );
        }

        if (updates.length > 0) {
            params.push(id);
            await db.query(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Update ticket error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Review ticket (toggle public visibility) - Admin only
router.put('/:id/review', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { is_public } = req.body;

    // Check if user is admin or super_admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '仅管理员可以审核工单' });
    }

    try {
        const db = getDB();

        // Check if ticket exists
        const [tickets] = await db.query('SELECT * FROM tickets WHERE id = ?', [id]);
        if (tickets.length === 0) {
            return res.status(404).json({ error: '工单不存在' });
        }

        const oldValue = tickets[0].is_public;
        const newValue = is_public ? 1 : 0;

        // Update is_public field
        await db.query('UPDATE tickets SET is_public = ? WHERE id = ?', [newValue, id]);

        // Create audit log
        await createAuditLog(
            req.user.id,
            req.user.username,
            'review_ticket',
            'ticket',
            parseInt(id),
            {
                ticket_id: id,
                old_value: oldValue,
                new_value: newValue,
                action: newValue ? '设为公开' : '设为待审核'
            },
            req.ip
        );

        res.json({ success: true, is_public: newValue });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// ============ Multi-Reply API Endpoints ============

// Get all replies for a specific ticket
router.get('/:ticketId/replies', async (req, res) => {
    const { ticketId } = req.params;
    try {
        const db = getDB();
        const [replies] = await db.query(
            'SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
            [ticketId]
        );
        res.json(replies);
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Add a new reply to a ticket
router.post('/:ticketId/replies', authenticateToken, async (req, res) => {
    const { ticketId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: '回复内容不能为空' });
    }

    try {
        const db = getDB();

        // Insert the reply
        const [result] = await db.query(
            'INSERT INTO ticket_replies (ticket_id, admin_id, admin_name, content) VALUES (?, ?, ?, ?)',
            [ticketId, req.user.id, req.user.username, content]
        );

        // Update ticket's legacy reply field to the latest reply
        await db.query(
            'UPDATE tickets SET reply = ?, reply_by = ?, reply_at = ? WHERE id = ?',
            [content, req.user.username, new Date(), ticketId]
        );

        // Send notification
        sendTicketReplyNotification(ticketId, content).catch(err =>
            console.error('Failed to send reply notification:', err.message)
        );

        // Fetch the newly created reply
        const [newReply] = await db.query('SELECT * FROM ticket_replies WHERE id = ?', [result.insertId]);

        res.json({ success: true, reply: newReply[0] });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Update an existing reply (only owner can update, or super_admin can update any)
router.put('/:ticketId/replies/:replyId', authenticateToken, async (req, res) => {
    const { ticketId, replyId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: '回复内容不能为空' });
    }

    try {
        const db = getDB();

        // Check if the reply exists
        const [replies] = await db.query(
            'SELECT * FROM ticket_replies WHERE id = ? AND ticket_id = ?',
            [replyId, ticketId]
        );

        if (replies.length === 0) {
            return res.status(404).json({ error: '回复不存在' });
        }

        // Allow edit if user is the owner OR if user is super_admin
        const isOwner = replies[0].admin_id === req.user.id;
        const isSuperAdmin = req.user.role === 'super_admin';

        if (!isOwner && !isSuperAdmin) {
            return res.status(403).json({ error: '只能编辑自己的回复' });
        }

        // Update the reply
        await db.query(
            'UPDATE ticket_replies SET content = ?, updated_at = ? WHERE id = ?',
            [content, new Date(), replyId]
        );

        // Fetch the updated reply
        const [updatedReply] = await db.query('SELECT * FROM ticket_replies WHERE id = ?', [replyId]);

        res.json({ success: true, reply: updatedReply[0] });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Delete a reply (only owner can delete, or super_admin can delete any)
router.delete('/:ticketId/replies/:replyId', authenticateToken, async (req, res) => {
    const { ticketId, replyId } = req.params;

    try {
        const db = getDB();

        // Check if the reply exists
        const [replies] = await db.query(
            'SELECT * FROM ticket_replies WHERE id = ? AND ticket_id = ?',
            [replyId, ticketId]
        );

        if (replies.length === 0) {
            return res.status(404).json({ error: '回复不存在' });
        }

        // Allow delete if user is the owner OR if user is super_admin
        const isOwner = replies[0].admin_id === req.user.id;
        const isSuperAdmin = req.user.role === 'super_admin';

        if (!isOwner && !isSuperAdmin) {
            return res.status(403).json({ error: '只能删除自己的回复' });
        }

        // Delete the reply
        await db.query('DELETE FROM ticket_replies WHERE id = ?', [replyId]);

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Delete a ticket (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const db = getDB();

        // Check if ticket exists
        const [tickets] = await db.query('SELECT * FROM tickets WHERE id = ?', [id]);
        if (tickets.length === 0) {
            return res.status(404).json({ error: '工单不存在' });
        }

        // Delete the ticket (replies will be cascade deleted due to FK constraint)
        await db.query('DELETE FROM tickets WHERE id = ?', [id]);

        // Create audit log
        await createAuditLog(
            req.user.id,
            req.user.username,
            'delete_ticket',
            'ticket',
            parseInt(id),
            { content: tickets[0].content, type: tickets[0].type },
            req.ip
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// ============ AI-Powered Features ============

// Generate AI reply suggestion for a ticket (admin only)
router.post('/:id/suggest-reply', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // Check if user is admin or super_admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '仅管理员可以使用AI功能' });
    }

    // Check if AI is available
    if (!isAIAvailable()) {
        return res.status(503).json({
            error: 'AI服务未配置',
            message: '请在环境变量中配置 GEMINI_API_KEY 以启用AI功能'
        });
    }

    // Check settings
    const aiEnabled = await getSetting('ai_enabled');
    const aiReplyEnabled = await getSetting('ai_reply_enabled');

    if (aiEnabled === false) return res.status(403).json({ error: 'AI功能已全局禁用' });
    if (aiReplyEnabled === false) return res.status(403).json({ error: 'AI回复建议功能已禁用' });

    try {
        const db = getDB();

        // Fetch ticket details
        const [tickets] = await db.query('SELECT * FROM tickets WHERE id = ?', [id]);
        if (tickets.length === 0) {
            return res.status(404).json({ error: '工单不存在' });
        }

        const ticket = tickets[0];

        // Fetch existing replies
        const [replies] = await db.query(
            'SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
            [id]
        );

        // Generate AI suggestion
        const suggestion = await generateReplySuggestion(ticket, replies);

        res.json({ success: true, suggestion });
    } catch (err) {
        console.error('AI reply suggestion failed:', err);
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// ============ Similar Ticket Search ============

// Search for similar resolved public tickets
router.get('/search-similar', async (req, res) => {
    const { content, type, limit = 5 } = req.query;

    // Validate content parameter
    if (!content || content.trim().length < 10) {
        return res.json({ similar_tickets: [] });
    }

    try {
        const db = getDB();
        const searchLimit = Math.min(parseInt(limit) || 5, 20); // Cap at 20 results

        // Extract keywords from content (split by spaces and filter out short words)
        const keywords = content
            .trim()
            .split(/\s+/)
            .filter(word => word.length >= 2)
            .slice(0, 10); // Limit to first 10 keywords

        if (keywords.length === 0) {
            return res.json({ similar_tickets: [] });
        }

        // Build WHERE clause for keyword matching
        let whereConditions = ['is_public = 1', 'status = ?'];
        let params = ['resolved'];

        // Add keyword matching - search for tickets containing any of the keywords
        const keywordConditions = keywords.map(() => 'content LIKE ?');
        if (keywordConditions.length > 0) {
            whereConditions.push(`(${keywordConditions.join(' OR ')})`);
            keywords.forEach(keyword => params.push(`%${keyword}%`));
        }

        // Build query with optional type filtering
        // If type is specified, prioritize matching type but still include others
        let query;
        if (type) {
            // First, try to find tickets with matching type
            query = `
                SELECT * FROM tickets 
                WHERE ${whereConditions.join(' AND ')} AND type = ?
                ORDER BY created_at DESC 
                LIMIT ?
            `;
            const typeParams = [...params, type, searchLimit];
            const [typeMatches] = await db.query(query, typeParams);

            // If we found enough matches with the same type, use them
            if (typeMatches.length >= searchLimit) {
                const tickets = typeMatches;

                // Fetch replies for each ticket
                for (const ticket of tickets) {
                    const [replies] = await db.query(
                        'SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
                        [ticket.id]
                    );
                    ticket.replies = replies;
                }

                return res.json({ similar_tickets: tickets });
            }

            // If not enough matches, get more from all types
            const remaining = searchLimit - typeMatches.length;
            query = `
                SELECT * FROM tickets 
                WHERE ${whereConditions.join(' AND ')} AND type != ?
                ORDER BY created_at DESC 
                LIMIT ?
            `;
            const otherParams = [...params, type, remaining];
            const [otherMatches] = await db.query(query, otherParams);

            const tickets = [...typeMatches, ...otherMatches];

            // Fetch replies for each ticket
            for (const ticket of tickets) {
                const [replies] = await db.query(
                    'SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
                    [ticket.id]
                );
                ticket.replies = replies;
            }

            return res.json({ similar_tickets: tickets });
        }

        // No type filter - just search by keywords
        query = `
            SELECT * FROM tickets 
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY created_at DESC 
            LIMIT ?
        `;
        params.push(searchLimit);

        const [tickets] = await db.query(query, params);

        // Fetch replies for each ticket
        for (const ticket of tickets) {
            const [replies] = await db.query(
                'SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
                [ticket.id]
            );
            ticket.replies = replies;
        }

        res.json({ similar_tickets: tickets });
    } catch (err) {
        console.error('Similar ticket search failed:', err);
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// ============ AI Ticket Summary ============

// Get AI-generated summary for a ticket (admin only)
router.get('/:id/summary', authenticateToken, async (req, res) => {
    const { id } = req.params;


    // Check if user is admin or super_admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '仅管理员可以使用AI功能' });
    }

    // Check if AI is available
    if (!isAIAvailable()) {
        return res.status(503).json({
            error: 'AI服务未配置',
            message: '请在系统设置中配置AI API Key以启用此功能'
        });
    }

    // Check settings
    const aiEnabled = await getSetting('ai_enabled');
    const aiSummaryEnabled = await getSetting('ai_summary_enabled');

    if (aiEnabled === false) return res.status(403).json({ error: 'AI功能已全局禁用' });
    if (aiSummaryEnabled === false) return res.status(403).json({ error: 'AI工单总结功能已禁用' });

    try {
        const db = getDB();

        // Fetch ticket details
        const [tickets] = await db.query('SELECT * FROM tickets WHERE id = ?', [id]);
        if (tickets.length === 0) {
            return res.status(404).json({ error: '工单不存在' });
        }

        const ticket = tickets[0];

        // Fetch existing replies
        const [replies] = await db.query(
            'SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
            [id]
        );

        // Generate content hash
        const contentHash = generateContentHash(ticket, replies);

        // Always try cache first
        // Strict Mode: We only generate if content has changed (hash mismatch)
        const cachedSummary = await getCachedSummary(id, contentHash);
        if (cachedSummary) {
            console.log(`[AI Summary] Cache hit for ticket #${id}`);
            return res.json({ success: true, cached: true, ...cachedSummary });
        }

        // Generate AI summary
        console.log(`[AI Summary] Cache miss for ticket #${id}, calling AI...`);
        const summary = await summarizeTicket(ticket, replies);

        // Store in cache
        await setCachedSummary(id, replies.length, contentHash, summary);

        res.json({ success: true, cached: false, ...summary });
    } catch (err) {
        console.error('AI ticket summary failed:', err);
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// ============ AI Trend Analysis ============

// Get AI analysis history list
router.get('/ai-trends/history', authenticateToken, async (req, res) => {
    try {
        const db = getDB();
        const [rows] = await db.query(
            'SELECT id, created_at FROM ai_analysis_cache WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ success: true, history: rows });
    } catch (err) {
        console.error('Failed to fetch AI history:', err);
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Get AI-generated trend analysis (admin only)
router.get('/ai-trends', authenticateToken, async (req, res) => {
    // Check if user is admin or super_admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '仅管理员可以使用AI功能' });
    }

    // Check if AI is available
    if (!isAIAvailable()) {
        return res.status(503).json({
            error: 'AI服务未配置',
            message: '请在系统设置中配置AI API Key以启用此功能'
        });
    }

    // Check settings
    const aiEnabled = await getSetting('ai_enabled');
    const aiAnalysisEnabled = await getSetting('ai_analysis_enabled');

    if (aiEnabled === false) return res.status(403).json({ error: 'AI功能已全局禁用' });
    if (aiAnalysisEnabled === false) return res.status(403).json({ error: 'AI趋势分析功能已禁用' });

    const { days = 30, refresh, historyId } = req.query;

    try {
        const db = getDB();

        // Mobile/Frontend specific: If asking for specific history
        if (historyId) {
            const [rows] = await db.query(
                'SELECT * FROM ai_analysis_cache WHERE id = ? AND user_id = ?',
                [historyId, req.user.id]
            );

            if (rows.length > 0) {
                const cachedData = JSON.parse(rows[0].content);
                return res.json({
                    success: true,
                    cached: true,
                    isHistory: true, // Flag to indicate this is a past record
                    cachedAt: rows[0].created_at,
                    ...cachedData
                });
            } else {
                return res.status(404).json({ error: 'History record not found' });
            }
        }

        // Helper: Check and record usage
        const checkAIUsageLimit = async (userId, role) => {
            const limit = role === 'super_admin' ? 10 : 1;

            // Calculate today in Beijing Time (UTC+8)
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const beijing = new Date(utc + (3600000 * 8));
            const today = beijing.toISOString().split('T')[0];

            const [rows] = await db.query(
                'SELECT COUNT(*) as count FROM ai_usage_logs WHERE user_id = ? AND action_type = ? AND DATE(created_at) = ?',
                [userId, 'ai_trends_analysis', today]
            );

            const count = rows[0].count;
            if (count >= limit) {
                const message = role === 'super_admin'
                    ? '今日AI分析次数已达上限（10次/天）'
                    : '普通管理员每日仅可使用1次AI分析，请联系超级管理员升级或明日再试';
                throw new Error(message);
            }
            return limit - count;
        };

        // Helper: Record usage
        const recordUsage = async (userId) => {
            await db.query(
                'INSERT INTO ai_usage_logs (user_id, action_type) VALUES (?, ?)',
                [userId, 'ai_trends_analysis']
            );
        };

        // Helper: Get cached analysis
        const getCachedAnalysis = async (userId) => {
            const [rows] = await db.query(
                'SELECT * FROM ai_analysis_cache WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
                [userId]
            );
            return rows.length > 0 ? rows[0] : null;
        };

        // Helper: Save and Prune cache
        const saveAndPruneCache = async (userId, role, content) => {
            const retentionLimit = role === 'super_admin' ? 10 : 2;

            // 1. Insert new record
            await db.query(
                'INSERT INTO ai_analysis_cache (user_id, content) VALUES (?, ?)',
                [userId, JSON.stringify(content)]
            );

            // 2. Prune old records (keep top N)
            // Complex to do in one portable query, so fetch IDs to keep first
            const [keepRows] = await db.query(
                'SELECT id FROM ai_analysis_cache WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
                [userId, retentionLimit]
            );

            if (keepRows.length > 0) {
                const keepIds = keepRows.map(r => r.id);
                // Delete everything NOT in keepIds
                await db.query(
                    `DELETE FROM ai_analysis_cache WHERE user_id = ? AND id NOT IN (${keepIds.join(',')})`,
                    [userId]
                );
            }
        };

        // 1. Try to return cached result first (if not forcing refresh)
        if (refresh !== 'true') {
            const cachedParams = await getCachedAnalysis(req.user.id);
            if (cachedParams) {
                const cachedData = JSON.parse(cachedParams.content);
                return res.json({
                    success: true,
                    cached: true,
                    cachedAt: cachedParams.created_at,
                    ...cachedData
                });
            } else {
                // If checking cache only and none found, return empty state instead of generating
                return res.json({
                    success: true,
                    cached: false,
                    needsGeneration: true
                });
            }
        }

        // 2. Check Quota before generating
        try {
            await checkAIUsageLimit(req.user.id, req.user.role);
        } catch (error) {
            // Map usage limit error to 429 Too Many Requests
            return res.status(429).json({ error: error.message });
        }

        // 3. Get recent tickets for analysis
        const daysNum = parseInt(days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysNum);

        const [tickets] = await db.query(
            'SELECT * FROM tickets WHERE created_at >= ? ORDER BY created_at DESC LIMIT 100',
            [startDate.toISOString().split('T')[0]]
        );

        if (tickets.length === 0) {
            return res.json({
                success: true,
                trends: [],
                insights: ['暂无足够数据进行趋势分析'],
                recommendations: [],
                topIssues: []
            });
        }

        // 4. Generate AI trend analysis
        const analysis = await analyzeTrends(tickets);
        const resultData = { ticketCount: tickets.length, ...analysis };

        // 5. Save to Cache and Record Usage
        await saveAndPruneCache(req.user.id, req.user.role, resultData);
        await recordUsage(req.user.id);

        res.json({ success: true, cached: false, ...resultData });
    } catch (err) {
        console.error('AI trend analysis failed:', err);
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

export default router;

