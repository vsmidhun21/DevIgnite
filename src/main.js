import { app, BrowserWindow, ipcMain, dialog, Menu, shell, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import squirrelStartup from 'electron-squirrel-startup';
if (squirrelStartup) app.quit();
import { Updater } from './updater.js';

import { ProjectManager } from '../core/project-manager/ProjectManager.js';
import { ConfigManager } from '../core/config-manager/ConfigManager.js';
import { ProcessManager } from '../core/process-manager/ProcessManager.js';
import { ExecutionManager } from '../core/execution-manager/ExecutionManager.js';
import { LogManager } from '../core/log-manager/LogManager.js';
import { TaskManager } from '../core/task-manager/TaskManager.js';
import { TimeTracker } from '../core/time-tracker/TimeTracker.js';
import { EnvManager } from '../core/env-manager/EnvManager.js';
import { ProjectDetector } from '../core/project-detector/ProjectDetector.js';
import { IdeDetector } from '../core/ide-detector/IdeDetector.js';
import { GroupManager } from '../core/group-manager/GroupManager.js';
import { PortManager } from '../core/port-manager/PortManager.js';
import { GitService } from '../core/git-service/GitService.js';
import { NotesTodosManager } from '../core/notes-todos/NotesTodosManager.js';
import { ActionManager } from '../core/action-manager/index.js';
import { SettingsManager } from '../core/settings-manager/SettingsManager.js';
import { CodeHealthManager } from '../core/code-health/index.js';
import { BriefingService } from '../core/briefing-service/BriefingService.js';
import { getDb, closeDb } from '../core/db/database.js';
import { IPC_CHANNELS, PROJECT_STATUS } from '../shared/constants/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow, dbPath, logsDir;
let updater;
let projectManager, configManager, timeTracker, logManager, envManager, settingsManager;
let executionManager, projectDetector, ideDetector, groupManager, portManager, gitService, notesTodosManager, actionManager, taskManager, codeHealthManager, briefingService;
const processManager = new ProcessManager();
const activeSessions = new Map();

// Git info cache: projectPath → { info, ts }
const gitCache = new Map();

const PROJECT_EXPORT_SCHEMA_VERSION = 1;
const IMPORTED_GROUP_SUFFIX = ' (Imported)';

function normalizeProjectPath(projectPath) {
  if (typeof projectPath !== 'string' || !projectPath.trim()) return '';
  let normalized = path.resolve(projectPath.trim()).replace(/[\\/]+$/, '');
  if (process.platform === 'win32') normalized = normalized.toLowerCase();
  return normalized;
}

function parseJsonValue(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseEnvVars(envVars) {
  if (envVars && typeof envVars === 'object' && !Array.isArray(envVars)) return envVars;
  return parseJsonValue(envVars, {});
}

function getStoredActions(projectId) {
  return actionManager.db
    .prepare('SELECT name, command FROM actions WHERE projectId = ? ORDER BY id ASC')
    .all(projectId);
}

function buildExportPayload() {
  const projects = projectManager.listAll();
  const projectsById = new Map(projects.map((project) => [project.id, project]));

  return {
    app: 'DevIgnite',
    schemaVersion: PROJECT_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tags: settingsManager.getCustomTags(),
    projects: projects.map((project) => ({
      name: project.name,
      path: project.path,
      type: project.type,
      archived: !!project.archived,
      isPinned: !!project.isPinned,
      command: project.command,
      ide: project.ide,
      ide_path: project.ide_path,
      port: project.port ?? null,
      url: project.url ?? null,
      active_env: project.active_env ?? 'dev',
      env_file: project.env_file ?? null,
      startup_steps: parseJsonValue(project.startup_steps, []),
      open_terminal: !!project.open_terminal,
      open_browser: !!project.open_browser,
      install_deps: !!project.install_deps,
      tag: project.tag ?? null,
      urls: parseJsonValue(project.urls, []),
      externalApps: parseJsonValue(project.externalApps, []),
      environments: configManager.listEnvs(project.id).map((env) => ({
        name: env.name,
        command: env.command ?? null,
        port: env.port ?? null,
        env_vars: parseEnvVars(env.env_vars),
      })),
      actions: getStoredActions(project.id).map((action) => ({
        name: action.name,
        command: action.command,
      })),
    })),
    groups: groupManager.listAll().map((group) => ({
      name: group.name,
      color: group.color,
      isPinned: !!group.isPinned,
      projectPaths: group.projectIds
        .map((projectId) => projectsById.get(projectId)?.path)
        .filter(Boolean),
    })),
  };
}

function validateImportPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Import file must contain a JSON object.');
  }
  if (!Array.isArray(payload.projects)) {
    throw new Error('Import file is missing a valid "projects" array.');
  }
  if (payload.groups != null && !Array.isArray(payload.groups)) {
    throw new Error('Import file has an invalid "groups" section.');
  }
  if (payload.tags != null && !Array.isArray(payload.tags)) {
    throw new Error('Import file has an invalid "tags" section.');
  }

  payload.projects.forEach((project, index) => {
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      throw new Error(`Project #${index + 1} is invalid.`);
    }
    if (typeof project.name !== 'string' || !project.name.trim()) {
      throw new Error(`Project #${index + 1} is missing a name.`);
    }
    if (typeof project.path !== 'string' || !project.path.trim()) {
      throw new Error(`Project #${index + 1} is missing a path.`);
    }
    if (project.environments != null && !Array.isArray(project.environments)) {
      throw new Error(`Project "${project.name}" has an invalid environments list.`);
    }
    if (project.actions != null && !Array.isArray(project.actions)) {
      throw new Error(`Project "${project.name}" has an invalid actions list.`);
    }
  });

  (payload.groups || []).forEach((group, index) => {
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      throw new Error(`Workspace #${index + 1} is invalid.`);
    }
    if (typeof group.name !== 'string' || !group.name.trim()) {
      throw new Error(`Workspace #${index + 1} is missing a name.`);
    }
    if (group.projectPaths != null && !Array.isArray(group.projectPaths)) {
      throw new Error(`Workspace "${group.name}" has an invalid projectPaths list.`);
    }
  });
}

