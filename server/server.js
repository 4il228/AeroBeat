/**
 * AeroBeat — Express Server
 * Serves the REST API and static frontend files.
 * Run: npm run server (or node server/server.js)
 */

import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './db.js';
import tracksRouter from './routes/tracks.js';
import authRouter from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static files ───────────────────────────────────────────────────
// Serve frontend from project root
app.use(express.static(ROOT));

// Serve uploaded audio files (server/uploads/)
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// ── API Routes ─────────────────────────────────────────────────────
app.use('/api/tracks', tracksRouter);
app.use('/api/auth', authRouter);

// ── Health check ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 fallback for API ──────────────────────────────────────────
app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// ── Start server ───────────────────────────────────────────────────
getDb(); // Initialize database on startup

const server = app.listen(PORT, () => {
    console.log(`AeroBeat server running at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    closeDb();
    server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
    closeDb();
    server.close(() => process.exit(0));
});
