import { getDB, loadConfig } from './db.js';
import bcrypt from 'bcryptjs';

export const runInstaller = async (adminUser, adminPass) => {
    const db = getDB();
    const config = loadConfig();
    const isSQLite = config.type === 'sqlite';

    // 1. Create Users Table
    const usersTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE,
            email_verified INTEGER DEFAULT 0,
            email_notification_enabled INTEGER DEFAULT 1,
            nickname TEXT,
            student_id TEXT,
            real_name TEXT,
            role TEXT CHECK(role IN ('user', 'admin', 'super_admin')) DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ` : `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(100) UNIQUE,
            email_verified TINYINT(1) DEFAULT 0,
            email_notification_enabled TINYINT(1) DEFAULT 1,
            nickname VARCHAR(50),
            student_id VARCHAR(50),
            real_name VARCHAR(50),
            role ENUM('user', 'admin', 'super_admin') DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await db.query(usersTableSQL);

    // MIGRATION: Add email_notification_enabled column if missing
    try {
        if (isSQLite) {
            const [columns] = await db.query("PRAGMA table_info(users)");
            const hasColumn = columns.some(col => col.name === 'email_notification_enabled');
            if (!hasColumn) {
                console.log('Migrating: Adding email_notification_enabled to users (SQLite)...');
                await db.query("ALTER TABLE users ADD COLUMN email_notification_enabled INTEGER DEFAULT 1");
            }
        } else {
            const [rows] = await db.query("SHOW COLUMNS FROM users LIKE 'email_notification_enabled'");
            if (rows.length === 0) {
                console.log('Migrating: Adding email_notification_enabled to users (MySQL)...');
                await db.query("ALTER TABLE users ADD COLUMN email_notification_enabled TINYINT(1) DEFAULT 1");
            }
        }
    } catch (err) {
        console.error('Migration failed for users table:', err);
    }

    // 2. Create Tickets Table
    const ticketsTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT,
            content TEXT,
            location TEXT,
            contact TEXT,
            status TEXT CHECK(status IN ('pending', 'processing', 'resolved')) DEFAULT 'pending',
            is_public INTEGER DEFAULT 0,
            reply TEXT,
            reply_by TEXT,
            reply_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ` : `
        CREATE TABLE IF NOT EXISTS tickets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            type VARCHAR(50),
            content TEXT,
            location VARCHAR(100),
            contact VARCHAR(100),
            status ENUM('pending', 'processing', 'resolved') DEFAULT 'pending',
            is_public TINYINT(1) DEFAULT 0,
            reply TEXT,
            reply_by VARCHAR(50),
            reply_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.query(ticketsTableSQL);

    // MIGRATION: Add rating columns if missing
    try {
        if (isSQLite) {
            const [columns] = await db.query("PRAGMA table_info(tickets)");
            const hasRating = columns.some(col => col.name === 'rating');
            if (!hasRating) {
                console.log('Migrating: Adding rating columns to tickets (SQLite)...');
                await db.query("ALTER TABLE tickets ADD COLUMN rating INTEGER DEFAULT NULL");
                await db.query("ALTER TABLE tickets ADD COLUMN rating_comment TEXT DEFAULT NULL");
            }
        } else {
            const [rows] = await db.query("SHOW COLUMNS FROM tickets LIKE 'rating'");
            if (rows.length === 0) {
                console.log('Migrating: Adding rating columns to tickets (MySQL)...');
                await db.query("ALTER TABLE tickets ADD COLUMN rating INT DEFAULT NULL");
                await db.query("ALTER TABLE tickets ADD COLUMN rating_comment TEXT DEFAULT NULL");
            }
        }
    } catch (err) {
        console.error('Migration failed for tickets table (ratings):', err);
    }

    // 2.5 Create Ticket Replies Table for multi-reply support
    const repliesTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS ticket_replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            admin_id INTEGER NOT NULL,
            admin_name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ticket_replies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_id INT NOT NULL,
            admin_id INT NOT NULL,
            admin_name VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.query(repliesTableSQL);

    // 3. Create Audit Logs Table for tracking admin actions
    const auditLogsTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id INTEGER,
            details TEXT,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    ` : `
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            username VARCHAR(50),
            action VARCHAR(50) NOT NULL,
            target_type VARCHAR(50),
            target_id INT,
            details TEXT,
            ip_address VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.query(auditLogsTableSQL);

    // 4. Create System Settings Table
    const settingsTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT UNIQUE NOT NULL,
            setting_value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ` : `
        CREATE TABLE IF NOT EXISTS system_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(100) UNIQUE NOT NULL,
            setting_value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;
    await db.query(settingsTableSQL);

    // MIGRATION: Seed Email Notifications Master Switch
    try {
        const [featureSetting] = await db.query("SELECT id FROM system_settings WHERE setting_key = 'email_notifications_feature_enabled'");
        if (featureSetting.length === 0) {
            console.log('Seeding: email_notifications_feature_enabled setting...');
            await db.query("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)", ['email_notifications_feature_enabled', 'true']);
        }
    } catch (err) {
        console.error('Migration failed for system_settings:', err);
    }

    // MIGRATION: Seed AI Configuration Defaults
    try {
        const [aiSetting] = await db.query("SELECT id FROM system_settings WHERE setting_key = 'ai_enabled'");
        if (aiSetting.length === 0) {
            console.log('Seeding: AI configuration defaults...');
            await db.query("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)", ['ai_enabled', 'false']);
            await db.query("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)", ['ai_provider', 'gemini']);
            await db.query("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)", ['gemini_model', 'gemini-3-flash-preview']);
            await db.query("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)", ['bigmodel_model', 'glm-4']);
        }
        // Check for new AI feature flags individually
        const settingsToCheck = [
            { key: 'ai_reply_enabled', value: 'true' },
            { key: 'ai_analysis_enabled', value: 'true' },
            { key: 'ai_summary_enabled', value: 'true' }
        ];

        for (const setting of settingsToCheck) {
            const [rows] = await db.query("SELECT id FROM system_settings WHERE setting_key = ?", [setting.key]);
            if (rows.length === 0) {
                console.log(`Seeding: ${setting.key}...`);
                await db.query("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)", [setting.key, setting.value]);
            }
        }
    } catch (err) {
        console.error('Migration failed for AI settings:', err);
    }

    // 5. Create Email Verification Codes Table
    const verificationTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS email_verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            type TEXT CHECK(type IN ('register', 'email_change', 'password_reset')) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ` : `
        CREATE TABLE IF NOT EXISTS email_verification_codes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            email VARCHAR(100) NOT NULL,
            code VARCHAR(10) NOT NULL,
            type ENUM('register', 'email_change', 'password_reset') NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.query(verificationTableSQL);

    // 6. Create Admin Notification Emails Table
    const adminNotificationEmailsSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS admin_notification_emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id INTEGER NOT NULL,
            email TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ` : `
        CREATE TABLE IF NOT EXISTS admin_notification_emails (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT NOT NULL,
            email VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_admin_email (admin_id, email)
        )
    `;
    await db.query(adminNotificationEmailsSQL);

    // 7. Create Question Types Table
    const questionTypesTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS question_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type_key TEXT UNIQUE NOT NULL,
            label TEXT NOT NULL,
            emoji TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ` : `
        CREATE TABLE IF NOT EXISTS question_types (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type_key VARCHAR(50) UNIQUE NOT NULL,
            label VARCHAR(100) NOT NULL,
            emoji VARCHAR(10) NOT NULL,
            description VARCHAR(200),
            sort_order INT DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await db.query(questionTypesTableSQL);

    // Insert default question types if table is empty
    const [existingTypes] = await db.query('SELECT COUNT(*) as count FROM question_types');
    if (existingTypes[0].count === 0) {
        const defaultTypes = [
            { type_key: 'facility', label: '设施报修', emoji: '🔧', description: '座椅、灯光、空调等', sort_order: 1 },
            { type_key: 'books', label: '图书借阅', emoji: '📚', description: '借还、预约、查询等', sort_order: 2 },
            { type_key: 'system', label: '数字资源', emoji: '💻', description: '数据库、电子书等', sort_order: 3 },
            { type_key: 'environment', label: '环境卫生', emoji: '🌿', description: '清洁、噪音等', sort_order: 4 },
            { type_key: 'other', label: '其他', emoji: '📝', description: '其他问题', sort_order: 5 }
        ];
        for (const t of defaultTypes) {
            await db.query(
                'INSERT INTO question_types (type_key, label, emoji, description, sort_order) VALUES (?, ?, ?, ?, ?)',
                [t.type_key, t.label, t.emoji, t.description, t.sort_order]
            );
        }
        console.log('Default question types created.');
    }

    // 8. Create Email Templates Table
    const emailTemplatesTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS email_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_key TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            subject TEXT NOT NULL,
            content TEXT NOT NULL,
            variables TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ` : `
        CREATE TABLE IF NOT EXISTS email_templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            template_key VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            subject VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            variables TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;
    await db.query(emailTemplatesTableSQL);

    // Initial seed for templates
    const [existingTemplates] = await db.query('SELECT COUNT(*) as count FROM email_templates');
    if (existingTemplates[0].count === 0) {
        const templates = [
            {
                key: 'verification_code',
                name: '验证码邮件',
                subject: '【图书馆反馈系统】{{type_label}}验证码',
                content: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #4F46E5;">图书馆反馈系统</h2>
                        <p>您正在进行{{type_label}}操作，您的验证码是：</p>
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
                            {{code}}
                        </div>
                        <p style="color: #666;">验证码有效期为 10 分钟，请尽快使用。</p>
                        <p style="color: #999; font-size: 12px;">如果这不是您本人的操作，请忽略此邮件。</p>
                    </div>
                `,
                variables: JSON.stringify(['{{type_label}}', '{{code}}'])
            },
            {
                key: 'feedback_notification',
                name: '新反馈通知',
                subject: '【新反馈】{{type_label}} - #{{ticket_id}}',
                content: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #4F46E5;">收到新的反馈</h2>
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">类型</td>
                                <td style="padding: 10px; border-bottom: 1px solid #eee;">{{type_label}}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">内容</td>
                                <td style="padding: 10px; border-bottom: 1px solid #eee;">{{content}}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">位置</td>
                                <td style="padding: 10px; border-bottom: 1px solid #eee;">{{location}}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">联系方式</td>
                                <td style="padding: 10px; border-bottom: 1px solid #eee;">{{contact}}</td>
                            </tr>
                        </table>
                        <p style="color: #999; font-size: 12px;">请登录后台管理系统处理此反馈。</p>
                    </div>
                `,
                variables: JSON.stringify(['{{type_label}}', '{{ticket_id}}', '{{content}}', '{{location}}', '{{contact}}'])
            }
        ];
        for (const t of templates) {
            await db.query(
                'INSERT INTO email_templates (template_key, name, subject, content, variables) VALUES (?, ?, ?, ?, ?)',
                [t.key, t.name, t.subject, t.content, t.variables]
            );
        }
        console.log('Default email templates seeded.');
    }

    // MIGRATION: Ensure ticket_reply_notification template exists
    try {
        const [replyTemplate] = await db.query("SELECT id FROM email_templates WHERE template_key = 'ticket_reply_notification'");
        if (replyTemplate.length === 0) {
            console.log('Seeding: ticket_reply_notification template...');
            const template = {
                key: 'ticket_reply_notification',
                name: '工单回复通知',
                subject: '【图书馆反馈系统】您的工单 #{{ticket_id}} 有新回复',
                content: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #4F46E5;">工单有新回复</h2>
                        <p>您提交的反馈工单 <strong>#{{ticket_id}}</strong> 有了新的回复：</p>
                        
                        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #4F46E5;">
                            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">管理员 <strong>{{reply_user}}</strong> 回复：</p>
                            <div style="color: #1f2937; line-height: 1.6;">
                                {{reply_content}}
                            </div>
                        </div>

                        <p>您可以点击下方按钮查看详情或继续回复：</p>
                        <a href="{{ticket_url}}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">查看工单详情</a>

                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
                        
                        <p style="color: #9b9b9b; font-size: 12px; text-align: center;">
                            如果不想再接收此类通知，可以 <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: underline;">取消订阅</a>
                        </p>
                    </div>
                `,
                variables: JSON.stringify(['{{ticket_id}}', '{{reply_user}}', '{{reply_content}}', '{{ticket_url}}', '{{unsubscribe_url}}'])
            };
            await db.query(
                'INSERT INTO email_templates (template_key, name, subject, content, variables) VALUES (?, ?, ?, ?, ?)',
                [template.key, template.name, template.subject, template.content, template.variables]
            );
        }
    } catch (err) {
        console.error('Migration failed for email_templates:', err);
    }

    // 9. Create Announcements Table
    const announcementsTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            priority INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ` : `
        CREATE TABLE IF NOT EXISTS announcements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            is_active TINYINT(1) DEFAULT 1,
            priority INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;
    await db.query(announcementsTableSQL);

    // 10. Create Ticket Summaries Table (for AI summary caching in serverless)
    const ticketSummariesTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS ticket_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            reply_count INTEGER NOT NULL DEFAULT 0,
            content_hash TEXT,
            summary TEXT,
            key_points TEXT,
            action_items TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ticket_summaries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_id INT NOT NULL,
            reply_count INT NOT NULL DEFAULT 0,
            content_hash VARCHAR(64),
            summary TEXT,
            key_points TEXT,
            action_items TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
        )
    `;
    await db.query(ticketSummariesTableSQL);

    // MIGRATION: Add content_hash if missing
    try {
        if (isSQLite) {
            const [columns] = await db.query("PRAGMA table_info(ticket_summaries)");
            const hasHash = columns.some(col => col.name === 'content_hash');
            if (!hasHash) {
                console.log('Migrating: Adding content_hash to ticket_summaries (SQLite)...');
                await db.query("ALTER TABLE ticket_summaries ADD COLUMN content_hash TEXT");
            }
        } else {
            const [rows] = await db.query("SHOW COLUMNS FROM ticket_summaries LIKE 'content_hash'");
            if (rows.length === 0) {
                console.log('Migrating: Adding content_hash to ticket_summaries (MySQL)...');
                await db.query("ALTER TABLE ticket_summaries ADD COLUMN content_hash VARCHAR(64)");
                await db.query("ALTER TABLE ticket_summaries ADD INDEX idx_content_hash (ticket_id, content_hash)");
            }
        }
    } catch (err) {
        console.error('Migration failed for ticket_summaries table:', err);
    }

    // 11. Create Rate Limits Table (for serverless persistence)
    const rateLimitsTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS rate_limits (
            key_id TEXT PRIMARY KEY,
            hit_count INTEGER DEFAULT 0,
            reset_time INTEGER NOT NULL
        )
    ` : `
        CREATE TABLE IF NOT EXISTS rate_limits (
            key_id VARCHAR(255) PRIMARY KEY,
            hit_count INT DEFAULT 0,
            reset_time BIGINT NOT NULL
        )
    `;
    await db.query(rateLimitsTableSQL);

    // 12. Create AI Usage Logs Table
    const aiUsageLogsTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS ai_usage_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_usage_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            action_type VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.query(aiUsageLogsTableSQL);

    // 13. Create AI Analysis Cache Table
    const aiCacheTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS ai_analysis_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_analysis_cache (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            content LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.query(aiCacheTableSQL);

    // 14. Create Knowledge Base Categories Table
    const kbCategoriesTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS kb_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT,
            icon TEXT DEFAULT '📁',
            sort_order INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ` : `
        CREATE TABLE IF NOT EXISTS kb_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            description VARCHAR(500),
            icon VARCHAR(10) DEFAULT '📁',
            sort_order INT DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await db.query(kbCategoriesTableSQL);

    // 15. Create Knowledge Base Articles Table
    const kbArticlesTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS kb_articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            title TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            content TEXT NOT NULL,
            views INTEGER DEFAULT 0,
            is_published INTEGER DEFAULT 0,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
    ` : `
        CREATE TABLE IF NOT EXISTS kb_articles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category_id INT,
            title VARCHAR(200) NOT NULL,
            slug VARCHAR(200) UNIQUE NOT NULL,
            content LONGTEXT NOT NULL,
            views INT DEFAULT 0,
            is_published TINYINT(1) DEFAULT 0,
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.query(kbArticlesTableSQL);

    // 16. Create AI Bans Table
    const aiBansTableSQL = isSQLite ? `
        CREATE TABLE IF NOT EXISTS ai_bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            reason TEXT,
            banned_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_bans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            reason TEXT,
            banned_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.query(aiBansTableSQL);

    // MIGRATION: Seed AI Q&A settings
    try {
        const settingsToSeed = [
            { key: 'ai_qa_enabled', value: 'false' },
            { key: 'ai_qa_daily_limit', value: '10' }
        ];

        for (const setting of settingsToSeed) {
            const [rows] = await db.query("SELECT id FROM system_settings WHERE setting_key = ?", [setting.key]);
            if (rows.length === 0) {
                console.log(`Seeding: ${setting.key}...`);
                await db.query("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)", [setting.key, setting.value]);
            }
        }
    } catch (err) {
        console.error('Migration failed for AI Q&A settings:', err);
    }

    // 7. Create Super Admin (Only if credentials are provided)
    if (adminUser && adminPass) {
        const hashedPassword = await bcrypt.hash(adminPass, 10);
        // Check if exists
        // Helper to quote value differences if needed, but 'super_admin' string works for both
        const [rows] = await db.query('SELECT * FROM users WHERE role = ? LIMIT 1', ['super_admin']);

        if (rows.length === 0) {
            await db.query(
                'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                [adminUser, hashedPassword, 'super_admin']
            );
            console.log(`Super Admin '${adminUser}' created.`);
        } else {
            console.log("Super Admin already exists, skipping creation.");
        }
    } else {
        console.log("No admin credentials provided, skipping super admin creation. Schema updated.");
    }

    return { success: true };
};

