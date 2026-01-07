import express from 'express';
import * as altcha from 'altcha-lib';
import { getSetting, setSetting } from '../services/email.js';
import crypto from 'crypto';

import { rateLimiter, identifyUser } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to ensure HMAC key exists
const ensureHmacKey = async () => {
    let key = await getSetting('altcha_hmac_key');
    if (!key) {
        key = crypto.randomBytes(32).toString('hex');
        await setSetting('altcha_hmac_key', key);
        console.log('Generated new Altcha HMAC key');
    }
    return key;
};

router.get('/challenge', async (req, res) => {
    try {
        const hmacKey = await ensureHmacKey();
        const challenge = await altcha.createChallenge({
            hmacKey,
            expires: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
        });
        res.json(challenge);
    } catch (err) {
        console.error('Error generating Altcha challenge:', err);
        res.status(500).json({ error: 'Failed to generate challenge' });
    }
});

router.post('/verify-limit', identifyUser, async (req, res) => {
    const { payload } = req.body;

    if (!payload) {
        return res.status(400).json({ error: 'Missing CAPTCHA payload' });
    }

    try {
        const hmacKey = await ensureHmacKey();
        const valid = await altcha.verifySolution(payload, hmacKey);

        if (valid) {
            // Reset rate limit for this user/IP
            // rateLimiter.resetKey(key) is available in express-rate-limit v6+
            const keys = new Set([`ip_${req.ip}`]);
            if (req.user && req.user.id) {
                keys.add(`user_${req.user.id}`);
            }

            if (rateLimiter.resetKey) {
                for (const key of keys) {
                    rateLimiter.resetKey(key);
                    console.log(`Rate limit reset for key: ${key}`);
                }
            }

            res.json({ success: true, message: 'Verification successful. Limit reset.' });
        } else {
            res.status(400).json({ error: 'Invalid CAPTCHA' });
        }
    } catch (err) {
        console.error('Verification error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

export default router;
