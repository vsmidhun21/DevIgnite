import { spawn, exec, execSync } from 'child_process';
import path   from 'path';
import fs     from 'fs';
import os     from 'os';
import { PROJECT_STATUS } from '../../shared/constants/index.js';

const WIN = process.platform === 'win32';

export class ExecutionManager {
  constructor(logManager, timeTracker, envManager, processManager, ideDetector, portManager, onStatus, onTick) {
    this.logManager     = logManager;
    this.timeTracker    = timeTracker;
    this.envManager     = envManager;
    this.processManager = processManager;
    this.ideDetector    = ideDetector;
    this.portManager    = portManager;
    this.onStatus       = onStatus || (() => {});
    this.onTick         = onTick   || (() => {});
    this._tickTimers    = new Map();
  }

  // ── START WORK ────────────────────────────────────────────────────────────
  async startWork(project, sessionId, options = { isPrimary: true }) {
    const isPrimary = options.isPrimary !== false;
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

    if (isPrimary) {
      this.timeTracker.start(project.id, sessionId, loadedFile);
      this._startTick(project.id, sessionId);
      this.onStatus(project.id, PROJECT_STATUS.STARTING, null);
      this.openIDE(project);
      if (project.open_terminal !== 0) this.openTerminal(cwd, project.id);
      this.launchExternalApps(project);
    }

    const steps = this._buildSteps(project);
    let mainChild = null;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.logManager.write(project.id, 'info', `── Step ${i + 1}/${steps.length}: ${step.label}`);
      this.logManager.write(project.id, 'info', `   $ ${step.cmd}`);
      if (step.wait) {
        try {
          await this._runWait(step.cmd, cwd, processEnv, project.id, { isPrimary });
          this.logManager.write(project.id, 'success', `   ✓ ${step.label}`);
        } catch (err) {
          this.logManager.write(project.id, 'error', `   ✗ ${step.label}: ${err.message}`);
          if (isPrimary) {
            this.onStatus(project.id, PROJECT_STATUS.ERROR, null);
            this.timeTracker.markError(sessionId);
            this._stopTick(project.id);
          }
          return { ok: false, error: err.message };
        }
      } else {
        mainChild = this._runBackground(step.cmd, cwd, processEnv, project.id, sessionId, project, { isPrimary });
      }
    }

    if (mainChild) {
      this.processManager.register(project.id, mainChild, sessionId, isPrimary);
    } else if (isPrimary) {
      this.onStatus(project.id, PROJECT_STATUS.RUNNING, null);
    }

