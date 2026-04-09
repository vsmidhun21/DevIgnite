// core/time-tracker/TimeTracker.js
// Tracks work sessions in the SQLite sessions table.
// One session = one START WORK → STOP cycle.

import { getDb } from '../db/database.js';

export class TimeTracker {
  constructor(dbPath) {
    this.db = getDb(dbPath);

    this._stmts = {
      insert: this.db.prepare(`
        INSERT INTO sessions (project_id, session_id, started_at, env_used, status)
        VALUES (@project_id, @session_id, @started_at, @env_used, 'running')
      `),
      stop: this.db.prepare(`
        UPDATE sessions
        SET ended_at         = @ended_at,
            duration_seconds = @duration_seconds,
            status           = 'completed'
        WHERE session_id = @session_id
      `),
      markError: this.db.prepare(`
        UPDATE sessions
        SET ended_at = @ended_at, status = 'error'
        WHERE session_id = @session_id
      `),
      getActive: this.db.prepare(`
        SELECT * FROM sessions
        WHERE project_id = ? AND status = 'running'
        ORDER BY started_at DESC LIMIT 1
      `),
      getById: this.db.prepare(`
        SELECT * FROM sessions WHERE session_id = ?
      `),
      history: this.db.prepare(`
        SELECT * FROM sessions
        WHERE project_id = ?
        ORDER BY started_at DESC
        LIMIT ?
      `),
      totalToday: this.db.prepare(`
        SELECT COALESCE(SUM(duration_seconds), 0) AS total
        FROM sessions
        WHERE project_id = ?
          AND date(started_at) = date('now')
          AND status = 'completed'
      `),
      totalAll: this.db.prepare(`
        SELECT COALESCE(SUM(duration_seconds), 0) AS total
        FROM sessions
        WHERE project_id = ? AND status = 'completed'
      `),
      deleteOld: this.db.prepare(`
        DELETE FROM sessions
        WHERE project_id = ?
          AND id NOT IN (
            SELECT id FROM sessions
            WHERE project_id = ?
            ORDER BY started_at DESC
            LIMIT ?
          )
      `),
    };
  }

  /**
   * Start a new tracking session.
   * @param {number} projectId
   * @param {string} sessionId   - UUID from ExecutionManager
   * @param {string} envUsed     - name of env file loaded (or null)
   * @returns {object} the new session row values
   */
  start(projectId, sessionId, envUsed = null) {
    const startedAt = new Date().toISOString();

    // Stop any orphaned running session for this project
    const active = this._stmts.getActive.get(projectId);
    if (active) {
      this._forceStop(active.session_id, active.started_at);
    }

    this._stmts.insert.run({
      project_id:  projectId,
      session_id:  sessionId,
      started_at:  startedAt,
      env_used:    envUsed,
    });

    return { sessionId, projectId, startedAt, envUsed };
  }

  /**
   * Stop a session and record duration.
   * @returns {{ sessionId, durationSeconds, startedAt, endedAt }}
   */
  stop(sessionId) {
    const session = this._stmts.getById.get(sessionId);
    if (!session) return null;

    const endedAt         = new Date().toISOString();
    const startMs         = new Date(session.started_at).getTime();
    const durationSeconds = Math.round((Date.now() - startMs) / 1000);

    this._stmts.stop.run({ session_id: sessionId, ended_at: endedAt, duration_seconds: durationSeconds });

    return {
      sessionId,
      durationSeconds,
      startedAt: session.started_at,
      endedAt,
      formatted: this.formatDuration(durationSeconds),
    };
  }

  /**
   * Mark a session as errored (process crashed).
   */
  markError(sessionId) {
    const endedAt = new Date().toISOString();
    this._stmts.markError.run({ session_id: sessionId, ended_at: endedAt });
  }

  /**
   * Get the currently running session for a project (if any).
   */
  getActiveSession(projectId) {
    return this._stmts.getActive.get(projectId) ?? null;
  }

  /**
   * Get session history for a project (most recent first).
   * @param {number} projectId
   * @param {number} limit      - default 20
   */
  getHistory(projectId, limit = 20) {
    return this._stmts.history.all(projectId, limit);
  }

  /**
   * Total tracked seconds today for a project.
   */
  getTodayTotal(projectId) {
    return this._stmts.totalToday.get(projectId)?.total ?? 0;
  }

  /**
   * Total tracked seconds ever for a project.
   */
  getAllTimeTotal(projectId) {
    return this._stmts.totalAll.get(projectId)?.total ?? 0;
  }

  /**
   * Live duration in seconds for a running session.
   */
  getLiveDuration(sessionId) {
    const session = this._stmts.getById.get(sessionId);
    if (!session || session.status !== 'running') return 0;
    return Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000);
  }

  /**
   * Prune old sessions keeping the latest N per project.
   */
  pruneHistory(projectId, keep = 50) {
    this._stmts.deleteOld.run(projectId, projectId, keep);
  }

  /**
   * Format seconds → "2h 15m 30s"
   */
  formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${s}s`].filter(Boolean).join(' ');
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _forceStop(sessionId, startedAt) {
    const endedAt         = new Date().toISOString();
    const durationSeconds = Math.round(
      (Date.now() - new Date(startedAt).getTime()) / 1000
    );
    this._stmts.stop.run({ session_id: sessionId, ended_at: endedAt, duration_seconds: durationSeconds });
  }
}
