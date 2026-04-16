import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import squirrelStartup from 'electron-squirrel-startup';
if (squirrelStartup) app.quit();

import { ProjectManager } from '../core/project-manager/ProjectManager.js';
import { ConfigManager } from '../core/config-manager/ConfigManager.js';
import { ProcessManager } from '../core/process-manager/ProcessManager.js';
import { ExecutionManager } from '../core/execution-manager/ExecutionManager.js';
import { LogManager } from '../core/log-manager/LogManager.js';
import { TimeTracker } from '../core/time-tracker/TimeTracker.js';
import { EnvManager } from '../core/env-manager/EnvManager.js';
import { ProjectDetector } from '../core/project-detector/ProjectDetector.js';
import { IdeDetector } from '../core/ide-detector/IdeDetector.js';
import { GroupManager } from '../core/group-manager/GroupManager.js';
import { PortManager } from '../core/port-manager/PortManager.js';
import { GitService } from '../core/git-service/GitService.js';
import { getDb, closeDb } from '../core/db/database.js';
import { IPC_CHANNELS } from '../shared/constants/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow, dbPath, logsDir;
let projectManager, configManager, timeTracker, logManager, envManager;
let executionManager, projectDetector, ideDetector, groupManager, portManager, gitService;
const processManager = new ProcessManager();
const activeSessions = new Map();

// Git info cache: projectPath → { info, ts }
const gitCache = new Map();

function initializeApp() {
  const userData = app.getPath('userData');
  dbPath = path.join(userData, 'devignite.sqlite');
  logsDir = path.join(userData, 'logs');

  projectManager = new ProjectManager(dbPath);
  configManager = new ConfigManager(dbPath);
  timeTracker = new TimeTracker(dbPath);
  envManager = new EnvManager();
  projectDetector = new ProjectDetector();
  ideDetector = new IdeDetector();
  groupManager = new GroupManager(dbPath);
  portManager = new PortManager();
  gitService = new GitService();

  logManager = new LogManager(logsDir, (projectId, level, message, ts) => {
    mainWindow?.webContents.send(IPC_CHANNELS.LOG_STREAM, { projectId, level, message, ts });
  });

  executionManager = new ExecutionManager(
    logManager, timeTracker, envManager, processManager, ideDetector, portManager,
    (projectId, status, pid) => mainWindow?.webContents.send(IPC_CHANNELS.STATUS_UPDATE, { projectId, status, pid }),
    (projectId, sessionId, liveSecs) => mainWindow?.webContents.send(IPC_CHANNELS.TICK_UPDATE, { projectId, sessionId, liveSecs })
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 640,
    title: 'DevIgnite',
    frame: false,
    titleBarStyle: 'hidden',
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
  mainWindow.setMenu(null);
}

// ── Dialogs ───────────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:openFile', async (_, { filters } = {}) => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: filters || [] });
  return r.canceled ? null : r.filePaths[0];
});

// ── Window Controls ───────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

import { shell } from 'electron';

