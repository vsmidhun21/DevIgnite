// core/log-manager/LogManager.js
// File-based log storage: {userData}/logs/{projectId}/current.log + previous.log
// Streams lines to renderer via batched IPC (16ms flush window) — not one IPC per line.

import fs   from 'fs';
import path from 'path';

const MAX_FILE_BYTES   = 2 * 1024 * 1024; // 2 MB cap per file
const FLUSH_INTERVAL   = 16;              // ms — ~1 frame batch window
const STAT_INTERVAL    = 500;             // ms — rate-limit fs.statSync calls

export class LogManager {
  /**
   * @param {string}   logsDir   - root logs directory e.g. {userData}/logs
   * @param {Function} onStream  - (projectId, level, message, ts) callback → pushed to renderer
   */
  constructor(logsDir, onStream) {
    this.logsDir  = logsDir;
    this.onStream = onStream || (() => {});
    this._streams = new Map(); // projectId → WriteStream

    // Batched IPC: buffer lines per projectId, flush on interval
    // Map<projectId, { level, message, ts }[]>
    this._pending   = new Map();
    this._flushTimer = null;

    // Rate-limit statSync: Map<projectId, { size, checkedAt }>
    this._statCache  = new Map();

    // Guard flag per projectId: prevent writing to a closed stream
    this._closedStreams = new Set();

    this._startFlushLoop();
  }

  // ── Session lifecycle ───────────────────────────────────────────────────────

  startSession(projectId, sessionId) {
    this._closeStream(projectId);

    const dir = this._dir(projectId);
    fs.mkdirSync(dir, { recursive: true });

    const currentPath  = this._path(projectId, 'current');
    const previousPath = this._path(projectId, 'previous');

    if (fs.existsSync(currentPath)) {
      try { fs.renameSync(currentPath, previousPath); } catch {}
    }

    const header = `=== Session ${sessionId} started at ${new Date().toISOString()} ===\n`;
    fs.writeFileSync(currentPath, header, 'utf8');

    const stream = fs.createWriteStream(currentPath, { flags: 'a' });
    this._streams.set(projectId, stream);
    this._closedStreams.delete(projectId);
    // Reset stat cache for this project
    this._statCache.delete(projectId);

    return currentPath;
  }

  endSession(projectId) {
    const stream = this._streams.get(projectId);
    if (stream && !this._closedStreams.has(projectId)) {
      const footer = `\n=== Session ended at ${new Date().toISOString()} ===\n`;
      try { stream.write(footer); } catch {}
    }
    this._closeStream(projectId);
  }

  // ── Writing ─────────────────────────────────────────────────────────────────

  write(projectId, level, message, sessionId = null) {
    const ts   = new Date().toISOString();
    const line = `[${ts}] [${level.toUpperCase().padEnd(7)}] ${message}\n`;

    // Write to file — guard against closed stream and use cached stat
    const stream = this._streams.get(projectId);
    if (stream && !this._closedStreams.has(projectId)) {
      if (this._isUnderSizeLimit(projectId)) {
        try { stream.write(line); } catch {}
      }
    }

    // Buffer for batched IPC flush (never call onStream directly per line)
    if (!this._pending.has(projectId)) this._pending.set(projectId, []);
    this._pending.get(projectId).push({ level, message, ts });
  }

  // ── Reading ─────────────────────────────────────────────────────────────────

  read(projectId, which = 'current') {
    const filePath = this._path(projectId, which);
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8');
  }

  readParsed(projectId, which = 'current') {
    const raw   = this.read(projectId, which);
    const lines = [];
    for (const line of raw.split('\n')) {
      const m = line.match(/^\[(.+?)\] \[(\w+)\s*\] (.+)$/);
      if (m) lines.push({ ts: m[1], level: m[2].toLowerCase(), message: m[3] });
    }
    return lines;
  }

  clear(projectId) {
    this._closeStream(projectId);
    this._pending.delete(projectId);
    this._statCache.delete(projectId);
    for (const which of ['current', 'previous']) {
      const p = this._path(projectId, which);
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    }
  }

  getMeta(projectId) {
    const result = {};
    for (const which of ['current', 'previous']) {
      const p = this._path(projectId, which);
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        result[which] = { path: p, size: stat.size, mtime: stat.mtime.toISOString() };
      } else {
        result[which] = null;
      }
    }
    return result;
  }

  closeAll() {
    // Flush any remaining buffered lines before closing
    this._flushPending();
    if (this._flushTimer) { clearInterval(this._flushTimer); this._flushTimer = null; }
    for (const id of [...this._streams.keys()]) this._closeStream(id);
    this._statCache.clear();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _dir(projectId)         { return path.join(this.logsDir, String(projectId)); }
  _path(projectId, which) { return path.join(this._dir(projectId), `${which}.log`); }

  _closeStream(projectId) {
    const stream = this._streams.get(projectId);
    if (stream) {
      this._closedStreams.add(projectId);
      try { stream.end(); } catch {}
      this._streams.delete(projectId);
    }
  }

  /**
   * Rate-limited file size check — reads from cache if checked within STAT_INTERVAL.
   */
  _isUnderSizeLimit(projectId) {
    const now    = Date.now();
    const cached = this._statCache.get(projectId);
    if (cached && (now - cached.checkedAt) < STAT_INTERVAL) {
      return cached.size < MAX_FILE_BYTES;
    }
    try {
      const stat = fs.statSync(this._path(projectId, 'current'));
      this._statCache.set(projectId, { size: stat.size, checkedAt: now });
      return stat.size < MAX_FILE_BYTES;
    } catch {
      return true; // allow write if stat fails
    }
  }

  /**
   * Start the 16ms flush loop — sends batched lines to renderer via onStream.
   * Reduces IPC calls from N-per-line to ~1 per frame under heavy log output.
   */
  _startFlushLoop() {
    this._flushTimer = setInterval(() => this._flushPending(), FLUSH_INTERVAL);
    // Don't prevent process exit for this timer
    if (this._flushTimer.unref) this._flushTimer.unref();
  }

  _flushPending() {
    if (this._pending.size === 0) return;
    for (const [projectId, lines] of this._pending) {
      for (const { level, message, ts } of lines) {
        try { this.onStream(projectId, level, message, ts); } catch {}
      }
    }
    this._pending.clear();
  }
}
