import { spawn, exec, execSync } from 'child_process';
import path   from 'path';
import fs     from 'fs';
import os     from 'os';
import { PROJECT_STATUS } from '../../shared/constants/index.js';

const WIN = process.platform === 'win32';

export class ExecutionManager {
  constructor(logManager, timeTracker, envManager, processManager, ideDetector, onStatus, onTick) {
    this.logManager     = logManager;
    this.timeTracker    = timeTracker;
    this.envManager     = envManager;
    this.processManager = processManager;
    this.ideDetector    = ideDetector;
    this.onStatus       = onStatus || (() => {});
    this.onTick         = onTick   || (() => {});
    this._tickTimers    = new Map();
  }

  // ── START WORK ────────────────────────────────────────────────────────────
  async startWork(project, sessionId) {
    const cwd       = project.path;
    const activeEnv = project.active_env || 'dev';

    const { env: processEnv, loadedFile } = this.envManager.buildEnv(
      cwd, project.env_file || null, activeEnv,
    );
    if (project.port) processEnv.PORT = String(project.port);

    this.logManager.startSession(project.id, sessionId);
    this.logManager.write(project.id, 'info', `=== DevIgnite: Start Work ===`);
    this.logManager.write(project.id, 'info', `Project  : ${project.name}`);
    this.logManager.write(project.id, 'info', `Directory: ${cwd}`);
    this.logManager.write(project.id, 'info', `Env      : ${activeEnv}${loadedFile ? ` (${loadedFile})` : ' (no .env)'}`);

    this.timeTracker.start(project.id, sessionId, loadedFile);
    this._startTick(project.id, sessionId);
    this.onStatus(project.id, PROJECT_STATUS.STARTING, null);

    this.openIDE(project);

    if (project.open_terminal !== 0) this.openTerminal(cwd, project.id);

    const steps = this._buildSteps(project);
    let mainChild = null;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.logManager.write(project.id, 'info', `── Step ${i + 1}/${steps.length}: ${step.label}`);
      this.logManager.write(project.id, 'info', `   $ ${step.cmd}`);
      if (step.wait) {
        try {
          await this._runWait(step.cmd, cwd, processEnv, project.id);
          this.logManager.write(project.id, 'success', `   ✓ ${step.label}`);
        } catch (err) {
          this.logManager.write(project.id, 'error', `   ✗ ${step.label}: ${err.message}`);
          this.onStatus(project.id, PROJECT_STATUS.ERROR, null);
          this.timeTracker.markError(sessionId);
          this._stopTick(project.id);
          return { ok: false, error: err.message };
        }
      } else {
        mainChild = this._runBackground(step.cmd, cwd, processEnv, project.id, sessionId);
      }
    }

    if (mainChild) {
      this.processManager.register(project.id, mainChild, sessionId);
    } else {
      this.onStatus(project.id, PROJECT_STATUS.RUNNING, null);
    }

    // Open browser after server starts
    if (project.open_browser !== 0 && project.url) {
      const delay = mainChild ? 3000 : 500;
      setTimeout(() => this.openBrowser(project.url, project.id), delay);
    }

