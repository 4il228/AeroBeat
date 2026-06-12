/**
 * AeroBeat — Tracks Route
 * CRUD API for tracks table:
 *   GET    /api/tracks      — list all tracks (light, no beatmap/file_path)
 *   GET    /api/tracks/:id  — single track with beatmap JSON
 *   POST   /api/tracks      — publish a new track (multipart: audio + metadata)
 *   DELETE /api/tracks/:id  — remove track and its audio file
 */

import { Router } from 'express';
import multer from 'multer';
import { createHash } from 'crypto';
import { readFileSync, renameSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

/** Upload destination directory */
const UPLOAD_DIR = join(__dirname, '..', 'uploads', 'tracks');
mkdirSync(UPLOAD_DIR, { recursive: true });

/** Allowed audio MIME types */
const ALLOWED_MIME = new Set([
    'audio/mpeg', 'audio/mp3', 'audio/ogg',
    'audio/wav', 'audio/flac', 'audio/x-wav',
    'audio/wave', 'audio/x-flac',
]);

/** Allowed file extensions */
const ALLOWED_EXT = new Set(['.mp3', '.ogg', '.wav', '.flac']);

/** Max file size: 50 MB */
const MAX_SIZE = 50 * 1024 * 1024;

/** Multer storage */
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = getExtension(file);
        cb(null, `temp_${Date.now()}${ext}`);
    },
});

function fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    const ext = getExtension(file);
    if (ALLOWED_EXT.has(ext)) return cb(null, true);
    cb(new Error('Unsupported audio format'));
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

/**
 * Get file extension from original name or MIME type.
 */
function getExtension(file) {
    const fromName = file.originalname?.split('.').pop()?.toLowerCase();
    if (fromName && ALLOWED_EXT.has(`.${fromName}`)) return `.${fromName}`;
    const mimeMap = {
        'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/ogg': '.ogg',
        'audio/wav': '.wav', 'audio/flac': '.flac',
    };
    return mimeMap[file.mimetype] || '.mp3';
}

// ─── GET /api/tracks ──────────────────────────────────────────────
// List all tracks. Lightweight: no beatmap, no file_path.
router.get('/', (_req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare(`
            SELECT id, title, artist, bpm, duration, note_count, created_at
            FROM tracks ORDER BY created_at DESC
        `).all();
        res.json({ tracks: rows });
    } catch (err) {
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// ─── GET /api/tracks/:id ──────────────────────────────────────────
// Full track data including beatmap JSON.
router.get('/:id', (req, res) => {
    try {
        const db = getDb();
        const row = db.prepare(`
            SELECT id, title, artist, bpm, duration, file_path, file_size,
                   file_hash, note_count, beatmap, created_at, updated_at
            FROM tracks WHERE id = ?
        `).get(req.params.id);

        if (!row) {
            return res.status(404).json({ error: 'Track not found' });
        }

        // Deserialize beatmap JSON
        if (row.beatmap) {
            try { row.beatmap = JSON.parse(row.beatmap); }
            catch (_) { /* leave as string if corrupt */ }
        }

        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// ─── POST /api/tracks ─────────────────────────────────────────────
// Publish a new track. Multipart form: audio file + metadata fields.
router.post('/', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
    }

    const { title, artist, bpm, duration, beatmap } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
    }
    if (!bpm || isNaN(Number(bpm))) {
        return res.status(400).json({ error: 'Valid BPM is required' });
    }
    if (!duration || isNaN(Number(duration))) {
        return res.status(400).json({ error: 'Valid duration is required' });
    }
    if (!beatmap) {
        return res.status(400).json({ error: 'Beatmap JSON is required' });
    }

    // Validate beatmap is valid JSON
    let beatmapObj;
    try {
        beatmapObj = JSON.parse(beatmap);
    } catch (_) {
        return res.status(400).json({ error: 'Invalid beatmap JSON' });
    }

    const tmpPath = req.file.path;

    try {
        // Compute SHA-256 hash
        const data = readFileSync(tmpPath);
        const fileHash = createHash('sha256').update(data).digest('hex');
        const ext = getExtension(req.file);
        const finalName = `${fileHash}${ext}`;
        const finalPath = join(UPLOAD_DIR, finalName);
        const db = getDb();

        // Check for duplicate hash
        const existing = db.prepare('SELECT id, title, artist FROM tracks WHERE file_hash = ?').get(fileHash);
        if (existing) {
            unlinkSync(tmpPath);
            return res.status(409).json({
                error: 'Duplicate file',
                track_id: existing.id,
                title: existing.title,
                artist: existing.artist,
            });
        }

        // Rename temp file to final hash-based name
        renameSync(tmpPath, finalPath);

        const noteCount = beatmapObj.notes?.length || 0;
        const filePath = `uploads/tracks/${finalName}`;

        const result = db.prepare(`
            INSERT INTO tracks (title, artist, bpm, duration, file_path, file_size, file_hash, note_count, beatmap)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            title.trim(),
            (artist || 'Unknown').trim(),
            Number(bpm),
            Number(duration),
            filePath,
            req.file.size,
            fileHash,
            noteCount,
            JSON.stringify(beatmapObj),
        );

        res.status(201).json({
            id: result.lastInsertRowid,
            title: title.trim(),
            artist: (artist || 'Unknown').trim(),
        });
    } catch (err) {
        try { unlinkSync(tmpPath); } catch (_) { /* ignore */ }
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// ─── DELETE /api/tracks/:id ───────────────────────────────────────
// Remove a track and its audio file from disk.
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const row = db.prepare('SELECT id, file_path FROM tracks WHERE id = ?').get(req.params.id);

        if (!row) {
            return res.status(404).json({ error: 'Track not found' });
        }

        // Delete file from disk
        const fullPath = join(__dirname, '..', row.file_path);
        if (existsSync(fullPath)) {
            unlinkSync(fullPath);
        }

        db.prepare('DELETE FROM tracks WHERE id = ?').run(req.params.id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

export default router;
