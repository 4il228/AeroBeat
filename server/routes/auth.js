/**
 * AeroBeat — Auth Routes
 * JWT-based authentication: register, login, profile.
 * Uses bcryptjs for password hashing and jsonwebtoken for JWT.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'aerobeat-dev-secret-change-in-prod';
const SALT_ROUNDS = 12;

/** Username validation: 3–20 chars, alphanumeric + _ - */
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

// ── Rate limiting ─────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
});

// ── Middleware ────────────────────────────────────────────────────

/**
 * Authenticate a JWT token from the Authorization header.
 * Attaches req.user = { id, username } on success.
 */
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// ── Routes ───────────────────────────────────────────────────────

/**
 * POST /api/auth/register — register a new user
 */
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, password, email } = req.body;

        // Validate username
        if (!username || !USERNAME_REGEX.test(username)) {
            return res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, _ -)' });
        }

        // Validate password
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const db = getDb();

        // Check username uniqueness
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // Check email uniqueness (if provided)
        if (email) {
            const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (emailExists) {
                return res.status(409).json({ error: 'Email already registered' });
            }
        }

        // Hash password and insert user
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = db.prepare(
            'INSERT INTO users (username, password_hash, email, display_name) VALUES (?, ?, ?, ?)'
        ).run(username, passwordHash, email || null, username);

        // Generate JWT
        const token = jwt.sign(
            { id: result.lastInsertRowid, username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: { id: result.lastInsertRowid, username, display_name: username },
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/auth/login — login with username and password
 */
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { id: user.id, username: user.username, display_name: user.display_name },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/auth/me — get current user (requires auth)
 */
router.get('/me', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const user = db.prepare(
            'SELECT id, username, display_name, email, created_at FROM users WHERE id = ?'
        ).get(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PUT /api/auth/profile — update profile (requires auth)
 */
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { display_name, email } = req.body;
        const db = getDb();

        if (display_name !== undefined) {
            if (typeof display_name !== 'string' || display_name.length < 1 || display_name.length > 30) {
                return res.status(400).json({ error: 'Display name must be 1–30 characters' });
            }
            db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name, req.user.id);
        }

        if (email !== undefined) {
            if (email) {
                const exists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
                if (exists) {
                    return res.status(409).json({ error: 'Email already registered' });
                }
            }
            db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || null, req.user.id);
        }

        const user = db.prepare(
            'SELECT id, username, display_name, email, created_at FROM users WHERE id = ?'
        ).get(req.user.id);

        res.json({ user });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
