// core/project-manager/LogManager.js
// Handles log persistence and retrieval.
// Used by main process to save streamed output to SQLite.

import { getDb } from '../db/database';
// const { getDb } = require('../db/database');

class LogManager {
  constructor(dbPath) {
    this.db = getDb(dbPath);

    this._stmts = {
      insert: this.db.prepare(`
        INSERT INTO logs (project_id, level, message, session_id)
        VALUES (@project_id, @level, @message, @session_id)
      `),
      getRecent: this.db.prepare(`
        SELECT * FROM logs
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `),
      getBySession: this.db.prepare(`
        SELECT * FROM logs
        WHERE project_id = ? AND session_id = ?
        ORDER BY created_at ASC
      `),
      clearProject: this.db.prepare('DELETE FROM logs WHERE project_id = ?'),
      clearOld: this.db.prepare(`
        DELETE FROM logs WHERE created_at < datetime('now', ?)
      `),
    };
  }

  /**
   * Insert a single log line.
   */
  insert(projectId, level, message, sessionId) {
    this._stmts.insert.run({
      project_id: projectId,
      level,
      message,
      session_id: sessionId,
    });
  }

  /**
   * Batch insert log lines (much faster for high-throughput output).
   * @param {LogLine[]} lines
   */
  insertBatch(lines) {
    const insert = this.db.transaction((lines) => {
      for (const l of lines) {
        this._stmts.insert.run(l);
      }
    });
    insert(lines);
  }

  /**
   * Get the most recent N log lines for a project.
   */
  getRecent(projectId, limit = 200) {
    return this._stmts.getRecent.all(projectId, limit).reverse();
  }

  /**
   * Get all logs for a specific run session.
   */
  getBySession(projectId, sessionId) {
    return this._stmts.getBySession.all(projectId, sessionId);
  }

  /**
   * Clear all logs for a project.
   */
  clearProject(projectId) {
    this._stmts.clearProject.run(projectId);
  }

  /**
   * Prune old logs (keep DB size manageable).
   * @param {string} olderThan - e.g. '-7 days'
   */
  pruneOld(olderThan = '-7 days') {
    this._stmts.clearOld.run(olderThan);
  }
}

// module.exports = LogManager;
export { LogManager };
