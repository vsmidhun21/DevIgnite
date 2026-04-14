import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path   from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import squirrelStartup from 'electron-squirrel-startup';
if (squirrelStartup) app.quit();

import { ProjectManager }   from '../core/project-manager/ProjectManager.js';
import { ConfigManager }    from '../core/config-manager/ConfigManager.js';
import { ProcessManager }   from '../core/process-manager/ProcessManager.js';
import { ExecutionManager } from '../core/execution-manager/ExecutionManager.js';
import { LogManager }       from '../core/log-manager/LogManager.js';
import { TimeTracker }      from '../core/time-tracker/TimeTracker.js';
import { EnvManager }       from '../core/env-manager/EnvManager.js';
import { ProjectDetector }  from '../core/project-detector/ProjectDetector.js';
import { IdeDetector }      from '../core/ide-detector/IdeDetector.js';
import { getDb, closeDb }   from '../core/db/database.js';
import { IPC_CHANNELS }     from '../shared/constants/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

let mainWindow, dbPath, logsDir;
let projectManager, configManager, timeTracker, logManager, envManager;
let executionManager, projectDetector, ideDetector;
const processManager  = new ProcessManager();
const activeSessions  = new Map(); // projectId → sessionId

function initializeApp() {
  const userData  = app.getPath('userData');
  dbPath  = path.join(userData, 'devignite.sqlite');
  logsDir = path.join(userData, 'logs');

  projectManager  = new ProjectManager(dbPath);
  configManager   = new ConfigManager(dbPath);
  timeTracker     = new TimeTracker(dbPath);
  envManager      = new EnvManager();
  projectDetector = new ProjectDetector();
  ideDetector     = new IdeDetector();

  logManager = new LogManager(logsDir, (projectId, level, message, ts) => {
    mainWindow?.webContents.send(IPC_CHANNELS.LOG_STREAM, { projectId, level, message, ts });
  });

  executionManager = new ExecutionManager(
    logManager, timeTracker, envManager, processManager, ideDetector,
    (projectId, status, pid) => mainWindow?.webContents.send(IPC_CHANNELS.STATUS_UPDATE, { projectId, status, pid }),
    (projectId, sessionId, liveSecs) => mainWindow?.webContents.send(IPC_CHANNELS.TICK_UPDATE, { projectId, sessionId, liveSecs })
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 640,
    title: 'DevIgnite',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

// ── Dialog ────────────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Select project folder' });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:openFile', async (_, { filters }) => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: filters || [], title: 'Select executable' });
  return r.canceled ? null : r.filePaths[0];
});

// ── Projects ──────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, () =>
  projectManager.listAll().map(p => ({
    ...p,
    status:     processManager.getStatus(p.id),
    pid:        processManager.getInfo(p.id)?.pid      ?? null,
    uptimeMs:   processManager.getInfo(p.id)?.uptimeMs ?? 0,
    sessionId:  activeSessions.get(p.id) ?? null,
    todaySecs:  timeTracker.getTodayTotal(p.id),
  }))
);
ipcMain.handle(IPC_CHANNELS.PROJECT_GET,    (_, id)           => projectManager.getById(id));
ipcMain.handle(IPC_CHANNELS.PROJECT_ADD,    (_, data)         => projectManager.add(data));
ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, (_, { id, data }) => projectManager.update(id, data));
ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, (_, id) => {
  if (processManager.isRunning(id)) {
    const sid = activeSessions.get(id);
    if (sid) executionManager.stopWork(projectManager.getById(id), sid);
  }
  activeSessions.delete(id);
  return projectManager.delete(id);
});

// ── Detection & Validation ────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.DETECT_PROJECT, (_, { projectPath }) =>
  projectDetector.detect(projectPath)
);
ipcMain.handle(IPC_CHANNELS.VALIDATE_PROJECT, (_, projectId) => {
  const project = projectManager.getById(projectId);
  return project ? executionManager.validate(project) : { valid: false, errors: [{ field: 'id', message: 'Project not found' }] };
});
ipcMain.handle(IPC_CHANNELS.IDE_LIST, () => ideDetector.detect());
ipcMain.handle(IPC_CHANNELS.IDE_BROWSE, async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select IDE executable',
    filters: [
      { name: 'Executables', extensions: WIN_EXTS() },
      { name: 'All Files',   extensions: ['*'] },
    ],
  });
  return r.canceled ? null : r.filePaths[0];
});

