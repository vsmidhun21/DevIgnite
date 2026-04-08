// src/main.js — Electron main process (Electron Forge + Vite)
//
// This file uses ESM import syntax.
// Vite compiles it to CJS format (.vite/build/main.js) via rollup output.format:'cjs'
// Core modules are bundled inline — no runtime path resolution needed.

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path   from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// electron-squirrel-startup: handles Windows installer shortcuts
import squirrelStartup from 'electron-squirrel-startup';
if (squirrelStartup) app.quit();

// Core — Vite bundles all of these into the output .vite/build/main.js
import { ProjectManager }  from '../core/project-manager/ProjectManager.js';
import { ExecutionEngine } from '../core/execution-engine/ExecutionEngine.js';
import { ConfigManager }   from '../core/config-manager/ConfigManager.js';
import { ProcessManager }  from '../core/process-manager/ProcessManager.js';
import { getDb, closeDb }  from '../core/db/database.js';
import { IPC_CHANNELS }    from '../shared/constants/index.js';

// __dirname shim for ESM (needed before Vite compiles, harmless after)
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Global state ─────────────────────────────────────────────────────────────
let projectManager;
let executionEngine;
let configManager;
let dbPath;
const processManager = new ProcessManager();
const logEntries     = new Map();
let mainWindow;

// ─── Initialize core modules ──────────────────────────────────────────────────
function initializeApp() {
  dbPath = path.join(app.getPath('userData'), 'launcher.sqlite');

  executionEngine = new ExecutionEngine(
    (projectId, level, message) => {
      mainWindow?.webContents.send(IPC_CHANNELS.LOG_STREAM, {
        projectId, level, message, ts: new Date().toISOString(),
      });
      const entry = logEntries.get(projectId);
      if (entry) {
        try {
          getDb(dbPath)
            .prepare('INSERT INTO logs (project_id, level, message, session_id) VALUES (?,?,?,?)')
            .run(projectId, level, message, entry.sessionId);
        } catch {}
      }
    },
    (projectId, status, pid) => {
      mainWindow?.webContents.send(IPC_CHANNELS.STATUS_UPDATE, { projectId, status, pid });
    }
  );

  projectManager = new ProjectManager(dbPath);
  configManager  = new ConfigManager(dbPath);
}

// ─── Create window ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 780,
    minWidth: 900, minHeight: 600,
    icon: path.join(__dirname, '../../assets/icon.png'),
    title: 'Dev Project Launcher',
    webPreferences: {
      // Forge compiles preload.js to the same .vite/build/ directory
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  // MAIN_WINDOW_VITE_DEV_SERVER_URL:
  //   npm start  → "http://localhost:5173"  (truthy) → loadURL + DevTools
  //   npm make   → undefined               (falsy)  → loadFile, no DevTools
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
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

// ─── IPC: Projects ────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, () =>
  projectManager.listAll().map(p => ({
    ...p,
    status:   processManager.getStatus(p.id),
    pid:      processManager.getInfo(p.id)?.pid      ?? null,
    uptimeMs: processManager.getInfo(p.id)?.uptimeMs ?? 0,
  }))
);
ipcMain.handle(IPC_CHANNELS.PROJECT_GET,    (_, id)           => projectManager.getById(id));
ipcMain.handle(IPC_CHANNELS.PROJECT_ADD,    (_, data)         => projectManager.add(data));
ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, (_, { id, data }) => projectManager.update(id, data));
ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, (_, id) => {
  if (processManager.isRunning(id)) processManager.stop(id);
  return projectManager.delete(id);
});

// ─── IPC: Execution ───────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.PROJECT_RUN, async (_, projectId) => {
  const project   = projectManager.getById(projectId);
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
  const project   = projectManager.getById(projectId);
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
  getDb(dbPath).prepare('DELETE FROM logs WHERE project_id=?').run(projectId);
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
