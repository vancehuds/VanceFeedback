import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config', 'db_config.json');

let pool = null;

export const isConfigured = () => {
    // 1. Check if ENV vars are present (Docker mode auto-config)
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME) {
        return true;
    }
    // 2. Check file config
    return fs.existsSync(CONFIG_PATH);
};

export const loadConfig = () => {
    // 1. Try ENV Config
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME) {
        return {
            type: process.env.DB_TYPE || 'mysql',
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
            database: process.env.DB_NAME
        };
    }

    // 2. Try File Config
    if (!fs.existsSync(CONFIG_PATH)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
};

class SQLiteAdapter {
    constructor(db) {
        this.db = db;
    }

    async query(sql, params) {
        const normalizedSql = sql.trim().toUpperCase();
        if (normalizedSql.startsWith('SELECT') || normalizedSql.startsWith('PRAGMA')) {
            const stmt = this.db.prepare(sql);
            const rows = params && params.length > 0 ? stmt.all(...params) : stmt.all();
            return [rows, null];
        } else {
            try {
                const stmt = this.db.prepare(sql);
                const result = params && params.length > 0 ? stmt.run(...params) : stmt.run();
                return [{
                    affectedRows: result.changes,
                    insertId: Number(result.lastInsertRowid),
                    warningStatus: 0,
                }, null];
            } catch (e) {
                // For DDL statements (CREATE, ALTER, DROP) that can't be prepared
                if (normalizedSql.startsWith('CREATE') || normalizedSql.startsWith('ALTER') ||
                    normalizedSql.startsWith('DROP') || normalizedSql.startsWith('BEGIN') ||
                    normalizedSql.startsWith('COMMIT') || normalizedSql.startsWith('ROLLBACK')) {
                    this.db.exec(sql);
                    return [{ affectedRows: 0, insertId: 0, warningStatus: 0 }, null];
                }
                throw e;
            }
        }
    }

    async execute(sql, params) {
        return this.query(sql, params);
    }

    async getConnection() {
        // Return an object that looks like a connection
        return {
            query: this.query.bind(this),
            execute: this.execute.bind(this),
            release: () => { }, // No-op for SQLite
            beginTransaction: () => this.db.exec('BEGIN'),
            commit: () => this.db.exec('COMMIT'),
            rollback: () => this.db.exec('ROLLBACK')
        };
    }

    async end() {
        this.db.close();
    }
}

/**
 * Detect if running in serverless environment
 */
const isServerless = () => {
    return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.NETLIFY || process.env.SERVERLESS);
};

export const initDB = async (config) => {
    if (pool) {
        try {
            await pool.end();
        } catch (e) {
            // Ignore close errors
        }
    }

    if (config.type === 'sqlite') {
        // Warn in serverless environment (SQLite files won't persist)
        if (isServerless()) {
            console.warn('⚠️ SQLite is not recommended in serverless environments. Data may not persist.');
            console.warn('⚠️ Please configure MySQL via environment variables for production.');
        }

        const dbPath = path.join(__dirname, 'data', 'library_feedback.sqlite');
        // Ensure data dir exists
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const db = new Database(dbPath);
        // Enable WAL mode for better concurrent read performance
        db.pragma('journal_mode = WAL');
        pool = new SQLiteAdapter(db);
        console.log("SQLite Database connected successfully.");
    } else {
        // MySQL with serverless-optimized settings
        const poolConfig = {
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            waitForConnections: true,
            // Reduce connections for serverless (avoids connection exhaustion)
            connectionLimit: isServerless() ? 3 : 10,
            queueLimit: 0,
            // Timeouts for serverless environments
            connectTimeout: 10000,
            // Enable keep-alive to maintain connections
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
            // Force Beijing Time (UTC+8) for database sessions
            timezone: '+08:00'
        };

        pool = mysql.createPool(poolConfig);

        // Test connection
        try {
            const connection = await pool.getConnection();
            console.log(`MySQL Database connected successfully (pool: ${poolConfig.connectionLimit} connections).`);
            connection.release();
        } catch (err) {
            console.error("Database connection failed:", err.message);
            pool = null;
            throw err;
        }
    }
    return true;
};

export const getDB = () => {
    if (!pool) throw new Error("Database not initialized");
    return pool;
};

export const testConnection = async (tempConfig) => {
    if (tempConfig.type === 'sqlite') {
        // Just verify we can open/create the file
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        // Actually trying to open it is best test
        const testPath = path.join(dataDir, 'test_connection.db');
        const db = new Database(testPath);
        db.close();
        fs.unlinkSync(testPath); // Cleanup
        return;
    }

    // MySQL Test
    const connection = await mysql.createConnection({
        host: tempConfig.host,
        port: tempConfig.port,
        user: tempConfig.user,
        password: tempConfig.password
    });
    // Check if database exists, if not try create
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${tempConfig.database}\``);
    await connection.end();
};

export const saveConfig = async (newConfig) => {
    // 1. Verify connection & Ensure DB exists
    await testConnection(newConfig);

    // 2. Write file
    if (!fs.existsSync(path.dirname(CONFIG_PATH))) {
        fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));

    // 3. Init Pool
    await initDB(newConfig);
};