    // Open browser after server starts
    if (isPrimary && project.open_browser !== 0) {
      const urlsToOpen = [];
      try {
        const parsed = JSON.parse(project.urls || '[]');
        if (Array.isArray(parsed) && parsed.length) urlsToOpen.push(...parsed);
      } catch {}
      if (!urlsToOpen.length && project.url) urlsToOpen.push(project.url);

      if (urlsToOpen.length) {
        const delay = mainChild ? 3000 : 500;
        urlsToOpen.forEach((u, i) => {
          setTimeout(() => this.openBrowser(u, project.id), delay + (i * 600));
        });
      }
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
  async runOnly(project, sessionId, options = { isPrimary: true }) {
    const isPrimary = options.isPrimary !== false;
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
          await this._runWait(step.cmd, cwd, processEnv, project.id, { isPrimary });
          this.logManager.write(project.id, 'success', `   ✓ ${step.label}`);
        } catch (err) {
          this.logManager.write(project.id, 'error', `   ✗ ${step.label}: ${err.message}`);
          if (isPrimary) {
            this.onStatus(project.id, PROJECT_STATUS.ERROR, null);
            this.timeTracker.markError(sessionId);
            this._stopTick(project.id);
          }
          return { ok: false, error: err.message };
        }
      } else {
        mainChild = this._runBackground(step.cmd, cwd, processEnv, project.id, sessionId, project, { isPrimary });
      }
    }

    if (mainChild) this.processManager.register(project.id, mainChild, sessionId, isPrimary);
    else if (isPrimary) this.onStatus(project.id, PROJECT_STATUS.RUNNING, null);

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

  // ── LAUNCH EXTERNAL APPS ─────────────────────────────────────────────────
  launchExternalApps(project) {
    let apps = [];
    try {
      apps = JSON.parse(project.externalApps || '[]');
    } catch {
      return;
    }
    if (!Array.isArray(apps) || !apps.length) return;

    for (const appPath of apps) {
      if (!appPath || !appPath.trim()) continue;
      const cmd = appPath.trim();
      this.logManager.write(project.id, 'info', `Launching external app: ${cmd}`);
      try {
        const child = spawn(cmd, [], {
          detached: true,
          stdio: 'ignore',
          shell: true,
          windowsHide: false // Usually want to see the app
        });
        child.unref();
      } catch (err) {
        this.logManager.write(project.id, 'warn', `Failed to launch app "${cmd}": ${err.message}`);
      }
    }
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
    
    const urls = [];
    try {
      const parsed = JSON.parse(project.urls || '[]');
      if (Array.isArray(parsed)) urls.push(...parsed);
    } catch {}
    if (!urls.length && project.url) urls.push(project.url);

    for (const u of urls) {
      try { new URL(u); } catch {
        errors.push({ field: 'url', message: `Invalid URL: ${u}` });
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

  _timersMap = new Map();

  _runWait(command, cwd, env, projectId, options = {}) {
    const isPrimary = options.isPrimary !== false;
    const jobId = options.jobId;
    const prefix = !isPrimary && jobId ? `[Job ${jobId.substring(0,6)}] ` : '';
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], { cwd, env, shell: true, windowsHide: true });
      child.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => this.logManager.write(projectId, 'info', prefix + '  ' + l)));
      child.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => this.logManager.write(projectId, 'warn', prefix + '  ' + l)));
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
      child.on('error', reject);
    });
  }

  _runBackground(command, cwd, env, projectId, sessionId, project, options = {}) {
    const isPrimary = options.isPrimary !== false;
    const jobId = options.jobId || sessionId;
    const prefix = !isPrimary ? `[Job ${jobId.substring(0,6)}] ` : '';
    const child = spawn(command, [], { cwd, env, shell: true, windowsHide: true });
    let isStarted = false;
    
    if (!this._timersMap.has(sessionId)) {
      this._timersMap.set(sessionId, new Set());
    }
    const sessionTimers = this._timersMap.get(sessionId);

    const markStarted = () => {
      if (isStarted) return;
      isStarted = true;
      if (isPrimary) {
        this.onStatus(projectId, PROJECT_STATUS.RUNNING, child.pid);
      }
      this.logManager.write(projectId, 'success', prefix + `${isPrimary ? 'Started' : 'Action started'} (PID ${child.pid})`);
    };

    const timeout = setTimeout(markStarted, 4000); // Generic 4s fallback
    sessionTimers.add(timeout);

    child.stdout.on('data', d => {
      d.toString().split('\n').filter(Boolean).forEach(l => {
        this.logManager.write(projectId, 'info', prefix + l);
        if (!isStarted && this._checkLogForStart(l)) {
          clearTimeout(timeout);
          sessionTimers.delete(timeout);
          markStarted();
        }
      });
    });

    child.stderr.on('data', d => {
      d.toString().split('\n').filter(Boolean).forEach(l => {
        this.logManager.write(projectId, 'warn', prefix + l);
        // Error logs can sometimes signal app start in some frameworks, but usually we prefer stdout
      });
    });

    let portCheck = null;
    if (project.port) {
      portCheck = setInterval(async () => {
        if (isStarted) {
          clearInterval(portCheck);
          sessionTimers.delete(portCheck);
          return;
        }
        try {
          if (await this.portManager.isPortInUse(project.port)) {
            clearTimeout(timeout);
            sessionTimers.delete(timeout);
            markStarted();
            clearInterval(portCheck);
            sessionTimers.delete(portCheck);
          }
        } catch {}
      }, 500);
      sessionTimers.add(portCheck);
    }

    const cleanup = () => {
      clearTimeout(timeout);
      sessionTimers.delete(timeout);
      if (portCheck) {
        clearInterval(portCheck);
        sessionTimers.delete(portCheck);
      }
      this._timersMap.delete(sessionId);
    };

    child.on('error', err => {
      cleanup();
      this.logManager.write(projectId, 'error', prefix + `Spawn error: ${err.message}`);
      if (isPrimary) {
        this.onStatus(projectId, PROJECT_STATUS.ERROR, null);
        this.timeTracker.markError(sessionId);
        this._stopTick(projectId);
      }
    });

    child.on('close', code => {
      cleanup();
      this.logManager.write(projectId, code === 0 ? 'info' : 'warn', prefix + `${isPrimary ? 'Process' : 'Action'} exited (code ${code})`);
      if (isPrimary && this.processManager.isRunning(projectId)) {
        this.onStatus(projectId, PROJECT_STATUS.STOPPED, null);
        this.timeTracker.stop(sessionId);
        this._stopTick(projectId);
        this.logManager.endSession(projectId);
      }
    });

    return child;
  }

  _checkLogForStart(line) {
    const l = line.toLowerCase();
    const patterns = [
      'started', 'tomcat started', // Spring
      'starting development server', 'system check identified', // Django
      'compiled', 'running at', 'listening on' // Node/React
    ];
    return patterns.some(p => l.includes(p));
  }

  _startTick(projectId, sessionId) {
    this._stopTick(projectId);
    this._tickTimers.set(projectId, setInterval(() => {
      this.onTick(projectId, sessionId, this.timeTracker.getLiveDuration(sessionId));
    }, 1000));
  }
  _stopTick(projectId) {
    if (this._tickTimers.has(projectId)) {
      const t = this._tickTimers.get(projectId);
      if (t) clearInterval(t);
      this._tickTimers.delete(projectId);
    }
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
