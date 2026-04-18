// core/process-manager/ProcessManager.js
// Tracks running child processes. Handles Windows-safe kill via taskkill.
import { execSync } from 'child_process';
import os from 'os';
import { PROJECT_STATUS } from '../../shared/constants/index.js';

// const { execSync } = require('child_process');
// const os = require('os');
// const { PROJECT_STATUS } = require('../../shared/constants');

export class ProcessManager {
  constructor() {
    // Primary process per project (e.g. dev server)
    // Map<projectId, { process, pid, startedAt, sessionId }>
    this._primary = new Map();
    // Auxiliary processes (e.g. build actions)
    // Map<projectId, Map<sessionId, { process, pid, startedAt, sessionId }>>
    this._auxiliary = new Map();
  }

  register(projectId, childProcess, sessionId, isPrimary = true) {
    const entry = {
      process: childProcess,
      pid: childProcess.pid,
      startedAt: new Date(),
      sessionId,
    };

    if (isPrimary) {
      this._primary.set(projectId, entry);
      childProcess.on('close', () => {
        // Only delete if it's the same session we registered
        const current = this._primary.get(projectId);
        if (current && current.sessionId === sessionId) {
          this._primary.delete(projectId);
        }
      });
    } else {
      if (!this._auxiliary.has(projectId)) {
        this._auxiliary.set(projectId, new Map());
      }
      this._auxiliary.get(projectId).set(sessionId, entry);
      childProcess.on('close', () => {
        const projectMap = this._auxiliary.get(projectId);
        if (projectMap) {
          projectMap.delete(sessionId);
        }
      });
    }
  }

  /**
   * Stop processes for a project.
   * kind: 'primary', 'auxiliary', or 'all'
   */
  stop(projectId, kind = 'primary') {
    const entries = [];
    if (kind === 'primary' || kind === 'all') {
      const p = this._primary.get(projectId);
      if (p) entries.push({ ...p, type: 'primary' });
    }
    if (kind === 'auxiliary' || kind === 'all') {
      const auxMap = this._auxiliary.get(projectId);
      if (auxMap) {
        for (const a of auxMap.values()) entries.push({ ...a, type: 'auxiliary' });
      }
    }

    if (entries.length === 0) return false;

    const isWindows = os.platform() === 'win32';

    for (const entry of entries) {
      const { process: proc, pid, sessionId, type } = entry;
      try {
        if (isWindows) {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        } else {
          process.kill(-pid, 'SIGTERM');
        }
      } catch {
        try { proc.kill(); } catch { }
      }

      if (type === 'primary') {
        this._primary.delete(projectId);
      } else {
        const auxMap = this._auxiliary.get(projectId);
        if (auxMap) auxMap.delete(sessionId);
      }
    }

    return true;
  }

  async restart(projectId, runFn) {
    this.stop(projectId, 'primary');
    await new Promise(resolve => setTimeout(resolve, 1500));
    runFn();
  }

  isRunning(projectId) { return this._primary.has(projectId); }

  getInfo(projectId) {
    const entry = this._primary.get(projectId);
    if (!entry) return null;
    return {
      pid: entry.pid,
      startedAt: entry.startedAt,
      sessionId: entry.sessionId,
      uptimeMs: Date.now() - entry.startedAt.getTime(),
    };
  }

  listRunning() { return [...this._primary.keys()]; }

  stopAll() {
    for (const id of [...this._primary.keys()]) this.stop(id, 'primary');
    for (const id of [...this._auxiliary.keys()]) this.stop(id, 'auxiliary');
  }

  getStatus(projectId) {
    return this.isRunning(projectId) ? PROJECT_STATUS.RUNNING : PROJECT_STATUS.STOPPED;
  }
}

// module.exports = ProcessManager;