function getImportedGroupName(name, existingNames) {
  const trimmedName = typeof name === 'string' && name.trim() ? name.trim() : 'Imported Workspace';
  if (!existingNames.has(trimmedName)) {
    existingNames.add(trimmedName);
    return { name: trimmedName, renamed: false };
  }

  let counter = 1;
  let candidate = `${trimmedName}${IMPORTED_GROUP_SUFFIX}`;
  while (existingNames.has(candidate)) {
    counter += 1;
    candidate = `${trimmedName}${IMPORTED_GROUP_SUFFIX} ${counter}`;
  }
  existingNames.add(candidate);
  return { name: candidate, renamed: true };
}

function importProjectPayload(payload) {
  validateImportPayload(payload);

  const db = getDb(dbPath);
  const importTransaction = db.transaction((data) => {
    const pathToProjectId = new Map(
      projectManager.listAll().map((project) => [normalizeProjectPath(project.path), project.id])
    );
    const existingGroupNames = new Set(groupManager.listAll().map((group) => group.name));
    const existingTags = new Set(settingsManager.getCustomTags().map((tag) => tag.trim()).filter(Boolean));
    const summary = {
      importedProjects: 0,
      skippedProjects: 0,
      importedGroups: 0,
      renamedGroups: 0,
      importedTags: 0,
      importedActions: 0,
      importedEnvironments: 0,
    };

    for (const rawTag of data.tags || []) {
      if (typeof rawTag !== 'string') continue;
      const tag = rawTag.trim();
      if (!tag || existingTags.has(tag)) continue;
      settingsManager.addCustomTag(tag);
      existingTags.add(tag);
      summary.importedTags += 1;
    }

    for (const project of data.projects) {
      const normalizedPath = normalizeProjectPath(project.path);
      if (!normalizedPath || pathToProjectId.has(normalizedPath)) {
        summary.skippedProjects += 1;
        continue;
      }

      if (typeof project.tag === 'string') {
        const tag = project.tag.trim();
        if (tag && !existingTags.has(tag)) {
          settingsManager.addCustomTag(tag);
          existingTags.add(tag);
          summary.importedTags += 1;
        }
      }

      const created = projectManager.add({
        name: project.name,
        path: project.path,
        type: project.type ?? 'Custom',
        archived: !!project.archived,
        command: project.command ?? '',
        ide: project.ide ?? 'VS Code',
        ide_path: project.ide_path ?? null,
        port: project.port ?? null,
        url: project.url ?? null,
        active_env: project.active_env ?? 'dev',
        env_file: project.env_file ?? null,
        startup_steps: Array.isArray(project.startup_steps)
          ? project.startup_steps
          : parseJsonValue(project.startup_steps, []),
        open_terminal: project.open_terminal ?? true,
        open_browser: project.open_browser ?? true,
        install_deps: !!project.install_deps,
        tag: project.tag ?? null,
        urls: Array.isArray(project.urls) ? project.urls : parseJsonValue(project.urls, []),
        externalApps: Array.isArray(project.externalApps) ? project.externalApps : parseJsonValue(project.externalApps, []),
      });

      const projectId = Number(created.id);
      pathToProjectId.set(normalizedPath, projectId);
      summary.importedProjects += 1;

      if (project.isPinned) {
        projectManager.togglePin(projectId);
      }

      for (const env of project.environments || []) {
        if (typeof env?.name !== 'string' || !env.name.trim()) continue;
        configManager.setEnvConfig(projectId, env.name, {
          command: env.command ?? null,
          port: env.port ?? null,
          env_vars: parseEnvVars(env.env_vars),
        });
        summary.importedEnvironments += 1;
      }

      for (const action of project.actions || []) {
        if (typeof action?.name !== 'string' || !action.name.trim()) continue;
        if (typeof action?.command !== 'string' || !action.command.trim()) continue;
        actionManager.addAction(projectId, action.name.trim(), action.command);
        summary.importedActions += 1;
      }
    }

    for (const group of data.groups || []) {
      const resolvedProjectIds = (group.projectPaths || [])
        .map((projectPath) => pathToProjectId.get(normalizeProjectPath(projectPath)))
        .filter((projectId) => projectId != null);
      const { name, renamed } = getImportedGroupName(group.name, existingGroupNames);
      const createdGroup = groupManager.add({
        name,
        projectIds: [...new Set(resolvedProjectIds)],
        color: group.color || '#1a6ef5',
      });

      if (group.isPinned) {
        groupManager.togglePin(createdGroup.id);
      }

      summary.importedGroups += 1;
      if (renamed) summary.renamedGroups += 1;
    }

    return summary;
  });

  return importTransaction(payload);
}