// ── START / STOP WORK ─────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.START_WORK, async (_, projectId) => {
  const project = projectManager.getById(projectId);
  if (!project) return { ok: false, error: 'Project not found' };
  if (processManager.isRunning(projectId)) return { ok: false, error: 'Already running' };
  const sessionId = crypto.randomUUID();
  activeSessions.set(projectId, sessionId);
  const result = await executionManager.startWork(project, sessionId);
  if (!result.ok) activeSessions.delete(projectId);
  return result;
});
ipcMain.handle(IPC_CHANNELS.STOP_WORK, (_, projectId) => {
  const sessionId = activeSessions.get(projectId);
  const project   = projectManager.getById(projectId);
  if (!project) return { ok: false, error: 'Project not found' };
  const result = executionManager.stopWork(project, sessionId || '');
  activeSessions.delete(projectId);
  return result;
});

// ── RUN / IDE / TERMINAL / BROWSER (separate buttons) ─────────────────────────
ipcMain.handle(IPC_CHANNELS.RUN_ONLY, async (_, projectId) => {
  const project = projectManager.getById(projectId);
  if (!project) return { ok: false, error: 'Project not found' };
  if (processManager.isRunning(projectId)) return { ok: false, error: 'Already running' };
  const sessionId = crypto.randomUUID();
  activeSessions.set(projectId, sessionId);
  const result = await executionManager.runOnly(project, sessionId);
  if (!result.ok) activeSessions.delete(projectId);
  return result;
});
ipcMain.handle(IPC_CHANNELS.OPEN_IDE, (_, projectId) => {
  const project = projectManager.getById(projectId);
  if (!project) return { ok: false, error: 'Project not found' };
  executionManager.openIDE(project);
  return { ok: true };
});
ipcMain.handle(IPC_CHANNELS.OPEN_TERMINAL, (_, projectId) => {
  const project = projectManager.getById(projectId);
  if (!project) return { ok: false, error: 'Project not found' };
  executionManager.openTerminal(project.path, project.id);
  return { ok: true };
});
ipcMain.handle(IPC_CHANNELS.OPEN_BROWSER, (_, projectId) => {
  const project = projectManager.getById(projectId);
  if (!project || !project.url) return { ok: false, error: 'No URL configured' };
  executionManager.openBrowser(project.url, project.id);
  return { ok: true };
});

// ── Logs ──────────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.LOG_READ,  (_, { projectId, which }) => logManager.readParsed(projectId, which || 'current'));
ipcMain.handle(IPC_CHANNELS.LOG_META,  (_, projectId)            => logManager.getMeta(projectId));
ipcMain.handle(IPC_CHANNELS.LOG_CLEAR, (_, projectId) => {
  logManager.clear(projectId);
  getDb(dbPath).prepare('DELETE FROM logs WHERE project_id=?').run(projectId);
  return { ok: true };
});

// ── Time ──────────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.SESSION_HISTORY,  (_, { projectId, limit }) => timeTracker.getHistory(projectId, limit || 20));
ipcMain.handle(IPC_CHANNELS.SESSION_TODAY,    (_, projectId) => ({ seconds: timeTracker.getTodayTotal(projectId),   formatted: timeTracker.formatDuration(timeTracker.getTodayTotal(projectId))   }));
ipcMain.handle(IPC_CHANNELS.SESSION_ALL_TIME, (_, projectId) => ({ seconds: timeTracker.getAllTimeTotal(projectId), formatted: timeTracker.formatDuration(timeTracker.getAllTimeTotal(projectId)) }));

// ── Env ───────────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.ENV_DETECT, (_, { projectPath }) => envManager.detectEnvFiles(projectPath));
ipcMain.handle(IPC_CHANNELS.ENV_PARSE,  (_, { projectPath, filename }) => {
  const fp = path.join(projectPath, filename);
  return envManager.parseEnvFile(fp);
});

// ── Config ────────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (_, { projectId, env }) => configManager.getMergedConfig(projectManager.getById(projectId), env));
ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_, { projectId, env, overrides }) => { configManager.setEnvConfig(projectId, env, overrides); return { ok: true }; });

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => { initializeApp(); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { executionManager?.stopAllTicks(); processManager.stopAll(); logManager?.closeAll(); closeDb(); if (process.platform !== 'darwin') app.quit(); });

function WIN_EXTS() { return process.platform === 'win32' ? ['exe', 'cmd', 'bat'] : []; }