// ── Menu ──────────────────────────────────────────────────────────────────────
ipcMain.on('menu:popup', (event, menuName) => {
  const send = (channel) => mainWindow?.webContents.send(channel);
  const menus = {
    File: [
      { label: 'New Project', click: () => send('menu:new-project') },
      { label: 'New Workspace', click: () => send('menu:new-workspace') },
      { type: 'separator' },
      { label: 'Import Projects', click: () => send('menu:import-projects') },
      { label: 'Export Projects', click: () => send('menu:export-projects') },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() }
    ],
    Edit: [
      { label: 'Edit Project', click: () => send('menu:edit-project') },
      { label: 'Delete Project', click: () => send('menu:delete-project') },
      { label: 'Duplicate Project', click: () => send('menu:duplicate-project') },
      { type: 'separator' },
      { label: 'Open Settings', click: () => send('menu:open-settings') }
    ],
    View: [
      { label: 'Toggle Sidebar', click: () => send('menu:toggle-sidebar') },
      { label: 'Toggle Logs', click: () => send('menu:toggle-logs') },
      { label: 'Refresh Projects', click: () => send('menu:refresh-projects') },
      { type: 'separator' },
      { label: 'Toggle Fullscreen', click: () => send('menu:toggle-fullscreen') }
    ],
    Run: [
      { label: 'Start Work', click: () => send('menu:start-work') },
      { label: 'Stop Work', click: () => send('menu:stop-work') },
      { label: 'Start Workspace', click: () => send('menu:start-workspace') },
      { type: 'separator' },
      { label: 'Install Dependencies', click: () => send('menu:install-dependencies') }
    ],
    Tools: [
      { label: 'Kill Port', click: () => send('menu:kill-port') },
      { label: 'Open Folder', click: () => send('menu:open-folder') },
      { label: 'Open in IDE', click: () => send('menu:open-ide') },
      { type: 'separator' },
      { label: 'Clear Logs', click: () => send('menu:clear-logs') }
    ],
    Window: [
      { label: 'Minimize', click: () => mainWindow?.minimize() },
      {
        label: 'Maximize / Restore', click: () => {
          if (!mainWindow) return;
          if (mainWindow.isMaximized()) mainWindow.unmaximize();
          else mainWindow.maximize();
        }
      },
      { type: 'separator' },
      { label: 'Close', click: () => mainWindow?.close() }
    ],
    Help: [
      { label: 'About', click: () => send('menu:about') },
      { label: 'Open Logs Folder', click: () => send('menu:open-logs-folder') },
      { type: 'separator' },
      { label: 'Report Issue', click: () => shell.openExternal('https://github.com/vsmidhun21/DevIgnite/issues') },
      { label: 'Website', click: () => shell.openExternal('https://devignite.web.app/') }
    ]
  };

  if (menus[menuName]) {
    Menu.buildFromTemplate(menus[menuName]).popup({ window: mainWindow });
  }
});


// ── Projects ──────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, () => {
  const projects = projectManager.listAll();
  return projects.map(p => {
    const cached = gitCache.get(p.path);
    const gitInfo = cached && (Date.now() - cached.ts) < 10000
      ? cached.info
      : (() => { const info = gitService.getInfo(p.path); gitCache.set(p.path, { info, ts: Date.now() }); return info; })();
    return {
      ...p,
      status: processManager.getStatus(p.id),
      pid: processManager.getInfo(p.id)?.pid ?? null,
      uptimeMs: processManager.getInfo(p.id)?.uptimeMs ?? 0,
      sessionId: activeSessions.get(p.id) ?? null,
      todaySecs: timeTracker.getTodayTotal(p.id),
      git: gitInfo,
    };
  });
});
ipcMain.handle(IPC_CHANNELS.PROJECT_GET, (_, id) => projectManager.getById(id));
ipcMain.handle(IPC_CHANNELS.PROJECT_ADD, (_, data) => projectManager.add(data));
ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, (_, { id, data }) => projectManager.update(id, data));
ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, (_, id) => {
  if (processManager.isRunning(id)) {
    const sid = activeSessions.get(id);
    if (sid) executionManager.stopWork(projectManager.getById(id), sid);
  }
  activeSessions.delete(id);
  return projectManager.delete(id);
});
ipcMain.handle(IPC_CHANNELS.DETECT_PROJECT, (_, { projectPath }) => projectDetector.detect(projectPath));
ipcMain.handle(IPC_CHANNELS.VALIDATE_PROJECT, (_, projectId) => {
  const p = projectManager.getById(projectId);
  return p ? executionManager.validate(p) : { valid: false, errors: [{ field: 'id', message: 'Not found' }] };
});