function formatImportSummary(summary) {
  return [
    `Projects imported: ${summary.importedProjects}`,
    `Projects skipped: ${summary.skippedProjects}`,
    `Workspaces imported: ${summary.importedGroups}`,
    `Workspaces renamed: ${summary.renamedGroups}`,
    `Tags imported: ${summary.importedTags}`,
    `Actions imported: ${summary.importedActions}`,
    `Environment configs imported: ${summary.importedEnvironments}`,
  ].join('\n');
}

async function exportProjects() {
  const defaultFileName = `devignite-projects-${new Date().toISOString().slice(0, 10)}.json`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Projects',
    defaultPath: path.join(app.getPath('documents'), defaultFileName),
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  const payload = buildExportPayload();
  fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
  return {
    ok: true,
    filePath: result.filePath,
    projectCount: payload.projects.length,
    groupCount: payload.groups.length,
  };
}

async function importProjects() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Projects',
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, canceled: true };
  }

  const filePath = result.filePaths[0];
  const raw = fs.readFileSync(filePath, 'utf8');
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  const summary = importProjectPayload(payload);
  mainWindow?.webContents.send('menu:refresh-projects');

  return {
    ok: true,
    filePath,
    ...summary,
  };
}

async function runProjectExport() {
  try {
    const result = await exportProjects();
    if (!result.ok || result.canceled) return result;

    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Export Complete',
      message: 'Projects exported successfully.',
      detail: `Saved to:\n${result.filePath}\n\nProjects: ${result.projectCount}\nWorkspaces: ${result.groupCount}`,
    });
    return result;
  } catch (error) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Export Failed',
      message: 'Unable to export projects.',
      detail: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function runProjectImport() {
  try {
    const result = await importProjects();
    if (!result.ok || result.canceled) return result;

    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Import Complete',
      message: 'Project data imported successfully.',
      detail: `${result.filePath}\n\n${formatImportSummary(result)}`,
    });
    return result;
  } catch (error) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Import Failed',
      message: 'Unable to import project data.',
      detail: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

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
  notesTodosManager = new NotesTodosManager(dbPath);
  actionManager = new ActionManager(dbPath);
  settingsManager = new SettingsManager(dbPath);
  taskManager = new TaskManager();
  briefingService = new BriefingService(dbPath, gitService);
  
  codeHealthManager = new CodeHealthManager(projectManager);
  codeHealthManager.setProgressCallback((projectId, data) => {
    mainWindow?.webContents.send(IPC_CHANNELS.CODE_HEALTH_PROGRESS, { projectId, ...data });
  });

  settingsManager.incrementLaunchCount();

  logManager = new LogManager(logsDir, (projectId, level, message, ts) => {
    mainWindow?.webContents.send(IPC_CHANNELS.LOG_STREAM, { projectId, level, message, ts });
  });

  executionManager = new ExecutionManager(
    logManager, timeTracker, envManager, processManager, ideDetector, portManager,
    (projectId, status, pid) => {
      mainWindow?.webContents.send(IPC_CHANNELS.STATUS_UPDATE, { projectId, status, pid });
      
      const settings = settingsManager?.getSettings();
      if (settings?.notifications_enabled !== 0) {
        const p = projectManager?.getById(projectId);
        if (p && Notification.isSupported()) {
          if (status === PROJECT_STATUS.RUNNING) {
            new Notification({ title: p.name, body: 'Project Started' }).show();
          } else if (status === PROJECT_STATUS.STOPPED) {
            new Notification({ title: p.name, body: 'Project Stopped' }).show();
          } else if (status === PROJECT_STATUS.ERROR) {
            new Notification({ title: p.name, body: 'Error in project' }).show();
          }
        }
      }
    },
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

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximize-change', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximize-change', false));

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
ipcMain.handle('open-folder', async (_, path) => {
  shell.openPath(path);
});
ipcMain.handle('project:export', () => runProjectExport());
ipcMain.handle('project:import', () => runProjectImport());

