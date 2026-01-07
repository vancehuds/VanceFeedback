import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../security.js';
import DatabaseStore from '../services/rateLimitStore.js';

// Optimistically identify user without failing on error
// This middleware is for rate limiting only, not security
export const identifyUser = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            jwt.verify(token, JWT_SECRET, (err, user) => {
                if (!err && user) {
                    req.user = user;
                }
            });
        }
    } catch (e) {
        // Ignore errors, treat as guest
    }
    next();
};

const getLimitByRole = (req) => {
    // 15 minutes window
    if (!req.user) return 100; // Guest

    switch (req.user.role) {
        case 'super_admin':
            return 10000;
        case 'admin':
            return 5000;
        default:
            return 1000; // Normal User
    }
};

const shouldSkipRateLimit = (req) => {
    return req.path === '/captcha/challenge' || req.path === '/captcha/verify-limit';
};

export const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => getLimitByRole(req),
    standardHeaders: true,
    legacyHeaders: false,
    store: new DatabaseStore(),
    skip: (req) => shouldSkipRateLimit(req),
    keyGenerator: (req) => {
        // Use user ID if logged in, otherwise IP
        return req.user ? `user_${req.user.id}` : `ip_${req.ip}`;
    },
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests',
            message: '您的访问频率过高，请稍后再试或进行人机验证以解除限制',
            requiresVerification: true
        });
    }
});
