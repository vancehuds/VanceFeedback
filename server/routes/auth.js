import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB } from '../db.js';
import { decryptData } from '../security.js';
import { recaptchaMiddleware } from '../middleware/recaptcha.js';
import { getSetting } from '../services/email.js';
import { createAuditLog } from './audit.js';

const router = express.Router();
import { JWT_SECRET } from '../security.js'; // simplistic for this task

router.post('/register', async (req, res) => {
    const { encryptedPayload, recaptchaToken } = req.body;
    try {
        const decrypted = decryptData(encryptedPayload);
        if (!decrypted) throw new Error("Decryption failed");

        const { username, password, email, emailCode, studentId, realName, nickname } = JSON.parse(decrypted);
        const db = getDB();

        // Check username
        const [existingUser] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) return res.status(400).json({ error: "用户名已被使用" });

        // Email verification if enabled
        const emailVerificationEnabled = await getSetting('email_verification_enabled');
        let emailVerified = false;

        if (emailVerificationEnabled) {
            // Case 1: Email verification enabled
            // Captcha was already verified when sending the code
            if (email) {
                // Check whitelist
                const whitelist = await getSetting('email_suffix_whitelist');
                if (whitelist && whitelist.length > 0) {
                    const emailSuffix = email.split('@')[1];
                    if (!whitelist.some(suffix => emailSuffix.endsWith(suffix.trim()))) {
                        return res.status(400).json({ error: '该邮箱后缀不在白名单中' });
                    }
                }

                // Check if email already used
                const [existingEmail] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
                if (existingEmail.length > 0) {
                    return res.status(400).json({ error: '该邮箱已被注册' });
                }

                // Verify email code
                if (!emailCode) {
                    return res.status(400).json({ error: '请提供邮箱验证码' });
                }

                const [codes] = await db.query(
                    'SELECT * FROM email_verification_codes WHERE email = ? AND code = ? AND type = ? AND used = 0 AND expires_at > ?',
                    [email, emailCode, 'register', new Date()]
                );

                if (codes.length === 0) {
                    return res.status(400).json({ error: '验证码无效或已过期' });
                }

                await db.query('UPDATE email_verification_codes SET used = 1 WHERE id = ?', [codes[0].id]);
                emailVerified = true;
            }
        } else {
            // Case 2: Email verification disabled
            // Must verify Captcha here
            const recaptchaEnabled = await getSetting('recaptcha_enabled');
            if (recaptchaEnabled) {
                if (!recaptchaToken) {
                    return res.status(400).json({ error: '请完成人机验证' });
                }
                const version = await getSetting('recaptcha_version') || 'v2';
                const { verifyRecaptcha } = await import('../middleware/recaptcha.js');
                const result = await verifyRecaptcha(recaptchaToken, version);
                if (!result.success) {
                    return res.status(400).json({ error: result.error });
                }
            }
        }

        // Check student info requirement
        const studentInfoEnabled = await getSetting('student_info_enabled');
        if (studentInfoEnabled) {
            if (!studentId || !realName) {
                return res.status(400).json({ error: '请填写学号和姓名' });
            }
        }

        const hash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (username, password_hash, email, email_verified, nickname, student_id, real_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, hash, email || null, emailVerified ? 1 : 0, nickname || username, studentId || null, realName || null]
        );

        // Create audit log for new registration
        await createAuditLog(
            result.insertId,
            username,
            'user_register',
            'user',
            result.insertId,
            { email: email || null },
            req.ip
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

router.post('/login', recaptchaMiddleware, async (req, res) => {
    const { encryptedPayload } = req.body;
    try {
        const decrypted = decryptData(encryptedPayload);
        if (!decrypted) throw new Error("Decryption failed");

        const { username, password } = JSON.parse(decrypted);
        const db = getDB();

        // Support login by username OR email
        const emailVerificationEnabled = await getSetting('email_verification_enabled');
        let users;

        if (emailVerificationEnabled && username.includes('@')) {
            // Login by email
            [users] = await db.query('SELECT * FROM users WHERE email = ?', [username]);
        } else {
            // Login by username
            [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        }

        if (users.length === 0) return res.status(401).json({ error: "用户名或密码错误" });

        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: "用户名或密码错误" });

        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

        // Create audit log for successful login
        await createAuditLog(
            user.id,
            user.username,
            'user_login',
            'user',
            user.id,
            { role: user.role },
            req.ip
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                nickname: user.nickname || user.username,
                email: user.email,
                role: user.role,
                email_notification_enabled: user.email_notification_enabled
            }
        });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

router.get('/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "No token" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = getDB();
        const [users] = await db.query('SELECT id, username, nickname, email, role, email_notification_enabled FROM users WHERE id = ?', [decoded.id]);
        if (users.length === 0) return res.status(401).json({ error: "User not found" });

        res.json({ user: users[0] });
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
});

export default router;
