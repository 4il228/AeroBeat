/**
 * AeroBeat — Database Module
 * SQLite initialization, schema creation, and migration helpers.
 * Uses better-sqlite3 for synchronous, zero-config embedded database.
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {Database} Database instance */
let db = null;

/**
 * Get or create the database connection.
 * Creates the `server/` directory and `aerobeat.db` file if they don't exist.
 * @returns {Database}
 */
export function getDb() {
    if (db) return db;

    const dbPath = join(__dirname, 'aerobeat.db');
    mkdirSync(__dirname, { recursive: true });

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    initSchema();

    return db;
}

/**
 * Create the tracks table and indexes if they don't exist.
 */
function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS tracks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            artist      TEXT NOT NULL DEFAULT 'Unknown',
            bpm         REAL NOT NULL,
            duration    REAL NOT NULL,
            file_path   TEXT NOT NULL UNIQUE,
            file_size   INTEGER NOT NULL,
            file_hash   TEXT NOT NULL UNIQUE,
            note_count  INTEGER NOT NULL DEFAULT 0,
            beatmap     TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_tracks_hash ON tracks(file_hash);
        CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
        CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);

        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT NOT NULL UNIQUE,
            email         TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            display_name  TEXT,
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
}

/**
 * Close the database connection gracefully.
 */
export function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}
