// core/log-manager/LogManager.js
// File-based log storage: {userData}/logs/{projectId}/current.log + previous.log
// Streams lines to renderer via push callback.

import fs   from 'fs';
import path from 'path';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB cap per file

export class LogManager {
  /**
   * @param {string}   logsDir   - root logs directory e.g. {userData}/logs
   * @param {Function} onStream  - (projectId, level, message, ts) callback → pushed to renderer
   */
  constructor(logsDir, onStream) {
    this.logsDir  = logsDir;
    this.onStream = onStream || (() => {});
    this._streams = new Map(); // projectId → WriteStream
  }

  // ── Session lifecycle ───────────────────────────────────────────────────────

  /**
   * Call at the start of a new run.
   * Rotates current.log → previous.log, opens a fresh write stream.
   */
  startSession(projectId, sessionId) {
    this._closeStream(projectId);

    const dir = this._dir(projectId);
    fs.mkdirSync(dir, { recursive: true });

    const currentPath  = this._path(projectId, 'current');
    const previousPath = this._path(projectId, 'previous');

    // Rotate: current → previous
    if (fs.existsSync(currentPath)) {
      try { fs.renameSync(currentPath, previousPath); } catch {}
    }

    // Write session header
    const header = `=== Session ${sessionId} started at ${new Date().toISOString()} ===\n`;
    fs.writeFileSync(currentPath, header, 'utf8');

    // Open append stream for the session
    const stream = fs.createWriteStream(currentPath, { flags: 'a' });
    this._streams.set(projectId, stream);

    return currentPath;
  }

  /**
   * Call when a session ends.
   */
  endSession(projectId) {
    const stream = this._streams.get(projectId);
    if (stream) {
      const footer = `\n=== Session ended at ${new Date().toISOString()} ===\n`;
      stream.write(footer);
    }
    this._closeStream(projectId);
  }

  // ── Writing ─────────────────────────────────────────────────────────────────

  /**
   * Write one log line to file + push to renderer.
   */
  write(projectId, level, message, sessionId = null) {
    const ts   = new Date().toISOString();
    const line = `[${ts}] [${level.toUpperCase().padEnd(7)}] ${message}\n`;

    // Write to file
    const stream = this._streams.get(projectId);
    if (stream) {
      // Guard file size
      try {
        const stat = fs.statSync(this._path(projectId, 'current'));
        if (stat.size < MAX_FILE_BYTES) stream.write(line);
      } catch {
        stream.write(line);
      }
    }

    // Push to renderer in real-time
    this.onStream(projectId, level, message, ts);
  }

  // ── Reading ─────────────────────────────────────────────────────────────────

  /**
   * Read log file contents.
   * @param {number} projectId
   * @param {'current'|'previous'} which
   * @returns {string}
   */
  read(projectId, which = 'current') {
    const filePath = this._path(projectId, which);
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * Read and parse log file into structured lines.
   * @returns {{ ts: string, level: string, message: string }[]}
   */
  readParsed(projectId, which = 'current') {
    const raw  = this.read(projectId, which);
    const lines = [];

    for (const line of raw.split('\n')) {
      const m = line.match(/^\[(.+?)\] \[(\w+)\s*\] (.+)$/);
      if (m) {
        lines.push({ ts: m[1], level: m[2].toLowerCase(), message: m[3] });
      }
    }
    return lines;
  }

  /**
   * Clear both log files for a project.
   */
  clear(projectId) {
    this._closeStream(projectId);
    for (const which of ['current', 'previous']) {
      const p = this._path(projectId, which);
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    }
  }

  /**
   * Return metadata about available log files.
   */
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

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  closeAll() {
    for (const id of this._streams.keys()) {
      this._closeStream(id);
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _dir(projectId)         { return path.join(this.logsDir, String(projectId)); }
  _path(projectId, which) { return path.join(this._dir(projectId), `${which}.log`); }

  _closeStream(projectId) {
    const stream = this._streams.get(projectId);
    if (stream) {
      try { stream.end(); } catch {}
      this._streams.delete(projectId);
    }
  }
}
