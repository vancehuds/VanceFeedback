import NodeRSA from 'node-rsa';
import crypto from 'node:crypto';

// Generate a random JWT secret if not provided in environment variables
const generateJwtSecret = () => {
    const secret = crypto.randomBytes(64).toString('hex');
    console.warn('⚠️ JWT_SECRET not set in environment. Using randomly generated secret (will change on restart).');
    return secret;
};

export const JWT_SECRET = process.env.JWT_SECRET || generateJwtSecret();

// RSA Key Management
// Supports: 1. Database (serverless-friendly), 2. Environment variable, 3. Dynamic generation
let key = null;
let keyInitialized = false;
let initializationPromise = null;

/**
 * Initialize RSA key from database or generate new one
 * This function is idempotent and safe to call multiple times
 */
export const initSecurityKey = async (db) => {
    if (keyInitialized && key) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        try {
            // 1. Try loading from database
            const [rows] = await db.query(
                "SELECT setting_value FROM system_settings WHERE setting_key = 'rsa_private_key'"
            );

            if (rows.length > 0 && rows[0].setting_value) {
                // Decode from Base64 and load
                const privateKeyPem = Buffer.from(rows[0].setting_value, 'base64').toString('utf8');
                key = new NodeRSA(privateKeyPem);
                console.log('✅ RSA key loaded from database');
            } else {
                // 2. Try from environment variable
                const envKey = process.env.RSA_PRIVATE_KEY;
                if (envKey) {
                    const privateKeyPem = Buffer.from(envKey, 'base64').toString('utf8');
                    key = new NodeRSA(privateKeyPem);
                    console.log('✅ RSA key loaded from environment variable');
                } else {
                    // 3. Generate new key and save to database
                    key = new NodeRSA({ b: 2048 });
                    const privateKeyPem = key.exportKey('private');
                    const privateKeyBase64 = Buffer.from(privateKeyPem).toString('base64');

                    // Save to database
                    const [existing] = await db.query(
                        "SELECT id FROM system_settings WHERE setting_key = 'rsa_private_key'"
                    );
                    if (existing.length === 0) {
                        await db.query(
                            "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)",
                            ['rsa_private_key', privateKeyBase64]
                        );
                    } else {
                        await db.query(
                            "UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'rsa_private_key'",
                            [privateKeyBase64]
                        );
                    }
                    console.log('✅ New RSA key generated and saved to database');
                }
            }

            key.setOptions({ encryptionScheme: 'pkcs1_oaep' });
            keyInitialized = true;
        } catch (err) {
            console.error('Failed to initialize RSA key:', err.message);
            // Fallback to temporary key (will not persist across restarts)
            if (!key) {
                key = new NodeRSA({ b: 2048 });
                key.setOptions({ encryptionScheme: 'pkcs1_oaep' });
                console.warn('⚠️ Using temporary RSA key (not persisted)');
            }
        }
    })();

    return initializationPromise;
};

/**
 * Synchronously initialize key for backwards compatibility
 * Used when database is not yet available
 */
const initFallbackKey = () => {
    if (key) return;

    const envKey = process.env.RSA_PRIVATE_KEY;
    if (envKey) {
        try {
            const privateKeyPem = Buffer.from(envKey, 'base64').toString('utf8');
            key = new NodeRSA(privateKeyPem);
            console.log('✅ RSA key loaded from environment variable (fallback)');
        } catch (e) {
            console.error('Failed to load RSA key from env:', e.message);
        }
    }

    if (!key) {
        key = new NodeRSA({ b: 2048 });
        console.warn('⚠️ RSA key generated dynamically. Set RSA_PRIVATE_KEY for production.');
    }

    key.setOptions({ encryptionScheme: 'pkcs1_oaep' });
};

export const getPublicKey = () => {
    if (!key) initFallbackKey();
    return key.exportKey('public');
};

export const decryptData = (encryptedData) => {
    try {
        if (!key) initFallbackKey();
        if (!encryptedData) return null;
        return key.decrypt(encryptedData, 'utf8');
    } catch (e) {
        console.error("Decryption failed:", e.message);
        return null;
    }
};
