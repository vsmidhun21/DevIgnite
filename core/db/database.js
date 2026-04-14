import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db = null;

export function getDb(dbPath) {
  if (db) return db;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT    NOT NULL,
      path           TEXT    NOT NULL,
      type           TEXT    NOT NULL DEFAULT 'Custom',
      command        TEXT    NOT NULL DEFAULT '',
      ide            TEXT    NOT NULL DEFAULT 'VS Code',
      ide_path       TEXT,
      port           INTEGER,
      url            TEXT,
      active_env     TEXT    NOT NULL DEFAULT 'dev',
      env_file       TEXT,
      startup_steps  TEXT    DEFAULT '[]',
      open_terminal  INTEGER DEFAULT 1,
      open_browser   INTEGER DEFAULT 1,
      install_deps   INTEGER DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS environments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      command     TEXT,
      port        INTEGER,
      env_vars    TEXT    DEFAULT '{}',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, name)
    );

    CREATE TABLE IF NOT EXISTS logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      level       TEXT    NOT NULL DEFAULT 'info',
      message     TEXT    NOT NULL,
      session_id  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_logs_project ON logs(project_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS sessions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      session_id       TEXT    NOT NULL UNIQUE,
      started_at       TEXT    NOT NULL,
      ended_at         TEXT,
      duration_seconds INTEGER,
      env_used         TEXT,
      status           TEXT    NOT NULL DEFAULT 'running'
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, started_at DESC);
  `);

  const safe = (sql) => { try { database.exec(sql); } catch {} };
  safe(`ALTER TABLE projects ADD COLUMN url TEXT`);
  safe(`ALTER TABLE projects ADD COLUMN env_file TEXT`);
  safe(`ALTER TABLE projects ADD COLUMN open_terminal INTEGER DEFAULT 1`);
  safe(`ALTER TABLE projects ADD COLUMN open_browser INTEGER DEFAULT 1`);
  safe(`ALTER TABLE projects ADD COLUMN install_deps INTEGER DEFAULT 0`);
  safe(`ALTER TABLE projects ADD COLUMN startup_steps TEXT DEFAULT '[]'`);
  safe(`ALTER TABLE projects ADD COLUMN ide_path TEXT`);
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}
