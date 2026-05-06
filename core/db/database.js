import Database from 'better-sqlite3';
import path from 'path';
import fs   from 'fs';

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
      isPinned       INTEGER DEFAULT 0,
      archived       INTEGER DEFAULT 0,
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
      tag            TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_sessions_project   ON sessions(project_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_date      ON sessions(date(started_at));

    CREATE TABLE IF NOT EXISTS groups (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      isPinned    INTEGER DEFAULT 0,
      project_ids TEXT    NOT NULL DEFAULT '[]',
      color       TEXT    DEFAULT '#1a6ef5',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      refId INTEGER NOT NULL,
      content TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(type, refId)
    );

    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      command TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      refId INTEGER NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      launch_count INTEGER DEFAULT 0,
      project_launch_count INTEGER DEFAULT 0,
      sponsorship_status TEXT DEFAULT 'pending',
      session_count_since_later INTEGER DEFAULT 0,
      last_shown_at TEXT,
      custom_tags TEXT DEFAULT '[]',
      shortcuts TEXT DEFAULT '{"openSearch":"Control+k","startProject":"Control+Enter","stopProject":"Control+Shift+Enter","restartProject":"Control+r","toggleSidebar":"Control+b","focusLogs":"Control+l","focusSearch":"Control+f"}',
      notifications_enabled INTEGER DEFAULT 1,
      auto_update_enabled INTEGER DEFAULT 1,
      daily_briefing_enabled INTEGER DEFAULT 1,
      theme TEXT DEFAULT 'system',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_briefings (
      project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      last_shown_date TEXT NOT NULL
    );

    INSERT OR IGNORE INTO app_settings (id, launch_count) VALUES (1, 0);
  `);

  const safe = (sql) => { try { database.exec(sql); } catch {} };
  safe(`ALTER TABLE projects ADD COLUMN url TEXT`);
  safe(`ALTER TABLE projects ADD COLUMN env_file TEXT`);
  safe(`ALTER TABLE projects ADD COLUMN open_terminal INTEGER DEFAULT 1`);
  safe(`ALTER TABLE projects ADD COLUMN open_browser  INTEGER DEFAULT 1`);
  safe(`ALTER TABLE projects ADD COLUMN install_deps  INTEGER DEFAULT 0`);
  safe(`ALTER TABLE projects ADD COLUMN startup_steps TEXT DEFAULT '[]'`);
  safe(`ALTER TABLE projects ADD COLUMN ide_path TEXT`);
  safe(`ALTER TABLE projects ADD COLUMN isPinned INTEGER DEFAULT 0`);
  safe(`ALTER TABLE projects ADD COLUMN archived INTEGER DEFAULT 0`);
  safe(`ALTER TABLE projects ADD COLUMN tag TEXT`);
  safe(`ALTER TABLE projects ADD COLUMN urls TEXT DEFAULT '[]'`);
  safe(`ALTER TABLE projects ADD COLUMN externalApps TEXT DEFAULT '[]'`);
  safe(`ALTER TABLE groups ADD COLUMN isPinned INTEGER DEFAULT 0`);
  safe(`ALTER TABLE sessions ADD COLUMN date TEXT`);
  safe(`ALTER TABLE app_settings ADD COLUMN custom_tags TEXT DEFAULT '[]'`);
  safe(`ALTER TABLE app_settings ADD COLUMN shortcuts TEXT DEFAULT '{"openSearch":"Control+k","startProject":"Control+Enter","stopProject":"Control+Shift+Enter","restartProject":"Control+r","toggleSidebar":"Control+b","focusLogs":"Control+l","focusSearch":"Control+f"}'`);
  safe(`ALTER TABLE app_settings ADD COLUMN notifications_enabled INTEGER DEFAULT 1`);
  safe(`ALTER TABLE app_settings ADD COLUMN auto_update_enabled INTEGER DEFAULT 1`);
  safe(`ALTER TABLE app_settings ADD COLUMN daily_briefing_enabled INTEGER DEFAULT 1`);
  safe(`ALTER TABLE app_settings ADD COLUMN theme TEXT DEFAULT 'system'`);
  safe(`CREATE TABLE IF NOT EXISTS project_briefings (project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE, last_shown_date TEXT NOT NULL)`);
  safe(`ALTER TABLE app_settings ADD COLUMN tour_completed INTEGER DEFAULT 0`);
  safe(`ALTER TABLE app_settings ADD COLUMN tour_step INTEGER DEFAULT 0`);
  safe(`ALTER TABLE app_settings ADD COLUMN tour_skipped INTEGER DEFAULT 0`);
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}