// ── Work ──────────────────────────────────────────────────────────────────────
async function _doStart(projectId) {
  const project = projectManager.getById(projectId);
  if (!project) return { ok: false, error: 'Project not found' };
  if (processManager.isRunning(projectId)) return { ok: false, error: 'Already running' };

  // Port conflict check
  if (project.port) {
    const portResult = await portManager.checkBeforeLaunch(project.port, 'prompt');
    if (!portResult.ok && portResult.action === 'conflict') {
      // Push conflict event to renderer for UI prompt
      mainWindow?.webContents.send(IPC_CHANNELS.PORT_CONFLICT, {
        projectId, port: project.port, pid: portResult.pid,
      });
      return { ok: false, error: `Port ${project.port} in use (PID ${portResult.pid})`, portConflict: true, pid: portResult.pid };
    }
    // Auto-increment if requested
    if (portResult.action === 'incremented' && portResult.port !== project.port) {
      logManager.write(projectId, 'warn', `Port ${project.port} in use — using :${portResult.port}`);
    }
  }

  const sessionId = crypto.randomUUID();
  activeSessions.set(projectId, sessionId);
  const result = await executionManager.startWork(project, sessionId);
  if (!result.ok) activeSessions.delete(projectId);
  return result;
}

ipcMain.handle(IPC_CHANNELS.START_WORK, async (_, projectId) => _doStart(projectId));
ipcMain.handle(IPC_CHANNELS.STOP_WORK, (_, projectId) => {
  const sid = activeSessions.get(projectId);
  const p = projectManager.getById(projectId);
  if (!p) return { ok: false, error: 'Not found' };
  const result = executionManager.stopWork(p, sid || '');
  activeSessions.delete(projectId);
  return result;
});
ipcMain.handle(IPC_CHANNELS.RUN_ONLY, async (_, projectId) => {
  const p = projectManager.getById(projectId);
  if (!p) return { ok: false, error: 'Not found' };
  if (processManager.isRunning(projectId)) return { ok: false, error: 'Already running' };
  const sessionId = crypto.randomUUID();
  activeSessions.set(projectId, sessionId);
  const result = await executionManager.runOnly(p, sessionId);
  if (!result.ok) activeSessions.delete(projectId);
  return result;
});
ipcMain.handle(IPC_CHANNELS.OPEN_IDE, (_, id) => { const p = projectManager.getById(id); if (p) executionManager.openIDE(p); return { ok: !!p }; });
ipcMain.handle(IPC_CHANNELS.OPEN_TERMINAL, (_, id) => { const p = projectManager.getById(id); if (p) executionManager.openTerminal(p.path, p.id); return { ok: !!p }; });
ipcMain.handle(IPC_CHANNELS.OPEN_BROWSER, (_, id) => { const p = projectManager.getById(id); if (p && p.url) executionManager.openBrowser(p.url, p.id); return { ok: !!(p?.url) }; });

// ── Groups ────────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.GROUP_LIST, () => groupManager.listAll());
ipcMain.handle(IPC_CHANNELS.GROUP_GET, (_, id) => groupManager.getById(id));
ipcMain.handle(IPC_CHANNELS.GROUP_ADD, (_, data) => groupManager.add(data));
ipcMain.handle(IPC_CHANNELS.GROUP_UPDATE, (_, { id, data }) => groupManager.update(id, data));
ipcMain.handle(IPC_CHANNELS.GROUP_DELETE, (_, id) => groupManager.delete(id));
ipcMain.handle(IPC_CHANNELS.GROUP_ADD_PROJECT, (_, { groupId, projectId }) => groupManager.addProject(groupId, projectId));
ipcMain.handle(IPC_CHANNELS.GROUP_REMOVE_PROJECT, (_, { groupId, projectId }) => groupManager.removeProject(groupId, projectId));

ipcMain.handle(IPC_CHANNELS.GROUP_START, async (_, groupId) => {
  const group = groupManager.getById(groupId);
  if (!group) return { ok: false, error: 'Group not found' };
  const results = [];
  for (const projectId of group.projectIds) {
    const r = await _doStart(projectId);
    results.push({ projectId, ...r });
    if (r.ok) await new Promise(res => setTimeout(res, 400)); // stagger starts
  }
  return { ok: true, results };
});