// ── Window Controls ───────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);

// ── Menu ──────────────────────────────────────────────────────────────────────
ipcMain.on('menu:popup', (event, menuName) => {
  const send = (channel) => mainWindow?.webContents.send(channel);
  const menus = {
    File: [
      { label: 'New Project', click: () => send('menu:new-project') },
      { label: 'New Workspace', click: () => send('menu:new-workspace') },
      { type: 'separator' },
      { label: 'Export Projects', click: () => { void runProjectExport(); } },
      { label: 'Import Projects', click: () => { void runProjectImport(); } },
      { type: 'separator' },
      { label: 'Settings', click: () => send('menu:settings') },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() }
    ],
    Edit: [
      { label: 'Edit Project', click: () => send('menu:edit-project') },
      { label: 'Delete Project', click: () => send('menu:delete-project') },
    ],
    View: [
      { label: 'Refresh Projects', click: () => send('menu:refresh-projects') },
      { label: 'Toggle Fullscreen', click: () => send('menu:toggle-fullscreen') }
    ],
    Run: [
      { label: 'Start Work', click: () => send('menu:start-work') },
      { label: 'Stop Work', click: () => send('menu:stop-work') },
      { label: 'Start Workspace', click: () => send('menu:start-workspace') },
      { type: 'separator' },
      { label: 'Install Dependencies', click: () => send('menu:install-dependencies') }
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
      { label: 'Support DevIgnite', click: () => shell.openExternal('https://buymeacoffee.com/midhun.v.s') },
      { label: 'Star on GitHub', click: () => shell.openExternal('https://github.com/vsmidhun21/DevIgnite') },
      { type: 'separator' },
      { label: 'About', click: () => shell.openExternal('https://devignite.web.app/#how-it-works') },
      { label: 'Report Issue', click: () => shell.openExternal('https://github.com/vsmidhun21/DevIgnite/issues') },
      { label: 'Website', click: () => shell.openExternal('https://devignite.web.app/') },
      { type: 'separator' },
      { label: 'Show Guide', click: () => send('menu:show-guide') }
    ]
  };

  if (menus[menuName]) {
    Menu.buildFromTemplate(menus[menuName]).popup({ window: mainWindow });
  }
});


