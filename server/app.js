import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { isConfigured, loadConfig, initDB } from './db.js';
import { getPublicKey, initSecurityKey } from './security.js';
import { getDB } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import setupRoutes from './routes/setup.js';
import authRoutes from './routes/auth.js';
import ticketRoutes from './routes/tickets.js';
import userRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';
import settingsRoutes from './routes/settings.js';
import verificationRoutes from './routes/verification.js';
import profileRoutes from './routes/profile.js';
import adminNotificationsRoutes from './routes/admin-notifications.js';
import questionTypesRoutes from './routes/question-types.js';
import emailTemplatesRoutes from './routes/email-templates.js';
import announcementsRoutes from './routes/announcements.js';
import knowledgeBaseRoutes from './routes/knowledge-base.js';
import aiQaRoutes from './routes/ai-qa.js';
import { runInstaller } from './installer.js';
import { initAI } from './services/ai.js';

import captchaRoutes from './routes/captcha.js';
import { rateLimiter, identifyUser } from './middleware/rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Trust proxy for correct IP address in audit logs behind reverse proxy
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialization flag to prevent multiple initializations
let isInitialized = false;
let initializationPromise = null;

/**
 * Initialize the application (database, schema migrations, security keys, AI service)
 * This function is idempotent and safe to call multiple times.
 * Uses a promise lock to prevent concurrent initialization in serverless environments.
 */
export const initializeApp = async () => {
    // Already initialized
    if (isInitialized) return;

    // Another request is initializing - wait for it
    if (initializationPromise) {
        return initializationPromise;
    }

    // Start initialization with lock
    initializationPromise = (async () => {
        if (isConfigured()) {
            try {
                const config = loadConfig();
                await initDB(config);
                console.log("Database connected.");

                // Run schema migrations
                const adminUser = process.env.ADMIN_USER;
                const adminPass = process.env.ADMIN_PASS;

                console.log("Checking database schema...");
                try {
                    await runInstaller(adminUser, adminPass);
                    console.log("Database schema check completed.");
                } catch (err) {
                    console.error("Schema check/migration failed:", err);
                }

                // Initialize RSA security key from database
                try {
                    const db = getDB();
                    await initSecurityKey(db);
                } catch (err) {
                    console.error("Security key initialization failed:", err.message);
                }

                // Initialize AI service
                await initAI();

                isInitialized = true;
                console.log("✅ Application fully initialized.");
            } catch (err) {
                console.error("Failed to initialize:", err.message);
                // Reset promise to allow retry
                initializationPromise = null;
                throw err;
            }
        }
    })();

    return initializationPromise;
};

// Serve Static Files (Frontend) - BEFORE API routes
// Ensure we serve from ../dist relative to this file
app.use(express.static(path.join(__dirname, '../dist')));

// Global Routes
app.get('/api/status', (req, res) => {
    res.json({
        configured: isConfigured(),
        publicKey: getPublicKey()
    });
});

// Rate Limiter & User Identification
// Apply rate limiting (rateLimiter) before soft authentication (identifyUser)
// This ensures expensive identification logic is also protected by rate limiting
app.use('/api', rateLimiter, identifyUser);

// Setup Routes (Always available, but logic inside checks if already configured)
// Now protected by rate limiting to prevent DoS attacks
app.use('/api/setup', setupRoutes);

// App Routes (Only work if configured)
const requireConfig = (req, res, next) => {
    if (!isConfigured()) {
        return res.status(503).json({ error: "System not configured. Please complete setup." });
    }
    next();
};

app.use('/api/auth', requireConfig, authRoutes);
app.use('/api/tickets', requireConfig, ticketRoutes);
app.use('/api/users', requireConfig, userRoutes);
app.use('/api/audit', requireConfig, auditRoutes);
app.use('/api/settings', requireConfig, settingsRoutes);
app.use('/api/verification', requireConfig, verificationRoutes);
app.use('/api/profile', requireConfig, profileRoutes);
app.use('/api/admin-notifications', requireConfig, adminNotificationsRoutes);
app.use('/api/question-types', requireConfig, questionTypesRoutes);
app.use('/api/email-templates', requireConfig, emailTemplatesRoutes);
app.use('/api/announcements', requireConfig, announcementsRoutes);
app.use('/api/captcha', requireConfig, captchaRoutes);
app.use('/api/knowledge-base', requireConfig, knowledgeBaseRoutes);
app.use('/api/ai-qa', requireConfig, aiQaRoutes);

// SPA Fallback - Serve index.html for any non-API routes
// This allows the React Router to handle client-side routing
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

export default app;
