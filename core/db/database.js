//import Database from 'better-sqlite3';

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// const Database = require('better-sqlite3');
// const path = require('path');
// const fs = require('fs');

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
      port           INTEGER,
      active_env     TEXT    NOT NULL DEFAULT 'dev',
      startup_steps  TEXT    DEFAULT '[]',
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
  `);

  // Add startup_steps column to existing DBs (safe migration)
  try {
    database.exec(`ALTER TABLE projects ADD COLUMN startup_steps TEXT DEFAULT '[]'`);
  } catch { } // Column already exists — ignore
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}

// module.exports = { getDb, closeDb };