// ── Projects ──────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
  const projects = projectManager.listAll();
  
  // Use Promise.all to fetch git info in parallel without blocking main thread
  const projectsWithInfo = await Promise.all(projects.map(async (p) => {
    const cached = gitCache.get(p.path);
    const hasDocker = fs.existsSync(path.join(p.path, 'docker-compose.yml')) || fs.existsSync(path.join(p.path, 'docker-compose.yaml'));
    
    // Cache for 30s instead of 10s for better performance
    if (cached && (Date.now() - cached.ts) < 30000) {
      return {
        ...p,
        status: processManager.getStatus(p.id),
        pid: processManager.getInfo(p.id)?.pid ?? null,
        uptimeMs: processManager.getInfo(p.id)?.uptimeMs ?? 0,
        sessionId: activeSessions.get(p.id) ?? null,
        todaySecs: timeTracker.getTodayTotal(p.id),
        git: cached.info,
        hasDocker,
      };
    }

    // Fetch async
    const gitInfo = await gitService.getInfoAsync(p.path);
    gitCache.set(p.path, { info: gitInfo, ts: Date.now() });

    return {
      ...p,
      status: processManager.getStatus(p.id),
      pid: processManager.getInfo(p.id)?.pid ?? null,
      uptimeMs: processManager.getInfo(p.id)?.uptimeMs ?? 0,
      sessionId: activeSessions.get(p.id) ?? null,
      todaySecs: timeTracker.getTodayTotal(p.id),
      git: gitInfo,
      hasDocker,
    };
  }));

  return projectsWithInfo;
});

ipcMain.handle(IPC_CHANNELS.PROJECT_GET, (_, id) => projectManager.getById(id));
ipcMain.handle(IPC_CHANNELS.PROJECT_ADD, (_, data) => projectManager.add(data));
ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, (_, { id, data }) => projectManager.update(id, data));
ipcMain.handle(IPC_CHANNELS.PROJECT_TOGGLE_PIN, (_, id) => projectManager.togglePin(id));
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
  if (project.archived) return { ok: false, error: 'Archived projects must be restored before running' };
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
  else settingsManager.incrementProjectLaunchCount();
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

ipcMain.handle(IPC_CHANNELS.RESTART, async (_, projectId) => {
  const p = projectManager.getById(projectId);
  if (!p) return { ok: false, error: 'Not found' };
  const sid = activeSessions.get(projectId);
  if (sid) {
    executionManager.stopWork(p, sid);
    activeSessions.delete(projectId);
  } else if (processManager.isRunning(projectId)) {
    processManager.stop(projectId); 
  }
  await new Promise(r => setTimeout(r, 600));
  const sessionId = crypto.randomUUID();
  activeSessions.set(projectId, sessionId);
  const result = await executionManager.runOnly(p, sessionId);
  if (!result.ok) activeSessions.delete(projectId);
  return result;
});