    return { ok: true, sessionId, loadedEnvFile: loadedFile };
  }

  // ── STOP WORK ─────────────────────────────────────────────────────────────
  stopWork(project, sessionId) {
    this.processManager.stop(project.id);
    const duration = this.timeTracker.stop(sessionId);
    this._stopTick(project.id);
    this.logManager.write(project.id, 'info',
      duration ? `=== Stopped. Duration: ${duration.formatted} ===` : `=== Session ended ===`
    );
    this.logManager.endSession(project.id);
    this.onStatus(project.id, PROJECT_STATUS.STOPPED, null);
    return { ok: true, duration };
  }

  // ── RUN ONLY (no IDE, no terminal, no browser) ────────────────────────────
  async runOnly(project, sessionId) {
    const cwd       = project.path;
    const activeEnv = project.active_env || 'dev';

    const { env: processEnv, loadedFile } = this.envManager.buildEnv(
      cwd, project.env_file || null, activeEnv,
    );
    if (project.port) processEnv.PORT = String(project.port);

    this.logManager.startSession(project.id, sessionId);
    this.logManager.write(project.id, 'info', `=== DevIgnite: Run ===`);
    this.logManager.write(project.id, 'info', `Env: ${activeEnv}${loadedFile ? ` (${loadedFile})` : ''}`);

    this.timeTracker.start(project.id, sessionId, loadedFile);
    this._startTick(project.id, sessionId);
    this.onStatus(project.id, PROJECT_STATUS.STARTING, null);

    const steps = this._buildSteps(project);
    let mainChild = null;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.logManager.write(project.id, 'info', `── Step ${i + 1}/${steps.length}: ${step.label}`);
      this.logManager.write(project.id, 'info', `   $ ${step.cmd}`);
      if (step.wait) {
        try {
          await this._runWait(step.cmd, cwd, processEnv, project.id);
          this.logManager.write(project.id, 'success', `   ✓ ${step.label}`);
        } catch (err) {
          this.logManager.write(project.id, 'error', `   ✗ ${step.label}: ${err.message}`);
          this.onStatus(project.id, PROJECT_STATUS.ERROR, null);
          this.timeTracker.markError(sessionId);
          this._stopTick(project.id);
          return { ok: false, error: err.message };
        }
      } else {
        mainChild = this._runBackground(step.cmd, cwd, processEnv, project.id, sessionId);
      }
    }

    if (mainChild) this.processManager.register(project.id, mainChild, sessionId);
    else           this.onStatus(project.id, PROJECT_STATUS.RUNNING, null);

    return { ok: true, sessionId };
  }

  // ── OPEN IDE ──────────────────────────────────────────────────────────────
  openIDE(project) {
    const ideId     = project.ide_id || this._ideNameToId(project.ide);
    const idePath   = project.ide_path || null;
    const cmd       = this.ideDetector.buildLaunchCmd(ideId, idePath, project.path);

    if (!cmd) {
      this.logManager.write(project.id, 'warn', `IDE not found: ${project.ide}. Install it or set a custom path.`);
      return;
    }
    this.logManager.write(project.id, 'info', `Opening IDE: ${cmd}`);
    exec(cmd, { cwd: project.path }, (err) => {
      if (err) this.logManager.write(project.id, 'warn', `IDE launch: ${err.message}`);
    });
  }

  // ── OPEN TERMINAL ─────────────────────────────────────────────────────────
  openTerminal(cwd, projectId) {
    if (WIN) {
      exec(`wt.exe -d "${cwd}"`, (err) => {
        if (err) exec(`start cmd.exe /K "cd /d ${cwd}"`, { shell: true });
      });
    } else if (process.platform === 'darwin') {
      exec(`open -a Terminal "${cwd}"`);
    } else {
      for (const t of ['gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm']) {
        try { execSync(`which ${t}`, { stdio: 'ignore' }); exec(`${t} --working-directory="${cwd}"`); return; } catch {}
      }
    }
    if (projectId) this.logManager.write(projectId, 'info', `Terminal opened at ${cwd}`);
  }

  // ── OPEN BROWSER ─────────────────────────────────────────────────────────
  openBrowser(url, projectId) {
    const cmd = WIN ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    if (projectId) this.logManager.write(projectId, 'info', `Opening browser: ${url}`);
    exec(cmd, (err) => {
      if (err && projectId) this.logManager.write(projectId, 'warn', `Browser: ${err.message}`);
    });
  }

  // ── VALIDATE ──────────────────────────────────────────────────────────────
  validate(project) {
    const errors = [];
    if (!project.path || !fs.existsSync(project.path)) {
      errors.push({ field: 'path', message: `Folder not found: ${project.path}` });
    }
    if (!project.command && !JSON.parse(project.startup_steps || '[]').length) {
      errors.push({ field: 'command', message: 'No run command or startup steps defined' });
    }
    if (project.url) {
      try { new URL(project.url); } catch {
        errors.push({ field: 'url', message: `Invalid URL: ${project.url}` });
      }
    }
    return { valid: errors.length === 0, errors };
  }

  stopAllTicks() {
    for (const id of this._tickTimers.keys()) this._stopTick(id);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _buildSteps(project) {
    let steps = [];
    try {
      const raw = project.startup_steps;
      if (raw && raw !== '[]') steps = JSON.parse(raw);
    } catch {}

    // If user has explicit steps, optionally prepend install step
    if (steps.length > 0) {
      if (project.install_deps) {
        const installCmd = this._getInstallCmd(project);
        if (installCmd && !steps.find(s => s.cmd === installCmd)) {
          steps = [{ label: 'Install dependencies', cmd: installCmd, wait: true }, ...steps];
        }
      }
      return steps;
    }

    const command = project.command;
    const isPy    = /^python|^uvicorn|^flask|^gunicorn/.test(command || '');

    if (isPy) {
      const venv = this._findVenv(project.path);
      if (venv) {
        if (WIN) return [{ label: 'Activate venv & run', cmd: `"${path.join(venv, 'Scripts', 'activate.bat')}" && ${command}`, wait: false }];
        return [
          { label: 'Activate venv', cmd: `source "${path.join(venv, 'bin', 'activate')}"`, wait: true },
          { label: 'Start server',  cmd: command, wait: false },
        ];
      }
    }

    if (/mvn|gradle|mvnw|gradlew/.test(command || '')) {
      return [{ label: 'Start', cmd: this._fixSpring(command, project.path), wait: false }];
    }

    return [{ label: 'Start', cmd: command, wait: false }];
  }

  _runWait(command, cwd, env, projectId) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], { cwd, env, shell: true, windowsHide: true });
      child.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => this.logManager.write(projectId, 'info', '  ' + l)));
      child.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => this.logManager.write(projectId, 'warn', '  ' + l)));
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
      child.on('error', reject);
    });
  }

  _runBackground(command, cwd, env, projectId, sessionId) {
    const child = spawn(command, [], { cwd, env, shell: true, windowsHide: true });
    child.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => this.logManager.write(projectId, 'info', l)));
    child.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => this.logManager.write(projectId, 'warn', l)));
    child.on('spawn', () => {
      this.logManager.write(projectId, 'success', `Started (PID ${child.pid})`);
      this.onStatus(projectId, PROJECT_STATUS.RUNNING, child.pid);
    });
    child.on('error', err => {
      this.logManager.write(projectId, 'error', `Spawn error: ${err.message}`);
      this.onStatus(projectId, PROJECT_STATUS.ERROR, null);
      this.timeTracker.markError(sessionId);
      this._stopTick(projectId);
    });
    child.on('close', code => {
      this.logManager.write(projectId, code === 0 ? 'info' : 'warn', `Exited (code ${code})`);
      if (this.processManager.isRunning(projectId)) {
        this.onStatus(projectId, PROJECT_STATUS.STOPPED, null);
        this.timeTracker.stop(sessionId);
        this._stopTick(projectId);
        this.logManager.endSession(projectId);
      }
    });
    return child;
  }

  _startTick(projectId, sessionId) {
    this._stopTick(projectId);
    this._tickTimers.set(projectId, setInterval(() => {
      this.onTick(projectId, sessionId, this.timeTracker.getLiveDuration(sessionId));
    }, 1000));
  }
  _stopTick(projectId) {
    const t = this._tickTimers.get(projectId);
    if (t) { clearInterval(t); this._tickTimers.delete(projectId); }
  }

  _getInstallCmd(project) {
    const type = (project.type || '').toLowerCase();
    if (['django','flask','fastapi','python'].some(t => type.includes(t))) return 'pip install -r requirements.txt';
    if (['react','next','angular','vue','nuxt','node'].some(t => type.includes(t))) return 'npm install';
    if (type.includes('spring')) return 'mvn install -DskipTests';
    if (type.includes('laravel')) return 'composer install';
    // Auto-detect from project files
    if (fs.existsSync(path.join(project.path, 'requirements.txt'))) return 'pip install -r requirements.txt';
    if (fs.existsSync(path.join(project.path, 'package.json')))     return 'npm install';
    if (fs.existsSync(path.join(project.path, 'pom.xml')))          return 'mvn install -DskipTests';
    if (fs.existsSync(path.join(project.path, 'composer.json')))    return 'composer install';
    return null;
  }

  _findVenv(projectPath) {
    for (const name of ['venv', '.venv', 'env']) {
      const c = path.join(projectPath, name);
      if (fs.existsSync(path.join(c, 'Scripts', 'python.exe')) || fs.existsSync(path.join(c, 'bin', 'python'))) return c;
    }
    return null;
  }
  _fixSpring(cmd, projectPath) {
    if (fs.existsSync(path.join(projectPath, 'mvnw')))
      return cmd.replace(/^mvn(\\.exe)?\s+/, (WIN ? '.\\mvnw.cmd' : './mvnw') + ' ').replace('springboot:run', 'spring-boot:run');
    if (fs.existsSync(path.join(projectPath, 'gradlew')))
      return cmd.replace(/^gradle(\\.exe)?\s+/, (WIN ? '.\\gradlew.bat' : './gradlew') + ' ');
    return cmd.replace('springboot:run', 'spring-boot:run');
  }
  _ideNameToId(name) {
    const map = { 'VS Code': 'vscode', 'Cursor': 'cursor', 'Windsurf': 'windsurf',
      'IntelliJ IDEA': 'intellij', 'PyCharm': 'pycharm', 'WebStorm': 'webstorm',
      'Rider': 'rider', 'Sublime Text': 'sublime', 'Zed': 'zed', 'Vim': 'vim' };
    return map[name] || 'vscode';
  }
}
