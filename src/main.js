// src/main.js — Electron main process (Electron Forge + Vite)
//
// HOW BUNDLING WORKS HERE
// ─────────────────────────────────────────────────────────────────────────────
// Vite compiles this file + core/ + shared/ into one .vite/build/main.js bundle.
// Only 'better-sqlite3' stays external (native .node file, can't be bundled).
// Result: zero path-resolution differences between dev and prod. ✓
// ─────────────────────────────────────────────────────────────────────────────

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url'

import { ProjectManager } from '../core/project-manager/ProjectManager.js'
import { ExecutionEngine } from '../core/execution-engine/ExecutionEngine.js'
import { ConfigManager } from '../core/config-manager/ConfigManager.js'
import { ProcessManager } from '../core/process-manager/ProcessManager.js'
import { getDb, closeDb } from '../core/db/database.js';
import { IPC_CHANNELS } from '../shared/constants/index.js';
import squirrelStartup from 'electron-squirrel-startup';

// import preload from './preload.js';  // Vite compiles this to .vite/build/preload.js, same folder as main.js, so we can use a relative path here without needing __dirname

if (squirrelStartup) {
  app.quit()
}


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── Global state ─────────────────────────────────────────────────────────────
let projectManager;
let executionEngine;
let configManager;
let dbPath;
const processManager = new ProcessManager();
const logEntries = new Map();
let mainWindow;
const iconPath = path.join(__dirname, '../assets/icon.png')

// ─── Initialize core modules ──────────────────────────────────────────────────
function initializeApp() {
  // userData = %APPDATA%\dev-prj-launcher  (Windows)
  dbPath = path.join(app.getPath('userData'), 'launcher.sqlite');

  executionEngine = new ExecutionEngine(
    // onLog: stream log lines to renderer in real-time
    (projectId, level, message) => {
      mainWindow?.webContents.send(IPC_CHANNELS.LOG_STREAM, {
        projectId, level, message, ts: new Date().toISOString(),
      });
      // Also persist to SQLite
      const entry = logEntries.get(projectId);
      if (entry) {
        try {
          getDb(dbPath)
            .prepare('INSERT INTO logs (project_id, level, message, session_id) VALUES (?,?,?,?)')
            .run(projectId, level, message, entry.sessionId);
        } catch { }
      }
    },
    // onStatus: push running/stopped/error status to renderer
    (projectId, status, pid) => {
      mainWindow?.webContents.send(IPC_CHANNELS.STATUS_UPDATE, { projectId, status, pid });
    }
  );

  projectManager = new ProjectManager(dbPath);
  configManager = new ConfigManager(dbPath);
}

// ─── Create window ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 780,
    minWidth: 900, minHeight: 600,
    // __dirname here = .vite/build/ (dev) or app.asar/.vite/build/ (prod)
    // assets/ is at project root — go up two levels from .vite/build/
    icon: iconPath,
    title: 'Dev Project Launcher',
    webPreferences: {
      // Forge compiles preload.js to the same .vite/build/ folder as main.js
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,   // required: lets preload use require('electron')
    },
  });

  // MAIN_WINDOW_VITE_DEV_SERVER_URL — injected by Forge in dev (points to Vite dev server)
  // MAIN_WINDOW_VITE_NAME           — injected by Forge ('main_window')
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();   // DevTools only in dev
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
    // No DevTools in production
  }
}

// ─── IPC: Folder picker ───────────────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select project folder',
  });
  return result.canceled ? null : result.filePaths[0];
});

// ─── IPC: Projects CRUD ───────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, () =>
  projectManager.listAll().map(p => ({
    ...p,
    status: processManager.getStatus(p.id),
    pid: processManager.getInfo(p.id)?.pid ?? null,
    uptimeMs: processManager.getInfo(p.id)?.uptimeMs ?? 0,
  }))
);
ipcMain.handle(IPC_CHANNELS.PROJECT_GET, (_, id) => projectManager.getById(id));
ipcMain.handle(IPC_CHANNELS.PROJECT_ADD, (_, data) => projectManager.add(data));
ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, (_, { id, data }) => projectManager.update(id, data));
ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, (_, id) => {
  if (processManager.isRunning(id)) processManager.stop(id);
  return projectManager.delete(id);
});

// ─── IPC: Execution ───────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.PROJECT_RUN, async (_, projectId) => {
  const project = projectManager.getById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const envConfig = configManager.getMergedConfig(project, project.active_env);
  const sessionId = crypto.randomUUID();
  logEntries.set(projectId, { sessionId });
  const child = await executionEngine.run(project, envConfig);
  if (child) processManager.register(projectId, child, sessionId);
  return { ok: true };
});

ipcMain.handle(IPC_CHANNELS.PROJECT_STOP, (_, projectId) => {
  logEntries.delete(projectId);
  return { ok: processManager.stop(projectId) };
});

ipcMain.handle(IPC_CHANNELS.PROJECT_RESTART, async (_, projectId) => {
  const project = projectManager.getById(projectId);
  const envConfig = configManager.getMergedConfig(project, project.active_env);
  const sessionId = crypto.randomUUID();
  await processManager.restart(projectId, async () => {
    logEntries.set(projectId, { sessionId });
    const child = await executionEngine.run(project, envConfig);
    if (child) processManager.register(projectId, child, sessionId);
  });
  return { ok: true };
});

ipcMain.handle(IPC_CHANNELS.IDE_OPEN, (_, projectId) => {
  const project = projectManager.getById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  executionEngine.openIDE(project);
  return { ok: true };
});

// ─── IPC: Config & Logs ───────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (_, { projectId, env }) =>
  configManager.getMergedConfig(projectManager.getById(projectId), env)
);
ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_, { projectId, env, overrides }) => {
  configManager.setEnvConfig(projectId, env, overrides);
  return { ok: true };
});
ipcMain.handle(IPC_CHANNELS.LOG_CLEAR, (_, projectId) => {
  getDb(dbPath)
    .prepare('DELETE FROM logs WHERE project_id=?')
    .run(projectId);
  return { ok: true };
});

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  initializeApp();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  processManager.stopAll();
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});
