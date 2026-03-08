import express from 'express';
import { isConfigured, saveConfig } from '../db.js';
import { runInstaller } from '../installer.js';
import { decryptData } from '../security.js';

const router = express.Router();

router.post('/install', async (req, res) => {
    if (isConfigured()) {
        return res.status(400).json({ error: "System already configured." });
    }

    const { encryptedPayload } = req.body;
    if (!encryptedPayload) {
        return res.status(400).json({ error: "Missing payload" });
    }

    try {
        const decrypted = decryptData(encryptedPayload);
        if (!decrypted) throw new Error("Decryption failed");

        const data = JSON.parse(decrypted);
        const { dbConfig, adminUser, adminPass } = data;

        // 1. Save Config & Init DB
        await saveConfig(dbConfig);

        // 2. Run Installer (Tables + Super Admin)
        await runInstaller(adminUser, adminPass);

        res.json({ success: true, message: "Installation successful" });
    } catch (err) {
        console.error("Install Error:", err);
        console.error('Server error:', err);
        res.status(500).json({ error: '操作失败，请稍后再试' });
    }
});

export default router;
