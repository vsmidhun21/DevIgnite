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
        UPDATE sessions SET ended_at=@ended_at, duration_seconds=@duration_seconds, status='completed'
        WHERE session_id=@session_id
      `),
      markError: this.db.prepare(`UPDATE sessions SET ended_at=@ended_at, status='error' WHERE session_id=@session_id`),
      getActive: this.db.prepare(`SELECT * FROM sessions WHERE project_id=? AND status='running' ORDER BY started_at DESC LIMIT 1`),
      getById:   this.db.prepare(`SELECT * FROM sessions WHERE session_id=?`),
      history:   this.db.prepare(`SELECT * FROM sessions WHERE project_id=? ORDER BY started_at DESC LIMIT ?`),
      totalToday:this.db.prepare(`SELECT COALESCE(SUM(duration_seconds),0) AS total FROM sessions WHERE project_id=? AND date(started_at)=date('now') AND status='completed'`),
      totalAll:  this.db.prepare(`SELECT COALESCE(SUM(duration_seconds),0) AS total FROM sessions WHERE project_id=? AND status='completed'`),
      deleteOld: this.db.prepare(`DELETE FROM sessions WHERE project_id=? AND id NOT IN (SELECT id FROM sessions WHERE project_id=? ORDER BY started_at DESC LIMIT ?)`),
      // Productivity queries
      dailySeconds: this.db.prepare(`
        SELECT date(started_at) AS day, SUM(duration_seconds) AS seconds
        FROM sessions WHERE project_id=? AND status='completed'
        GROUP BY day ORDER BY day DESC LIMIT ?
      `),
      dailySecondsAll: this.db.prepare(`
        SELECT date(started_at) AS day, SUM(duration_seconds) AS seconds
        FROM sessions WHERE status='completed'
        GROUP BY day ORDER BY day DESC LIMIT ?
      `),
      weekTotal: this.db.prepare(`
        SELECT COALESCE(SUM(duration_seconds),0) AS total
        FROM sessions
        WHERE status='completed'
          AND project_id=?
          AND date(started_at) >= date('now', '-6 days')
      `),
      weekTotalAll: this.db.prepare(`
        SELECT COALESCE(SUM(duration_seconds),0) AS total
        FROM sessions WHERE status='completed' AND date(started_at) >= date('now', '-6 days')
      `),
      activeDays: this.db.prepare(`
        SELECT DISTINCT date(started_at) AS day
        FROM sessions WHERE project_id=? AND status='completed' ORDER BY day DESC
      `),
      activeDaysAll: this.db.prepare(`
        SELECT DISTINCT date(started_at) AS day
        FROM sessions WHERE status='completed' ORDER BY day DESC LIMIT 400
      `),
    };
  }

  start(projectId, sessionId, envUsed = null) {
    const startedAt = new Date().toISOString();
    const active    = this._stmts.getActive.get(projectId);
    if (active) this._forceStop(active.session_id, active.started_at);
    this._stmts.insert.run({ project_id: projectId, session_id: sessionId, started_at: startedAt, env_used: envUsed });
    return { sessionId, projectId, startedAt, envUsed };
  }

  stop(sessionId) {
    const session = this._stmts.getById.get(sessionId);
    if (!session) return null;
    const endedAt         = new Date().toISOString();
    const durationSeconds = Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000);
    this._stmts.stop.run({ session_id: sessionId, ended_at: endedAt, duration_seconds: durationSeconds });
    return { sessionId, durationSeconds, startedAt: session.started_at, endedAt, formatted: this.formatDuration(durationSeconds) };
  }

  markError(sessionId) {
    this._stmts.markError.run({ session_id: sessionId, ended_at: new Date().toISOString() });
  }

  getActiveSession(projectId) { return this._stmts.getActive.get(projectId) ?? null; }
  getHistory(projectId, limit = 20) { return this._stmts.history.all(projectId, limit); }
  getTodayTotal(projectId)  { return this._stmts.totalToday.get(projectId)?.total ?? 0; }
  getAllTimeTotal(projectId) { return this._stmts.totalAll.get(projectId)?.total ?? 0; }
  getWeekTotal(projectId)   { return this._stmts.weekTotal.get(projectId)?.total ?? 0; }
  getWeekTotalAll()         { return this._stmts.weekTotalAll.get()?.total ?? 0; }

  getLiveDuration(sessionId) {
    const s = this._stmts.getById.get(sessionId);
    if (!s || s.status !== 'running') return 0;
    return Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000);
  }

  getDailyBreakdown(projectId, days = 30) {
    return this._stmts.dailySeconds.all(projectId, days);
  }

  getDailyBreakdownAll(days = 30) {
    return this._stmts.dailySecondsAll.all(days);
  }

  /**
   * Calculate streak: consecutive days with any coding activity.
   * @param {number|null} projectId  null = across all projects
   * @returns {{ current: number, longest: number, lastActiveDate: string|null }}
   */
  getStreak(projectId = null) {
    const rows = projectId
      ? this._stmts.activeDays.all(projectId)
      : this._stmts.activeDaysAll.all();

    if (!rows.length) return { current: 0, longest: 0, lastActiveDate: null };

    const days = rows.map(r => r.day).sort().reverse(); // most recent first
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Current streak — must include today or yesterday
    let current = 0;
    if (days[0] === today || days[0] === yesterday) {
      let prev = days[0];
      current = 1;
      for (let i = 1; i < days.length; i++) {
        const diff = (new Date(prev) - new Date(days[i])) / 86400000;
        if (diff === 1) { current++; prev = days[i]; }
        else break;
      }
    }

    // Longest streak
    let longest = 0, run = 1;
    const sorted = [...days].sort();
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000;
      if (diff === 1) { run++; longest = Math.max(longest, run); }
      else run = 1;
    }
    longest = Math.max(longest, current, 1);

    return { current, longest, lastActiveDate: days[0] ?? null };
  }

  /**
   * Full productivity stats for a project (or all projects).
   */
  getProductivityStats(projectId = null) {
    const today    = projectId ? this.getTodayTotal(projectId) : this._stmts.weekTotalAll.get()?.total ?? 0;
    const week     = projectId ? this.getWeekTotal(projectId) : this.getWeekTotalAll();
    const allTime  = projectId ? this.getAllTimeTotal(projectId) : 0;
    const streak   = this.getStreak(projectId);
    const daily    = projectId ? this.getDailyBreakdown(projectId, 30) : this.getDailyBreakdownAll(30);

    return {
      todaySeconds:   projectId ? today : this._getTodayAll(),
      weekSeconds:    week,
      allTimeSeconds: allTime,
      streak,
      daily,
    };
  }

  pruneHistory(projectId, keep = 100) {
    this._stmts.deleteOld.run(projectId, projectId, keep);
  }

  formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${s}s`].filter(Boolean).join(' ');
  }

  _forceStop(sessionId, startedAt) {
    const endedAt         = new Date().toISOString();
    const durationSeconds = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
    this._stmts.stop.run({ session_id: sessionId, ended_at: endedAt, duration_seconds: durationSeconds });
  }

  _getTodayAll() {
    return this.db.prepare(`
      SELECT COALESCE(SUM(duration_seconds),0) AS total
      FROM sessions WHERE date(started_at)=date('now') AND status='completed'
    `).get()?.total ?? 0;
  }

  addManualEntry(projectId, seconds, note = '') {
    const ts = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO sessions (project_id, session_id, started_at, ended_at, duration_seconds, env_used, status)
      VALUES (?, ?, ?, ?, ?, ?, 'completed')
    `).run(projectId, `manual-${Date.now()}`, ts, ts, seconds, note ? `Manual: ${note}` : 'Manual Entry');
  }
}
