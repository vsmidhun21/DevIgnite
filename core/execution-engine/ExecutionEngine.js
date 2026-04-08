// core/execution-engine/ExecutionEngine.js
// Runs startup step sequences, opens IDEs, manages child processes.
// Pure Node.js — no Electron dependency.

import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { PROJECT_STATUS } from '../../shared/constants/index.js';

// const { spawn, exec } = require('child_process');
// const path = require('path');
// const fs = require('fs');
// const os = require('os');
// const { PROJECT_STATUS } = require('../../shared/constants');

// Known IntelliJ launcher locations on Windows (checked in order)
const INTELLIJ_PATHS = [
  'idea64.exe', 'idea.exe', 'idea',               // if added to PATH
  'C:\\Program Files\\JetBrains\\IntelliJ IDEA\\bin\\idea64.exe',
  'C:\\Program Files\\JetBrains\\IntelliJ IDEA Community Edition\\bin\\idea64.exe',
  // Wildcard-style checked dynamically below
];

export class ExecutionEngine {
  constructor(onLog, onStatus) {
    this.onLog = onLog || (() => { });
    this.onStatus = onStatus || (() => { });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // run()
  // Executes a sequence of startup steps in order.
  // project.startup_steps = JSON array like:
  //   [
  //     { label: "Activate venv",  cmd: "venv\\Scripts\\activate.bat", wait: true  },
  //     { label: "Install deps",   cmd: "pip install -r requirements.txt", wait: true },
  //     { label: "Start server",   cmd: "python manage.py runserver", wait: false }
  //   ]
  // wait:true  = run and wait for exit (0) before next step
  // wait:false = run and keep alive (this is the main server process)
  //
  // If startup_steps is empty/null, falls back to project.command as a single step.
  // ─────────────────────────────────────────────────────────────────────────
  async run(project, envConfig = {}) {
    const cwd = project.path;
    const processEnv = {
      ...process.env,
      ...(envConfig.env_vars ? JSON.parse(envConfig.env_vars) : {}),
      PORT: String(envConfig.port || project.port || ''),
    };

    // Parse startup steps — auto-inject venv activation if Python project
    let steps = this._buildSteps(project, envConfig);

    this.onStatus(project.id, PROJECT_STATUS.STARTING, null);
    this.onLog(project.id, 'info', `Starting ${project.name} [${project.active_env || 'dev'}]`);
    this.onLog(project.id, 'info', `Directory: ${cwd}`);

    let mainChild = null;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.onLog(project.id, 'info', `── Step ${i + 1}/${steps.length}: ${step.label}`);
      this.onLog(project.id, 'info', `   $ ${step.cmd}`);

      if (step.wait) {
        // Blocking step — wait for exit code 0 before continuing
        try {
          await this._runWait(step.cmd, cwd, processEnv, project.id);
          this.onLog(project.id, 'success', `   ✓ ${step.label} completed`);
        } catch (err) {
          this.onLog(project.id, 'error', `   ✗ ${step.label} failed: ${err.message}`);
          this.onStatus(project.id, PROJECT_STATUS.ERROR, null);
          return null;
        }
      } else {
        // Non-blocking step — this is the long-running server
        mainChild = this._runBackground(step.cmd, cwd, processEnv, project.id);
      }
    }

    return mainChild;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // openIDE()
  // Tries multiple launcher strategies for IntelliJ (since 'idea .' often
  // doesn't work even when installed, due to how JetBrains sets up PATH).
  // ─────────────────────────────────────────────────────────────────────────
  openIDE(project) {
    const isWindows = os.platform() === 'win32';

    if (project.ide === 'VS Code') {
      this._execIDE(`code "${project.path}"`, project);
      return;
    }

    if (project.ide === 'IntelliJ IDEA' && isWindows) {
      const launcher = this._findIntelliJ();
      if (launcher) {
        this.onLog(project.id, 'info', `Opening IntelliJ IDEA: ${launcher}`);
        this._execIDE(`"${launcher}" "${project.path}"`, project);
      } else {
        this.onLog(project.id, 'error', 'IntelliJ IDEA not found.');
        this.onLog(project.id, 'info', 'Tried: PATH (idea64.exe), and common install folders.');
        this.onLog(project.id, 'info', 'Fix: Add IntelliJ bin\\ folder to Windows PATH, or set the launcher path in project settings.');
      }
      return;
    }

    // Other IDEs (WebStorm, PyCharm etc.)
    const ideMap = {
      'WebStorm': 'webstorm',
      'PyCharm': 'pycharm64',
      'Android Studio': 'studio64',
    };
    const bin = ideMap[project.ide] || 'code';
    this._execIDE(`${bin} "${project.path}"`, project);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build the ordered list of startup steps.
   * Auto-prepend venv activation for Python projects when venv is found.
   * Auto-handle mvnw/gradlew for Spring Boot.
   */
  _buildSteps(project, envConfig) {
    // If user defined explicit steps, use those
    let steps = [];
    try {
      const raw = project.startup_steps;
      if (raw && raw !== '[]' && raw !== 'null') {
        steps = JSON.parse(raw);
      }
    } catch { }

    if (steps.length > 0) return steps;

    // --- Auto-build from project.command ---
    const command = envConfig.command || project.command;
    const isWindows = os.platform() === 'win32';

    // Python: check for venv
    if (this._isPython(command)) {
      const venv = this._findVenv(project.path);
      if (venv) {
        const activateCmd = isWindows
          ? `"${path.join(venv, 'Scripts', 'activate.bat')}"`
          : `source "${path.join(venv, 'bin', 'activate')}"`;

        // On Windows we chain into one cmd.exe call so env persists
        if (isWindows) {
          return [{
            label: 'Activate venv & start server',
            cmd: `${activateCmd} && ${command}`,
            wait: false,
          }];
        } else {
          return [
            { label: 'Activate virtualenv', cmd: activateCmd, wait: true },
            { label: 'Start server', cmd: command, wait: false },
          ];
        }
      }
    }

    // Spring Boot: prefer mvnw/gradlew over mvn/gradle (no global install needed)
    if (this._isSpringBoot(command)) {
      const fixed = this._fixSpringBootCmd(command, project.path);
      return [{ label: 'Start Spring Boot', cmd: fixed, wait: false }];
    }

    // Default: single step
    return [{ label: 'Start', cmd: command, wait: false }];
  }

  /** Run a command and wait for it to finish (exit 0 = success) */
  _runWait(command, cwd, env, projectId) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        cwd, env, shell: true, windowsHide: true,
      });
      child.stdout.on('data', d =>
        d.toString().split('\n').filter(Boolean).forEach(l =>
          this.onLog(projectId, 'info', '   ' + l)));
      child.stderr.on('data', d =>
        d.toString().split('\n').filter(Boolean).forEach(l =>
          this.onLog(projectId, 'warn', '   ' + l)));
      child.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`exited with code ${code}`));
      });
      child.on('error', reject);
    });
  }

  /** Spawn the long-running background server process */
  _runBackground(command, cwd, env, projectId) {
    const child = spawn(command, [], {
      cwd, env,
      shell: true,
      windowsHide: true,
      // detached:false keeps it in our process group so taskkill can reach it
    });

    child.stdout.on('data', d =>
      d.toString().split('\n').filter(Boolean).forEach(l =>
        this.onLog(projectId, 'info', l)));
    child.stderr.on('data', d =>
      d.toString().split('\n').filter(Boolean).forEach(l =>
        this.onLog(projectId, 'warn', l)));

    child.on('spawn', () => {
      this.onLog(projectId, 'success', `Server started (PID ${child.pid})`);
      this.onStatus(projectId, PROJECT_STATUS.RUNNING, child.pid);
    });
    child.on('error', err => {
      this.onLog(projectId, 'error', `Failed to start: ${err.message}`);
      this.onStatus(projectId, PROJECT_STATUS.ERROR, null);
    });
    child.on('close', code => {
      this.onLog(projectId, code === 0 ? 'info' : 'warn',
        `Process exited (code ${code})`);
      this.onStatus(projectId, PROJECT_STATUS.STOPPED, null);
    });

    return child;
  }

  _execIDE(cmd, project) {
    this.onLog(project.id, 'info', `Running: ${cmd}`);
    exec(cmd, { cwd: project.path }, (err) => {
      if (err) {
        this.onLog(project.id, 'error', `IDE launch failed: ${err.message}`);
      }
    });
  }

  /** Find IntelliJ idea64.exe — checks PATH then common install dirs */
  _findIntelliJ() {
    const { execSync } = require('child_process');

    // 1. Check PATH first (works if user ticked "Add to PATH" during install)
    try {
      const where = execSync('where idea64.exe', { stdio: 'pipe' }).toString().trim().split('\n')[0];
      if (where && fs.existsSync(where.trim())) return where.trim();
    } catch { }
    try {
      const where = execSync('where idea.exe', { stdio: 'pipe' }).toString().trim().split('\n')[0];
      if (where && fs.existsSync(where.trim())) return where.trim();
    } catch { }

    // 2. Scan Program Files for JetBrains folder (handles any version)
    const bases = [
      'C:\\Program Files\\JetBrains',
      'C:\\Program Files (x86)\\JetBrains',
      path.join(os.homedir(), 'AppData', 'Local', 'JetBrains'),
    ];
    for (const base of bases) {
      if (!fs.existsSync(base)) continue;
      const dirs = fs.readdirSync(base).filter(d => d.startsWith('IntelliJ'));
      for (const dir of dirs) {
        const exe = path.join(base, dir, 'bin', 'idea64.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }

    return null;
  }

  /** Fix Spring Boot command: use mvnw/gradlew wrapper if present, fix run goal */
  _fixSpringBootCmd(command, projectPath) {
    const isWindows = os.platform() === 'win32';

    // Use wrapper scripts if they exist (no Maven/Gradle install needed)
    if (fs.existsSync(path.join(projectPath, 'mvnw'))) {
      const wrapper = isWindows ? '.\\mvnw.cmd' : './mvnw';
      // Replace 'mvn' with wrapper, and ensure correct goal
      return command
        .replace(/^mvn(\.exe)?\s+/, wrapper + ' ')
        .replace('springboot:run', 'spring-boot:run')
        .replace('spring-boot:ru$', 'spring-boot:run');  // typo fix
    }
    if (fs.existsSync(path.join(projectPath, 'gradlew'))) {
      const wrapper = isWindows ? '.\\gradlew.bat' : './gradlew';
      return command.replace(/^gradle(\.exe)?\s+/, wrapper + ' ');
    }

    // Fix common typo: springboot:run → spring-boot:run
    return command
      .replace('springboot:run', 'spring-boot:run')
      .replace('spring-boot:ru', 'spring-boot:run');
  }

  _isPython(cmd) {
    return /^python|^uvicorn|^flask|^gunicorn|^django-admin/.test(cmd);
  }

  _isSpringBoot(cmd) {
    return /mvn|gradle|mvnw|gradlew/.test(cmd);
  }

  _findVenv(projectPath) {
    for (const name of ['venv', '.venv', 'env', '.env']) {
      const candidate = path.join(projectPath, name);
      if (
        fs.existsSync(path.join(candidate, 'Scripts', 'python.exe')) ||
        fs.existsSync(path.join(candidate, 'bin', 'python'))
      ) return candidate;
    }
    return null;
  }
}

// module.exports = ExecutionEngine;
