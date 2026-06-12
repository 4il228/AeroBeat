import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getDb, closeDb } from '../server/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aerobeat-dev-secret-change-in-prod';

let app;
let server;
const PORT = 3099;
let counter = 0;

/** Create a fresh auth router without rate limiter for testing */
async function createTestApp() {
    const mod = await import('../server/routes/auth.js');
    const authRouter = mod.default;
    const authenticateToken = mod.authenticateToken;

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/auth', authRouter);
    testApp.get('/api/test-protected', authenticateToken, (req, res) => {
        res.json({ user: req.user });
    });
    return testApp;
}

beforeAll(async () => {
    getDb();
    app = await createTestApp();
    server = app.listen(PORT);
});

afterAll(() => {
    closeDb();
    server.close();
});

/** Helper: make a fetch request to the test server */
async function api(method, path, body, headers = {}) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`http://localhost:${PORT}${path}`, opts);
    const data = await res.json();
    return { status: res.status, data };
}

/** Generate a unique short username (under 20 chars, min 3) */
function uniqueUsername() {
    counter++;
    return `usr${counter}`;
}

describe('auth API', () => {
    const testUser = {
        username: uniqueUsername(),
        password: 'testpass123',
    };

    describe('POST /api/auth/register', () => {
        it('registers a new user successfully', async () => {
            const { status, data } = await api('POST', '/api/auth/register', testUser);

            expect(status).toBe(201);
            expect(data.token).toBeDefined();
            expect(data.user).toBeDefined();
            expect(data.user.username).toBe(testUser.username);
            expect(data.user.display_name).toBe(testUser.username);
        });

        it('rejects duplicate username', async () => {
            const { status, data } = await api('POST', '/api/auth/register', testUser);

            expect(status).toBe(409);
            expect(data.error).toMatch(/taken/i);
        });

        it('rejects short password', async () => {
            const { status, data } = await api('POST', '/api/auth/register', {
                username: uniqueUsername(),
                password: '123',
            });

            expect(status).toBe(400);
            expect(data.error).toMatch(/password/i);
        });

        it('rejects invalid username format', async () => {
            const { status, data } = await api('POST', '/api/auth/register', {
                username: 'ab',
                password: 'validpass',
            });

            expect(status).toBe(400);
            expect(data.error).toMatch(/username/i);
        });
    });

    describe('POST /api/auth/login', () => {
        it('logs in with correct credentials', async () => {
            const { status, data } = await api('POST', '/api/auth/login', testUser);

            expect(status).toBe(200);
            expect(data.token).toBeDefined();
            expect(data.user.username).toBe(testUser.username);
        });

        it('rejects wrong password', async () => {
            const { status, data } = await api('POST', '/api/auth/login', {
                username: testUser.username,
                password: 'wrongpassword',
            });

            expect(status).toBe(401);
            expect(data.error).toMatch(/invalid/i);
        });

        it('rejects non-existent user', async () => {
            const { status, data } = await api('POST', '/api/auth/login', {
                username: 'zzznonexistent999',
                password: 'whatever',
            });

            expect(status).toBe(401);
            expect(data.error).toMatch(/invalid/i);
        });
    });

    describe('GET /api/auth/me', () => {
        let token;

        beforeAll(async () => {
            const { data } = await api('POST', '/api/auth/login', testUser);
            token = data.token;
        });

        it('returns user with valid token', async () => {
            const { status, data } = await api('GET', '/api/auth/me', null, {
                Authorization: `Bearer ${token}`,
            });

            expect(status).toBe(200);
            expect(data.username).toBe(testUser.username);
            expect(data.id).toBeDefined();
        });

        it('rejects missing token', async () => {
            const { status, data } = await api('GET', '/api/auth/me');

            expect(status).toBe(401);
            expect(data.error).toMatch(/authentication/i);
        });

        it('rejects invalid token', async () => {
            const { status, data } = await api('GET', '/api/auth/me', null, {
                Authorization: 'Bearer invalidtoken123',
            });

            expect(status).toBe(403);
            expect(data.error).toMatch(/invalid/i);
        });
    });

    describe('authenticateToken middleware', () => {
        it('attaches user to req with valid token', async () => {
            const token = jwt.sign({ id: 1, username: 'test' }, JWT_SECRET, { expiresIn: '1h' });
            const { status, data } = await api('GET', '/api/test-protected', null, {
                Authorization: `Bearer ${token}`,
            });

            expect(status).toBe(200);
            expect(data.user.username).toBe('test');
        });

        it('returns 401 without token', async () => {
            const { status } = await api('GET', '/api/test-protected');
            expect(status).toBe(401);
        });

        it('returns 403 with expired token', async () => {
            const token = jwt.sign({ id: 1, username: 'test' }, JWT_SECRET, { expiresIn: '0s' });
            await new Promise(r => setTimeout(r, 10));
            const { status } = await api('GET', '/api/test-protected', null, {
                Authorization: `Bearer ${token}`,
            });

            expect(status).toBe(403);
        });
    });
});
