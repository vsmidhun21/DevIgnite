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
    // Map<projectId, { process, pid, startedAt, sessionId }>
    this._running = new Map();
  }

  register(projectId, childProcess, sessionId) {
    this._running.set(projectId, {
      process: childProcess,
      pid: childProcess.pid,
      startedAt: new Date(),
      sessionId,
    });
    childProcess.on('close', () => {
      this._running.delete(projectId);
    });
  }

  /**
   * Stop a running project.
   * On Windows, SIGTERM doesn't propagate to child processes spawned by cmd.exe.
   * We use taskkill /F /T which kills the entire process tree.
   */
  stop(projectId) {
    const entry = this._running.get(projectId);
    if (!entry) return false;

    const { process: proc, pid } = entry;
    const isWindows = os.platform() === 'win32';

    try {
      if (isWindows) {
        // /F = force, /T = kill entire process tree (children too)
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      } else {
        // Kill the process group on Unix
        process.kill(-pid, 'SIGTERM');
      }
    } catch {
      // Process already gone — still clean up our map
      try { proc.kill(); } catch { }
    }

    this._running.delete(projectId);
    return true;
  }

  async restart(projectId, runFn) {
    this.stop(projectId);
    await new Promise(resolve => setTimeout(resolve, 1500));
    runFn();
  }

  isRunning(projectId) { return this._running.has(projectId); }

  getInfo(projectId) {
    const entry = this._running.get(projectId);
    if (!entry) return null;
    return {
      pid: entry.pid,
      startedAt: entry.startedAt,
      sessionId: entry.sessionId,
      uptimeMs: Date.now() - entry.startedAt.getTime(),
    };
  }

  listRunning() { return [...this._running.keys()]; }

  stopAll() {
    for (const id of [...this._running.keys()]) this.stop(id);
  }

  getStatus(projectId) {
    return this.isRunning(projectId) ? PROJECT_STATUS.RUNNING : PROJECT_STATUS.STOPPED;
  }
}

// module.exports = ProcessManager;
