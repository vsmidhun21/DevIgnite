// core/task-manager/TaskManager.js
// Centralized job registry for all background commands (actions, docker, run-only).
// Each job runs independently, never blocks the UI, and has a clean lifecycle.

import { spawn } from 'child_process';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import os from 'os';
import { EventEmitter } from 'events';

const WIN = os.platform() === 'win32';

export const JOB_STATUS = {
  QUEUED:  'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED:  'failed',
  CANCELLED: 'cancelled',
};

/**
 * TaskManager — manages auxiliary background jobs with independent lifecycles.
 *
 * Events emitted:
 *   'job:update'  { job }   — whenever a job's status/pid changes
 *   'job:log'     { jobId, projectId, level, message, ts }
 */
export class TaskManager extends EventEmitter {
  constructor() {
    super();
    // Map<jobId, JobEntry>
    this._jobs = new Map();
    // Limit concurrent jobs to prevent runaway processes
    this._maxJobs = 20;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Enqueue and immediately start a background job.
   *
   * @param {object} opts
   * @param {string}   opts.projectId
   * @param {string}   opts.type        — e.g. 'action', 'docker', 'run-only', 'install'
   * @param {string}   opts.label       — human-readable name shown in status
   * @param {string}   opts.command     — shell command to run
   * @param {string}   opts.cwd         — working directory
   * @param {object}   [opts.env]       — process env (defaults to process.env)
   * @param {Function} [opts.onLog]     — optional per-job log callback (projectId, level, msg, ts)
   * @returns {string} jobId
   */
  run({ projectId, type, label, command, cwd, env, onLog }) {
    // Prune finished jobs if at capacity
    if (this._jobs.size >= this._maxJobs) this._pruneFinished();

    const jobId = randomUUID();
    const job = {
      jobId,
      projectId,
      type,
      label,
      command,
      status: JOB_STATUS.QUEUED,
      pid: null,
      startedAt: null,
      endedAt: null,
      exitCode: null,
      _proc: null,
      _timers: new Set(),
    };

    this._jobs.set(jobId, job);
    this._emit(job);

    // Start async — never blocks caller
    setImmediate(() => this._start(jobId, cwd, env || process.env, onLog));

    return jobId;
  }

  /**
   * Cancel a running or queued job.
   * @param {string} jobId
   * @returns {boolean} true if job was found and kill attempted
   */
  cancel(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) return false;
    if (job.status === JOB_STATUS.RUNNING) {
      this._killProc(job._proc, job.pid);
    }
    this._finalize(job, JOB_STATUS.CANCELLED, -1);
    return true;
  }

  /**
   * Cancel all jobs for a given projectId.
   */
  cancelAllForProject(projectId) {
    for (const job of this._jobs.values()) {
      if (job.projectId === projectId && job.status === JOB_STATUS.RUNNING) {
        this.cancel(job.jobId);
      }
    }
  }

  /**
   * Return serializable snapshot of all jobs (safe to send over IPC).
   */
  listJobs() {
    return [...this._jobs.values()].map(this._serialize);
  }

  /**
   * Return serializable snapshot for one project's jobs.
   */
  listJobsForProject(projectId) {
    return [...this._jobs.values()]
      .filter(j => j.projectId === projectId)
      .map(this._serialize);
  }