ipcMain.handle(IPC_CHANNELS.START_DOCKER, async (_, projectId) => {
  const p = projectManager.getById(projectId);
  if (!p) return { ok: false };
  const file = fs.existsSync(path.join(p.path, 'docker-compose.yaml')) ? 'docker-compose.yaml' : 'docker-compose.yml';
  
  if (Notification.isSupported()) new Notification({ title: p.name, body: 'Docker Started' }).show();
  
  const command = `docker-compose -f ${file} up -d`;
  const jobId = taskManager.run({
    projectId,
    type: 'docker',
    label: 'Docker Compose',
    command,
    cwd: p.path,
    onLog: (pid, lvl, msg, ts) => logManager.write(projectId, lvl, `[Docker] ${msg}`)
  });
  return { ok: true, sessionId: jobId };
});
ipcMain.handle(IPC_CHANNELS.RUN_ONLY, async (_, projectId) => {
  const p = projectManager.getById(projectId);
  if (!p) return { ok: false, error: 'Not found' };
  if (p.archived) return { ok: false, error: 'Archived projects must be restored before running' };
  if (processManager.isRunning(projectId)) return { ok: false, error: 'Already running' };
  const sessionId = crypto.randomUUID();
  activeSessions.set(projectId, sessionId);
  const result = await executionManager.runOnly(p, sessionId);
  if (!result.ok) activeSessions.delete(projectId);
  else settingsManager.incrementProjectLaunchCount();
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
ipcMain.handle(IPC_CHANNELS.GROUP_TOGGLE_PIN, (_, id) => groupManager.togglePin(id));
ipcMain.handle(IPC_CHANNELS.GROUP_DELETE, (_, id) => groupManager.delete(id));
ipcMain.handle(IPC_CHANNELS.GROUP_ADD_PROJECT, (_, { groupId, projectId }) => groupManager.addProject(groupId, projectId));
ipcMain.handle(IPC_CHANNELS.GROUP_REMOVE_PROJECT, (_, { groupId, projectId }) => groupManager.removeProject(groupId, projectId));

ipcMain.handle(IPC_CHANNELS.GROUP_START, async (_, groupId) => {
  const group = groupManager.getById(groupId);
  if (!group) return { ok: false, error: 'Group not found' };
  const results = [];
  for (const projectId of group.projectIds) {
    const project = projectManager.getById(projectId);
    if (!project || project.archived) {
      results.push({ projectId, ok: false, error: project ? 'Archived' : 'Project not found' });
      continue;
    }
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

// ── Briefing ──────────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.PROJECT_BRIEFING, async (_, { projectId, projectPath }) => {
  const shouldShow = briefingService.shouldShow(projectId);
  if (!shouldShow) return { shouldShow: false };
  
  const data = await briefingService.getBriefingData(projectId, projectPath);
  return { shouldShow: true, data };
});
ipcMain.handle(IPC_CHANNELS.PROJECT_BRIEFING_MARK_SHOWN, (_, projectId) => {
  briefingService.markShown(projectId);
  return { ok: true };
});

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
ipcMain.handle(IPC_CHANNELS.SESSION_ADD_MANUAL, (_, { projectId, seconds, note }) => {
  timeTracker.addManualEntry(projectId, seconds, note);
  return { ok: true };
});
ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_STATS, (_, { projectId }) => timeTracker.getProductivityStats(projectId || null));

// ── Notes & Todos ─────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.NOTE_GET, (_, { type, refId }) => notesTodosManager.getNote(type, refId));
ipcMain.handle(IPC_CHANNELS.NOTE_SAVE, (_, { type, refId, content }) => notesTodosManager.saveNote(type, refId, content));
ipcMain.handle(IPC_CHANNELS.TODO_GET, (_, { type, refId }) => notesTodosManager.getTodos(type, refId));
ipcMain.handle(IPC_CHANNELS.TODO_ADD, (_, { type, refId, text }) => notesTodosManager.addTodo(type, refId, text));
ipcMain.handle(IPC_CHANNELS.TODO_TOGGLE, (_, id) => notesTodosManager.toggleTodo(id));
ipcMain.handle(IPC_CHANNELS.TODO_DELETE, (_, id) => notesTodosManager.deleteTodo(id));

// ── Actions ───────────────────────────────────────────────────────────────────
ipcMain.handle('get-actions', (_, projectId) => actionManager.getActions(projectId));
ipcMain.handle('add-action', (_, { projectId, name, command }) => actionManager.addAction(projectId, name, command));
ipcMain.handle('delete-action', (_, id) => actionManager.deleteAction(id));

// ── App Settings ──────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.APP_SETTINGS_GET, () => {
  const s = settingsManager.getSettings();
  if (s && s.shortcuts) {
    try { s.shortcuts = JSON.parse(s.shortcuts); } catch (e) { s.shortcuts = {}; }
  }
  return s;
});
ipcMain.handle(IPC_CHANNELS.APP_SETTINGS_UPDATE, (_, status) => settingsManager.updateSponsorshipStatus(status));
ipcMain.handle('settings:save', (_, settings) => settingsManager.updateSettings(settings));
ipcMain.handle('tags:getCustom', () => settingsManager.getCustomTags());
ipcMain.handle('tags:add', (_, tag) => { settingsManager.addCustomTag(tag); return { ok: true }; });
ipcMain.handle('tags:remove', (_, tag) => { settingsManager.removeCustomTag(tag); return { ok: true }; });

