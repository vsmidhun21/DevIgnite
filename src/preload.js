const { contextBridge, ipcRenderer } = require('electron');

const CH = {
  PROJECT_LIST: 'project:list', PROJECT_GET: 'project:get',
  PROJECT_ADD: 'project:add', PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  CONFIG_GET: 'config:get', CONFIG_SET: 'config:set',
  LOG_CLEAR: 'log:clear', LOG_READ: 'log:read', LOG_META: 'log:meta',
  START_WORK: 'work:start', STOP_WORK: 'work:stop',
  RUN_ONLY: 'work:run', OPEN_IDE: 'work:openIDE',
  OPEN_TERMINAL: 'work:openTerminal', OPEN_BROWSER: 'work:openBrowser',
  VALIDATE_PROJECT: 'project:validate', DETECT_PROJECT: 'project:detect',
  IDE_LIST: 'ide:list', IDE_BROWSE: 'ide:browse',
  LOG_STREAM: 'log:stream', STATUS_UPDATE: 'status:update', TICK_UPDATE: 'tick:update',
  SESSION_HISTORY: 'session:history', SESSION_TODAY: 'session:today', SESSION_ALL_TIME: 'session:alltime',
  ENV_DETECT: 'env:detect', ENV_PARSE: 'env:parse',
};

const on = (channel, cb) => {
  const h = (_, d) => cb(d);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld('devignite', {
  pickFolder:    ()        => ipcRenderer.invoke('dialog:openFolder'),
  pickFile:      (filters) => ipcRenderer.invoke('dialog:openFile', { filters }),

  projects: {
    list:   ()          => ipcRenderer.invoke(CH.PROJECT_LIST),
    get:    (id)        => ipcRenderer.invoke(CH.PROJECT_GET, id),
    add:    (data)      => ipcRenderer.invoke(CH.PROJECT_ADD, data),
    update: (id, data)  => ipcRenderer.invoke(CH.PROJECT_UPDATE, { id, data }),
    delete: (id)        => ipcRenderer.invoke(CH.PROJECT_DELETE, id),
    detect: (path)      => ipcRenderer.invoke(CH.DETECT_PROJECT, { projectPath: path }),
    validate: (id)      => ipcRenderer.invoke(CH.VALIDATE_PROJECT, id),
  },

  work: {
    start:       (id) => ipcRenderer.invoke(CH.START_WORK, id),
    stop:        (id) => ipcRenderer.invoke(CH.STOP_WORK, id),
    run:         (id) => ipcRenderer.invoke(CH.RUN_ONLY, id),
    openIDE:     (id) => ipcRenderer.invoke(CH.OPEN_IDE, id),
    openTerminal:(id) => ipcRenderer.invoke(CH.OPEN_TERMINAL, id),
    openBrowser: (id) => ipcRenderer.invoke(CH.OPEN_BROWSER, id),
  },

  logs: {
    read:     (projectId, which) => ipcRenderer.invoke(CH.LOG_READ, { projectId, which }),
    meta:     (projectId)        => ipcRenderer.invoke(CH.LOG_META, projectId),
    clear:    (projectId)        => ipcRenderer.invoke(CH.LOG_CLEAR, projectId),
    onStream: (cb)               => on(CH.LOG_STREAM, cb),
  },

  time: {
    history: (projectId, limit) => ipcRenderer.invoke(CH.SESSION_HISTORY, { projectId, limit }),
    today:   (projectId)        => ipcRenderer.invoke(CH.SESSION_TODAY, projectId),
    allTime: (projectId)        => ipcRenderer.invoke(CH.SESSION_ALL_TIME, projectId),
  },

  env: {
    detect: (projectPath)           => ipcRenderer.invoke(CH.ENV_DETECT, { projectPath }),
    parse:  (projectPath, filename) => ipcRenderer.invoke(CH.ENV_PARSE, { projectPath, filename }),
  },

  ide: {
    list:   ()    => ipcRenderer.invoke(CH.IDE_LIST),
    browse: ()    => ipcRenderer.invoke(CH.IDE_BROWSE),
  },

  config: {
    get: (projectId, env)            => ipcRenderer.invoke(CH.CONFIG_GET, { projectId, env }),
    set: (projectId, env, overrides) => ipcRenderer.invoke(CH.CONFIG_SET, { projectId, env, overrides }),
  },

  on: {
    status:    (cb) => on(CH.STATUS_UPDATE, cb),
    tick:      (cb) => on(CH.TICK_UPDATE, cb),
    logStream: (cb) => on(CH.LOG_STREAM, cb),
  },
});