  /**
   * Clean up everything — call on app quit.
   */
  stopAll() {
    for (const job of this._jobs.values()) {
      if (job.status === JOB_STATUS.RUNNING) {
        this._killProc(job._proc, job.pid);
        this._clearTimers(job);
      }
    }
    this._jobs.clear();
    this.removeAllListeners();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _start(jobId, cwd, env, onLog) {
    const job = this._jobs.get(jobId);
    if (!job) return; // was cancelled before we started

    job.status   = JOB_STATUS.RUNNING;
    job.startedAt = new Date().toISOString();
    this._emit(job);

    let child;
    try {
      child = spawn(job.command, [], { cwd, env, shell: true, windowsHide: true });
    } catch (err) {
      this._log(job, 'error', `Spawn failed: ${err.message}`, onLog);
      this._finalize(job, JOB_STATUS.FAILED, -1);
      return;
    }

    job._proc = child;
    job.pid   = child.pid;
    this._emit(job);

    this._log(job, 'info', `[Job:${job.type}] ${job.label} started (PID ${child.pid})`, onLog);

    // ── stdout ────────────────────────────────────────────────────────
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) this._log(job, 'info', line, onLog);
    });

    // ── stderr ────────────────────────────────────────────────────────
    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) this._log(job, 'warn', line, onLog);
    });

    // ── error ─────────────────────────────────────────────────────────
    child.on('error', (err) => {
      this._log(job, 'error', `Process error: ${err.message}`, onLog);
      this._finalize(job, JOB_STATUS.FAILED, -1);
    });

    // ── close ─────────────────────────────────────────────────────────
    child.on('close', (code) => {
      const status = (code === 0 || code === null) ? JOB_STATUS.SUCCESS : JOB_STATUS.FAILED;
      this._log(job, status === JOB_STATUS.SUCCESS ? 'info' : 'warn',
        `[Job:${job.type}] ${job.label} exited (code ${code})`, onLog);
      this._finalize(job, status, code);
    });

    // ── Safety timeout: 30 min max per auxiliary job ──────────────────
    const tid = setTimeout(() => {
      if (job.status === JOB_STATUS.RUNNING) {
        this._log(job, 'warn', `[Job:${job.type}] Timeout — killing after 30 min`, onLog);
        this.cancel(jobId);
      }
    }, 30 * 60 * 1000);
    tid.unref?.(); // don't keep process alive for this
    job._timers.add(tid);
  }

  _finalize(job, status, exitCode) {
    if (job.status === JOB_STATUS.SUCCESS || job.status === JOB_STATUS.FAILED || job.status === JOB_STATUS.CANCELLED) return;
    job.status   = status;
    job.exitCode = exitCode;
    job.endedAt  = new Date().toISOString();
    job._proc    = null;
    this._clearTimers(job);
    this._emit(job);
    // Auto-prune very old completed jobs (keep last 50)
    this._pruneFinishedOld();
  }

  _killProc(proc, pid) {
    if (!proc && !pid) return;
    try {
      if (WIN && pid) {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      } else if (pid) {
        process.kill(-pid, 'SIGTERM');
      } else if (proc) {
        proc.kill();
      }
    } catch {
      try { proc?.kill(); } catch {}
    }
  }

  _clearTimers(job) {
    for (const t of job._timers) clearTimeout(t);
    job._timers.clear();
  }

  _log(job, level, message, onLog) {
    const ts = new Date().toISOString();
    // Emit on the EventEmitter for main.js to pipe to LogManager / IPC
    this.emit('job:log', { jobId: job.jobId, projectId: job.projectId, level, message, ts });
    // Also call per-job callback if provided
    onLog?.(job.projectId, level, message, ts);
  }

  _emit(job) {
    this.emit('job:update', { job: this._serialize(job) });
  }

  _serialize(job) {
    return {
      jobId:     job.jobId,
      projectId: job.projectId,
      type:      job.type,
      label:     job.label,
      command:   job.command,
      status:    job.status,
      pid:       job.pid,
      startedAt: job.startedAt,
      endedAt:   job.endedAt,
      exitCode:  job.exitCode,
    };
  }

  _pruneFinished() {
    for (const [id, job] of this._jobs) {
      if (job.status !== JOB_STATUS.RUNNING && job.status !== JOB_STATUS.QUEUED) {
        this._jobs.delete(id);
      }
    }
  }

  _pruneFinishedOld() {
    const finished = [...this._jobs.values()]
      .filter(j => j.status !== JOB_STATUS.RUNNING && j.status !== JOB_STATUS.QUEUED)
      .sort((a, b) => (a.endedAt || '') < (b.endedAt || '') ? -1 : 1);
    // Keep only last 50 finished
    const excess = finished.length - 50;
    if (excess > 0) {
      for (let i = 0; i < excess; i++) this._jobs.delete(finished[i].jobId);
    }
  }
}
