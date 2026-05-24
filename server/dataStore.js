import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

const require = createRequire(import.meta.url);
const { mkdirSync } = require('fs');
const Database = require('better-sqlite3');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.RESUME_DATA_DIR || (process.env.VERCEL ? '/tmp/ai-resume-assistant' : path.join(__dirname, 'data'));
const DB_PATH = process.env.RESUME_DB_PATH || path.join(DATA_DIR, 'resume.db');

let db;

function getDb() {
  if (!db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL DEFAULT '未命名简历任务',
        mode TEXT NOT NULL DEFAULT 'optimize',
        status TEXT NOT NULL DEFAULT 'draft',
        jd TEXT DEFAULT '',
        resume TEXT,
        materials TEXT,
        analysis TEXT,
        versions TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    ensureColumn(db, 'projects', 'user_id', 'TEXT');
  }
  return db;
}

function ensureColumn(conn, table, column, definition) {
  const exists = conn.prepare(`PRAGMA table_info(${table})`).all().some(col => col.name === column);
  if (!exists) conn.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

function serialize(val) {
  return val != null ? JSON.stringify(val) : null;
}

function deserialize(val) {
  if (val == null) return null;
  try { return JSON.parse(val); } catch { return val; }
}

function deserializeMaterials(val) {
  if (val == null) return { files: [], combinedText: '' };
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return { files: parsed, combinedText: '' };
    return parsed;
  } catch { return { files: [], combinedText: '' }; }
}

function rowToProject(row) {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    title: row.title,
    mode: row.mode,
    status: row.status,
    jd: row.jd,
    resume: deserialize(row.resume),
    materials: deserializeMaterials(row.materials),
    analysis: deserialize(row.analysis),
    versions: deserialize(row.versions) || [],
    error: row.error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || '').split(':');
  if (!salt || !hash) return false;
  const candidate = pbkdf2Sync(password, salt, 120000, 32, 'sha256');
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createUser({ email, name, password }) {
  const conn = getDb();
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();
  const existingCount = conn.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const id = uuidv4();
  conn.prepare(`
    INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, normalizedEmail, name || normalizedEmail.split('@')[0], hashPassword(password), now, now);
  if (existingCount === 0) {
    conn.prepare('UPDATE projects SET user_id = ? WHERE user_id IS NULL').run(id);
  }
  return rowToUser(conn.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export async function getUserByEmail(email) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
}

export async function authenticateUser(email, password) {
  const row = await getUserByEmail(email);
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return rowToUser(row);
}

export async function createSession(userId) {
  const conn = getDb();
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const id = randomBytes(32).toString('hex');
  conn.prepare(`
    INSERT INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, userId, expires.toISOString(), now.toISOString());
  return { id, expiresAt: expires };
}

export async function getUserBySession(sessionId) {
  if (!sessionId) return null;
  const conn = getDb();
  const row = conn.prepare(`
    SELECT users.* FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > ?
  `).get(sessionId, new Date().toISOString());
  return rowToUser(row);
}

export async function deleteSession(sessionId) {
  if (!sessionId) return false;
  const conn = getDb();
  const result = conn.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  return result.changes > 0;
}

export async function listProjects(userId) {
  const conn = getDb();
  const rows = conn.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  return rows.map(rowToProject);
}

export async function getProject(id, userId) {
  const conn = getDb();
  const row = conn.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
  return row ? rowToProject(row) : null;
}

export async function createProject(payload, userId) {
  const conn = getDb();
  const now = new Date().toISOString();
  const id = uuidv4();
  const title = payload.title || '未命名简历任务';
  const mode = payload.mode || 'optimize';
  const status = payload.status || 'draft';
  const jd = payload.jd || '';
  const resume = serialize(payload.resume || null);
  const materials = serialize(payload.materials || []);
  const analysis = serialize(payload.analysis || null);
  const versions = serialize(payload.versions || []);
  const error = payload.error || null;

  conn.prepare(`
    INSERT INTO projects (id, user_id, title, mode, status, jd, resume, materials, analysis, versions, error, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, mode, status, jd, resume, materials, analysis, versions, error, now, now);

  return { id, userId, title, mode, status, jd, resume: deserialize(resume), materials: deserialize(materials), analysis: deserialize(analysis), versions: deserialize(versions), error, createdAt: now, updatedAt: now };
}

export async function updateProject(id, patch, userId) {
  const conn = getDb();
  const existing = conn.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const title = patch.title ?? existing.title;
  const mode = patch.mode ?? existing.mode;
  const status = patch.status ?? existing.status;
  const jd = patch.jd ?? existing.jd;
  const resume = patch.resume !== undefined ? serialize(patch.resume) : existing.resume;
  const materials = patch.materials !== undefined ? serialize(patch.materials) : existing.materials;
  const analysis = patch.analysis !== undefined ? serialize(patch.analysis) : existing.analysis;
  const versions = patch.versions !== undefined ? serialize(patch.versions) : existing.versions;
  const error = patch.error !== undefined ? (patch.error || null) : existing.error;

  conn.prepare(`
    UPDATE projects SET title=?, mode=?, status=?, jd=?, resume=?, materials=?, analysis=?, versions=?, error=?, updated_at=?
    WHERE id=?
  `).run(title, mode, status, jd, resume, materials, analysis, versions, error, now, id);

  const row = conn.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
  return rowToProject(row);
}

export async function deleteProject(id, userId) {
  const conn = getDb();
  const result = conn.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}