// ── Tour State ────────────────────────────────────────────────────────────────
ipcMain.handle('tour:getState', () => settingsManager.getTourState());
ipcMain.handle('tour:saveState', (_, state) => { settingsManager.saveTourState(state); return { ok: true }; });

// ── Code Health ───────────────────────────────────────────────────────────────
ipcMain.handle(IPC_CHANNELS.CODE_HEALTH_ANALYZE, async (_, { projectId, options }) => {
  return await codeHealthManager.analyze(projectId, options);
});

ipcMain.handle('run-action', async (_, id) => {
  const action = actionManager.db.prepare('SELECT * FROM actions WHERE id = ?').get(id);
  if (!action) return { ok: false };
  const p = projectManager.getById(action.projectId);
  if (!p) return { ok: false };
  
  const jobId = taskManager.run({
    projectId: p.id,
    type: 'action',
    label: action.name,
    command: action.command,
    cwd: p.path,
    onLog: (pid, lvl, msg, ts) => logManager.write(p.id, lvl, `[Action ${action.name}] ${msg}`)
  });
  return { ok: true, sessionId: jobId };
});
ipcMain.handle('open-url', async (_, url) => {
  if (url) shell.openExternal(url);
  return { ok: true };
});

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

ipcMain.handle('job:list', (_, projectId) => taskManager?.listJobsForProject(projectId) || []);
ipcMain.handle('job:cancel', (_, jobId) => taskManager?.cancel(jobId));
ipcMain.handle('perf:snapshot', () => ({
  activeJobs: taskManager ? taskManager._jobs.size : 0,
  runningProcesses: processManager ? processManager.listRunning().length : 0,
  memUsage: process.memoryUsage()
}));

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  initializeApp();
  createWindow();
  // Start updater after window is ready — 3s delay avoids blocking startup
  mainWindow.webContents.once('did-finish-load', () => {
    updater = new Updater(mainWindow);
    const settings = settingsManager?.getSettings();
    if (settings?.auto_update_enabled !== 0) {
      setTimeout(() => updater.checkForUpdates(), 3000);
    }
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => {
  executionManager?.stopAllTicks();
  taskManager?.stopAll();
  processManager.stopAll();
  logManager?.closeAll();
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});
