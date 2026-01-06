import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getAllSettings, setSetting, getSetting } from '../services/email.js';
import { createAuditLog } from './audit.js';
import { getPublicKey } from '../security.js';

const router = express.Router();

// Middleware to check super admin role
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '权限不足，仅超级管理员可访问' });
    }
    next();
};

// Get all settings (super admin only)
router.get('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const settings = await getAllSettings();
        // Don't send sensitive info in plain text
        if (settings.smtp_pass) {
            settings.smtp_pass = '********';
        }
        if (settings.recaptcha_secret_key) {
            settings.recaptcha_secret_key = '********';
        }
        if (settings.gemini_api_key) {
            settings.gemini_api_key = '********';
        }
        if (settings.altcha_hmac_key) {
            settings.altcha_hmac_key = '********';
        }
        if (settings.bigmodel_api_key) {
            settings.bigmodel_api_key = '********';
        }
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get public settings (no auth required) - for frontend feature detection
router.get('/public', async (req, res) => {
    try {
        const settings = {
            recaptcha_enabled: await getSetting('recaptcha_enabled') || false,
            recaptcha_site_key: await getSetting('recaptcha_site_key') || '',
            recaptcha_provider: await getSetting('recaptcha_provider') || 'turnstile',
            email_verification_enabled: await getSetting('email_verification_enabled') || false,
            email_notifications_feature_enabled: await getSetting('email_notifications_feature_enabled') === 'true' || await getSetting('email_notifications_feature_enabled') === true,
            student_info_enabled: await getSetting('student_info_enabled') || false,
            forgot_password_text: await getSetting('forgot_password_text') || '请联系管理员重置密码',
            about_us_content: await getSetting('about_us_content') || '',
            welcome_message: await getSetting('welcome_message') || '致力于打造更好的阅读环境。如果您在入馆、借阅、自习或使用数字资源时遇到困难，请随时告诉我们。',
            site_logo: await getSetting('site_logo') || '',
            site_logo_url: await getSetting('site_logo_url') || '',
            university_name: await getSetting('university_name') || 'xx大学',
            show_github_link: await getSetting('show_github_link') !== 'false' && await getSetting('show_github_link') !== false,
            ai_qa_enabled: await getSetting('ai_qa_enabled') === 'true' || await getSetting('ai_qa_enabled') === true,
            knowledge_base_enabled: await getSetting('knowledge_base_enabled') !== 'false' && await getSetting('knowledge_base_enabled') !== false,
            publicKey: getPublicKey()
        };
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update settings (super admin only)
router.put('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const allowedKeys = [
            'recaptcha_enabled',
            'recaptcha_version',
            'recaptcha_site_key',
            'recaptcha_secret_key',
            'smtp_host',
            'smtp_port',
            'smtp_user',
            'smtp_pass',
            'smtp_from',
            'smtp_secure',
            'email_verification_enabled',
            'email_suffix_whitelist',
            'student_info_enabled',
            'notification_emails',
            'notification_emails',
            'forgot_password_text',
            'about_us_content',
            'dingtalk_enabled',
            'dingtalk_webhook',
            'dingtalk_secret',
            'recaptcha_domain',
            'welcome_message',
            'site_logo',
            'site_logo_url',
            'site_logo_url',
            'email_notifications_global_enabled',
            'email_notifications_feature_enabled',
            'site_url',
            'university_name',
            'dingtalk_template',
            'recaptcha_provider',
            'altcha_hmac_key',
            // AI configuration
            'ai_enabled',
            'ai_provider',
            'gemini_api_key',
            'bigmodel_api_key',
            'gemini_model',
            'bigmodel_model',
            'ai_reply_enabled',
            'ai_analysis_enabled',
            'ai_summary_enabled',
            'ai_qa_enabled',
            'ai_qa_daily_limit',
            'ai_qa_use_all_content',
            'ai_qa_use_all_content',
            'show_github_link',
            'knowledge_base_enabled'
        ];


        const changedKeys = [];
        for (const [key, value] of Object.entries(req.body)) {
            if (allowedKeys.includes(key)) {
                // Don't update password fields if they contain placeholder
                if ((key === 'smtp_pass' || key === 'recaptcha_secret_key' || key === 'gemini_api_key' || key === 'bigmodel_api_key' || key === 'altcha_hmac_key') && value === '********') {
                    continue;
                }
                await setSetting(key, value);
                changedKeys.push(key);
            }
        }

        // Create audit log for settings change
        if (changedKeys.length > 0) {
            await createAuditLog(
                req.user.id,
                req.user.username,
                'update_settings',
                'settings',
                null,
                { changed_keys: changedKeys },
                req.ip
            );
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Test DingTalk connection (super admin only)
router.post('/test-dingtalk', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { testDingTalkConnection } = await import('../services/dingtalk.js');
        const { webhook, secret } = req.body;

        if (!webhook) {
            return res.status(400).json({ error: '请提供 Webhook 地址' });
        }

        await testDingTalkConnection(webhook, secret);
        res.json({ success: true, message: '测试消息已发送' });
    } catch (err) {
        res.status(500).json({ error: `发送失败: ${err.message}` });
    }
});

// Test SMTP connection (super admin only)
router.post('/test-smtp', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { sendEmail } = await import('../services/email.js');
        const testEmail = req.body.email || req.user.email;

        if (!testEmail) {
            return res.status(400).json({ error: '请提供测试邮箱地址' });
        }

        await sendEmail(testEmail, '【测试】SMTP配置测试', '<p>如果您收到这封邮件，说明SMTP配置正确。</p>');
        res.json({ success: true, message: '测试邮件已发送' });
    } catch (err) {
        res.status(500).json({ error: `发送失败: ${err.message}` });
    }
});

// Test AI connection (super admin only)
router.post('/test-ai', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { reinitAI, isAIAvailable } = await import('../services/ai.js');

        // Reinitialize AI with current settings
        await reinitAI();

        if (isAIAvailable()) {
            res.json({ success: true, message: 'AI 服务连接成功' });
        } else {
            res.status(400).json({ error: 'AI 服务未配置或配置无效，请检查 API Key 和提供商设置' });
        }
    } catch (err) {
        res.status(500).json({ error: `AI 连接测试失败: ${err.message}` });
    }
});

export default router;

