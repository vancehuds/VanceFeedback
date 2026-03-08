import express from 'express';
import bcrypt from 'bcryptjs';
import { getDB } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getSetting, generateVerificationCode, sendVerificationCode } from '../services/email.js';

const router = express.Router();

// Get current user profile
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = getDB();
        const [users] = await db.query(
            'SELECT id, username, email, email_verified, nickname, student_id, real_name, role, created_at, email_notification_enabled FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // Get ticket statistics
        const [ticketStats] = await db.query(
            `SELECT 
                COUNT(*) as ticket_count,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
                SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending_count
            FROM tickets WHERE user_id = ?`,
            [req.user.id]
        );

        const profile = {
            ...users[0],
            ticket_count: ticketStats[0]?.ticket_count || 0,
            resolved_count: ticketStats[0]?.resolved_count || 0,
            pending_count: ticketStats[0]?.pending_count || 0
        };

        res.json(profile);
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Update nickname
router.put('/nickname', authenticateToken, async (req, res) => {
    const { nickname } = req.body;

    if (!nickname || nickname.trim().length === 0) {
        return res.status(400).json({ error: '昵称不能为空' });
    }

    if (nickname.length > 50) {
        return res.status(400).json({ error: '昵称不能超过50个字符' });
    }

    try {
        const db = getDB();
        await db.query('UPDATE users SET nickname = ? WHERE id = ?', [nickname.trim(), req.user.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Request email change verification code
router.post('/email/send-code', authenticateToken, async (req, res) => {
    const { email, verifyOriginal } = req.body;

    try {
        const db = getDB();
        const [users] = await db.query('SELECT email, email_verified FROM users WHERE id = ?', [req.user.id]);
        const user = users[0];

        // If user has verified email and wants to change, must verify original first
        if (verifyOriginal && user.email && user.email_verified) {
            // Send code to original email
            const code = generateVerificationCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            await db.query('DELETE FROM email_verification_codes WHERE user_id = ? AND type = ?', [req.user.id, 'email_change']);
            await db.query(
                'INSERT INTO email_verification_codes (user_id, email, code, type, expires_at) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, user.email, code, 'email_change', expiresAt]
            );

            await sendVerificationCode(user.email, code, 'email_change');
            return res.json({ success: true, message: '验证码已发送到原邮箱' });
        }

        // Sending code to new email
        if (!email) {
            return res.status(400).json({ error: '请提供新邮箱地址' });
        }

        // Check whitelist
        const whitelist = await getSetting('email_suffix_whitelist');
        if (whitelist && whitelist.length > 0) {
            const emailSuffix = email.split('@')[1];
            if (!whitelist.some(suffix => emailSuffix.endsWith(suffix.trim()))) {
                return res.status(400).json({ error: '该邮箱后缀不在白名单中' });
            }
        }

        // Check if email already used
        const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
        if (existing.length > 0) {
            return res.status(400).json({ error: '该邮箱已被其他用户使用' });
        }

        const code = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.query('DELETE FROM email_verification_codes WHERE user_id = ? AND type = ? AND email = ?', [req.user.id, 'email_change', email]);
        await db.query(
            'INSERT INTO email_verification_codes (user_id, email, code, type, expires_at) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, email, code, 'email_change', expiresAt]
        );

        await sendVerificationCode(email, code, 'email_change');
        res.json({ success: true, message: '验证码已发送到新邮箱' });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Change email
router.put('/email', authenticateToken, async (req, res) => {
    const { email, code, password } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    try {
        const db = getDB();
        const [users] = await db.query('SELECT email, email_verified, password_hash FROM users WHERE id = ?', [req.user.id]);
        const user = users[0];

        // If user has no email, require password verification
        if (!user.email || !user.email_verified) {
            if (!password) {
                return res.status(400).json({ error: '请提供密码验证' });
            }
            const match = await bcrypt.compare(password, user.password_hash);
            if (!match) {
                return res.status(401).json({ error: '密码错误' });
            }
        }

        // Verify code
        const [codes] = await db.query(
            'SELECT * FROM email_verification_codes WHERE user_id = ? AND email = ? AND code = ? AND type = ? AND used = 0 AND expires_at > ?',
            [req.user.id, email, code, 'email_change', new Date()]
        );

        if (codes.length === 0) {
            return res.status(400).json({ error: '验证码无效或已过期' });
        }

        // Update email
        await db.query('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?', [email, req.user.id]);
        await db.query('UPDATE email_verification_codes SET used = 1 WHERE id = ?', [codes[0].id]);

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword, emailCode } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: '新密码至少6个字符' });
    }

    try {
        const db = getDB();
        const [users] = await db.query('SELECT email, email_verified, password_hash FROM users WHERE id = ?', [req.user.id]);
        const user = users[0];

        // Method 1: Use current password
        if (currentPassword) {
            const match = await bcrypt.compare(currentPassword, user.password_hash);
            if (!match) {
                return res.status(401).json({ error: '当前密码错误' });
            }
        }
        // Method 2: Use email verification code
        else if (emailCode && user.email && user.email_verified) {
            const [codes] = await db.query(
                'SELECT * FROM email_verification_codes WHERE user_id = ? AND code = ? AND type = ? AND used = 0 AND expires_at > ?',
                [req.user.id, emailCode, 'password_reset', new Date()]
            );

            if (codes.length === 0) {
                return res.status(400).json({ error: '验证码无效或已过期' });
            }

            await db.query('UPDATE email_verification_codes SET used = 1 WHERE id = ?', [codes[0].id]);
        }
        // No valid verification method
        else {
            return res.status(400).json({ error: '请提供当前密码或邮箱验证码' });
        }

        // Update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, req.user.id]);

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: '请提供邮箱地址' });
    }

    try {
        const emailVerificationEnabled = await getSetting('email_verification_enabled');
        if (!emailVerificationEnabled) {
            const text = await getSetting('forgot_password_text') || '请联系管理员重置密码';
            return res.status(400).json({ error: text, customMessage: true });
        }

        const db = getDB();
        const [users] = await db.query('SELECT id, email, email_verified FROM users WHERE email = ?', [email]);

        if (users.length === 0 || !users[0].email_verified) {
            // Don't reveal if email exists
            return res.json({ success: true, message: '如果该邮箱已注册，验证码将发送到该邮箱' });
        }

        const user = users[0];
        const code = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.query('DELETE FROM email_verification_codes WHERE user_id = ? AND type = ?', [user.id, 'password_reset']);
        await db.query(
            'INSERT INTO email_verification_codes (user_id, email, code, type, expires_at) VALUES (?, ?, ?, ?, ?)',
            [user.id, email, code, 'password_reset', expiresAt]
        );

        await sendVerificationCode(email, code, 'password_reset');
        res.json({ success: true, message: '验证码已发送' });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Reset password with verification code
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: '新密码至少6个字符' });
    }

    try {
        const db = getDB();

        const [codes] = await db.query(
            'SELECT vc.*, u.id as user_id FROM email_verification_codes vc JOIN users u ON vc.user_id = u.id WHERE vc.email = ? AND vc.code = ? AND vc.type = ? AND vc.used = 0 AND vc.expires_at > ?',
            [email, code, 'password_reset', new Date()]
        );

        if (codes.length === 0) {
            return res.status(400).json({ error: '验证码无效或已过期' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, codes[0].user_id]);
        await db.query('UPDATE email_verification_codes SET used = 1 WHERE id = ?', [codes[0].id]);

        res.json({ success: true, message: '密码重置成功' });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

// Update notification settings
router.put('/notification-settings', authenticateToken, async (req, res) => {
    const { email_notification_enabled } = req.body;

    if (email_notification_enabled === undefined) {
        return res.status(400).json({ error: '缺少参数' });
    }

    try {
        const db = getDB();
        await db.query('UPDATE users SET email_notification_enabled = ? WHERE id = ?', [email_notification_enabled ? 1 : 0, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

export default router;