ipcMain.handle(IPC_CHANNELS.GROUP_STOP, (_, groupId) => {
  const group = groupManager.getById(groupId);
  if (!group) return { ok: false, error: 'Group not found' };
  const results = group.projectIds.map(projectId => {
    const sid = activeSessions.get(projectId);
    const p = projectManager.getById(projectId);
    if (!p || !processManager.isRunning(projectId)) return { projectId, ok: false, reason: 'not running' };
    const result = executionManager.stopWork(p, sid || '');
    activeSessions.delete(projectId);
    return { projectId, ok: true, ...result };
  });
  return { ok: true, results };
});

// ── Port Manager ──────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.PORT_CHECK, async (_, { port, resolution }) =>
  portManager.checkBeforeLaunch(port, resolution || 'prompt')
);
ipcMain.handle(IPC_CHANNELS.PORT_KILL, (_, { port }) => portManager.killProcessOnPort(port));
ipcMain.handle(IPC_CHANNELS.PORT_SNAPSHOT, () => portManager.getListeningPorts());

// ── Git ───────────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.GIT_INFO, (_, { projectPath }) => {
  const info = gitService.getInfo(projectPath);
  gitCache.set(projectPath, { info, ts: Date.now() });
  return info;
});
ipcMain.handle(IPC_CHANNELS.GIT_INFO_BATCH, (_, { paths }) => gitService.getBatch(paths));

// ── Logs ──────────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.LOG_READ, (_, { projectId, which }) => logManager.readParsed(projectId, which || 'current'));
ipcMain.handle(IPC_CHANNELS.LOG_META, (_, projectId) => logManager.getMeta(projectId));
ipcMain.handle(IPC_CHANNELS.LOG_CLEAR, (_, projectId) => {
  logManager.clear(projectId);
  getDb(dbPath).prepare('DELETE FROM logs WHERE project_id=?').run(projectId);
  return { ok: true };
});

// ── Productivity ──────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.SESSION_HISTORY, (_, { projectId, limit }) => timeTracker.getHistory(projectId, limit || 20));
ipcMain.handle(IPC_CHANNELS.SESSION_TODAY, (_, projectId) => ({ seconds: timeTracker.getTodayTotal(projectId), formatted: timeTracker.formatDuration(timeTracker.getTodayTotal(projectId)) }));
ipcMain.handle(IPC_CHANNELS.SESSION_ALL_TIME, (_, projectId) => ({ seconds: timeTracker.getAllTimeTotal(projectId), formatted: timeTracker.formatDuration(timeTracker.getAllTimeTotal(projectId)) }));
ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_STATS, (_, { projectId }) => timeTracker.getProductivityStats(projectId || null));

// ── Env / Config / IDE ────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.ENV_DETECT, (_, { projectPath }) => envManager.detectEnvFiles(projectPath));
ipcMain.handle(IPC_CHANNELS.ENV_PARSE, (_, { projectPath, filename }) => envManager.parseEnvFile(path.join(projectPath, filename)));
ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (_, { projectId, env }) => configManager.getMergedConfig(projectManager.getById(projectId), env));
ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_, { projectId, env, overrides }) => { configManager.setEnvConfig(projectId, env, overrides); return { ok: true }; });
ipcMain.handle(IPC_CHANNELS.IDE_LIST, () => ideDetector.detect());
ipcMain.handle(IPC_CHANNELS.IDE_BROWSE, async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'], title: 'Select IDE executable',
    filters: [{ name: 'Executables', extensions: process.platform === 'win32' ? ['exe', 'cmd', 'bat'] : [] }, { name: 'All', extensions: ['*'] }],
  });
  return r.canceled ? null : r.filePaths[0];
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  initializeApp();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => {
  executionManager?.stopAllTicks();
  processManager.stopAll();
  logManager?.closeAll();
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});
