const { contextBridge, ipcRenderer } = require('electron');
const on = (ch, cb) => { const h = (_, d) => cb(d); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); };
const CH = {
  PROJECT_LIST:'project:list', PROJECT_GET:'project:get', PROJECT_ADD:'project:add',
  PROJECT_UPDATE:'project:update', PROJECT_DELETE:'project:delete', PROJECT_TOGGLE_PIN:'project:togglePin',
  DETECT_PROJECT:'project:detect', VALIDATE_PROJECT:'project:validate',
  PROJECT_BRIEFING: 'project:getBriefing', PROJECT_BRIEFING_MARK_SHOWN: 'project:markBriefingShown',
  START_WORK:'work:start', STOP_WORK:'work:stop', RUN_ONLY:'work:run',
  RESTART:'work:restart', START_DOCKER:'work:startDocker',
  OPEN_IDE:'work:openIDE', OPEN_TERMINAL:'work:openTerminal', OPEN_BROWSER:'work:openBrowser',
  GROUP_LIST:'group:list', GROUP_GET:'group:get', GROUP_ADD:'group:add',
  GROUP_UPDATE:'group:update', GROUP_DELETE:'group:delete', GROUP_TOGGLE_PIN:'group:togglePin',
  GROUP_START:'group:start', GROUP_STOP:'group:stop',
  GROUP_ADD_PROJECT:'group:addProject', GROUP_REMOVE_PROJECT:'group:removeProject',
  PORT_CHECK:'port:check', PORT_KILL:'port:kill', PORT_SNAPSHOT:'port:snapshot',
  GIT_INFO:'git:info', GIT_INFO_BATCH:'git:infoBatch',
  CONFIG_GET:'config:get', CONFIG_SET:'config:set',
  LOG_CLEAR:'log:clear', LOG_READ:'log:read', LOG_META:'log:meta',
  IDE_LIST:'ide:list', IDE_BROWSE:'ide:browse',
  ENV_DETECT:'env:detect', ENV_PARSE:'env:parse',
  SESSION_HISTORY:'session:history', SESSION_TODAY:'session:today',
  SESSION_ALL_TIME:'session:alltime', PRODUCTIVITY_STATS:'productivity:stats',
  NOTE_GET:'note:get', NOTE_SAVE:'note:save',
  TODO_GET:'todo:get', TODO_ADD:'todo:add',
  TODO_TOGGLE:'todo:toggle', TODO_DELETE:'todo:delete',
  LOG_STREAM:'log:stream', STATUS_UPDATE:'status:update', TICK_UPDATE:'tick:update',
  PORT_CONFLICT:'port:conflict', SESSION_ADD_MANUAL:'session:addManual',
  APP_SETTINGS_GET: 'app:settingsGet', APP_SETTINGS_UPDATE: 'app:settingsUpdate',
  UPDATE_AVAILABLE: 'updater:available', UPDATE_PROGRESS: 'updater:progress',
  CODE_HEALTH_ANALYZE: 'codeHealth:analyze', CODE_HEALTH_PROGRESS: 'codeHealth:progress',
};
contextBridge.exposeInMainWorld('devignite', {
  pickFolder:  ()        => ipcRenderer.invoke('dialog:openFolder'),
  pickFile:    (filters) => ipcRenderer.invoke('dialog:openFile', { filters }),
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (cb) => on('window:maximize-change', cb),
    popupMenu: (name) => ipcRenderer.send('menu:popup', name),
    onMenuAction: (channel, cb) => {
      const h = (_, d) => cb(d);
      ipcRenderer.on(`menu:${channel}`, h);
      return () => ipcRenderer.removeListener(`menu:${channel}`, h);
    }
  },
  projects: {
    list:     ()           => ipcRenderer.invoke(CH.PROJECT_LIST),
    get:      (id)         => ipcRenderer.invoke(CH.PROJECT_GET, id),
    add:      (data)       => ipcRenderer.invoke(CH.PROJECT_ADD, data),
    update:   (id, data)   => ipcRenderer.invoke(CH.PROJECT_UPDATE, { id, data }),
    delete:   (id)         => ipcRenderer.invoke(CH.PROJECT_DELETE, id),
    togglePin:(id)         => ipcRenderer.invoke(CH.PROJECT_TOGGLE_PIN, id),
    detect:   (path)       => ipcRenderer.invoke(CH.DETECT_PROJECT, { projectPath: path }),
    validate: (id)         => ipcRenderer.invoke(CH.VALIDATE_PROJECT, id),
    getBriefing: (id, path) => ipcRenderer.invoke(CH.PROJECT_BRIEFING, { projectId: id, projectPath: path }),
    markBriefingShown: (id) => ipcRenderer.invoke(CH.PROJECT_BRIEFING_MARK_SHOWN, id),
  },
  work: {
    start:       (id) => ipcRenderer.invoke(CH.START_WORK, id),
    stop:        (id) => ipcRenderer.invoke(CH.STOP_WORK, id),
    run:         (id) => ipcRenderer.invoke(CH.RUN_ONLY, id),
    restart:     (id) => ipcRenderer.invoke(CH.RESTART, id),
    startDocker: (id) => ipcRenderer.invoke(CH.START_DOCKER, id),
    openIDE:     (id) => ipcRenderer.invoke(CH.OPEN_IDE, id),
    openTerminal:(id) => ipcRenderer.invoke(CH.OPEN_TERMINAL, id),
    openBrowser: (id) => ipcRenderer.invoke(CH.OPEN_BROWSER, id),
    openFolder:  (path) => ipcRenderer.invoke('open-folder', path),
  },
  groups: {
    list:          ()                          => ipcRenderer.invoke(CH.GROUP_LIST),
    get:           (id)                        => ipcRenderer.invoke(CH.GROUP_GET, id),
    add:           (data)                      => ipcRenderer.invoke(CH.GROUP_ADD, data),
    update:        (id, data)                  => ipcRenderer.invoke(CH.GROUP_UPDATE, { id, data }),
    delete:        (id)                        => ipcRenderer.invoke(CH.GROUP_DELETE, id),
    togglePin:     (id)                        => ipcRenderer.invoke(CH.GROUP_TOGGLE_PIN, id),
    start:         (id)                        => ipcRenderer.invoke(CH.GROUP_START, id),
    stop:          (id)                        => ipcRenderer.invoke(CH.GROUP_STOP, id),
    addProject:    (groupId, projectId)        => ipcRenderer.invoke(CH.GROUP_ADD_PROJECT, { groupId, projectId }),
    removeProject: (groupId, projectId)        => ipcRenderer.invoke(CH.GROUP_REMOVE_PROJECT, { groupId, projectId }),
  },
  ports: {
    check:    (port, resolution) => ipcRenderer.invoke(CH.PORT_CHECK, { port, resolution }),
    kill:     (port)             => ipcRenderer.invoke(CH.PORT_KILL, { port }),
    snapshot: ()                 => ipcRenderer.invoke(CH.PORT_SNAPSHOT),
  },
  git: {
    info:  (projectPath) => ipcRenderer.invoke(CH.GIT_INFO, { projectPath }),
    batch: (paths)       => ipcRenderer.invoke(CH.GIT_INFO_BATCH, { paths }),
  },
  logs: {
    read:     (projectId, which) => ipcRenderer.invoke(CH.LOG_READ, { projectId, which }),
    meta:     (projectId)        => ipcRenderer.invoke(CH.LOG_META, projectId),
    clear:    (projectId)        => ipcRenderer.invoke(CH.LOG_CLEAR, projectId),
    onStream: (cb)               => on(CH.LOG_STREAM, cb),
  },
  time: {
    history:    (projectId, limit) => ipcRenderer.invoke(CH.SESSION_HISTORY, { projectId, limit }),
    today:      (projectId)        => ipcRenderer.invoke(CH.SESSION_TODAY, projectId),
    allTime:    (projectId)        => ipcRenderer.invoke(CH.SESSION_ALL_TIME, projectId),
    addManual:  (projectId, seconds, note) => ipcRenderer.invoke(CH.SESSION_ADD_MANUAL, { projectId, seconds, note }),
    productivity:(projectId)       => ipcRenderer.invoke(CH.PRODUCTIVITY_STATS, { projectId }),
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
  notes: {
    get:  (type, refId)          => ipcRenderer.invoke(CH.NOTE_GET, { type, refId }),
    save: (type, refId, content) => ipcRenderer.invoke(CH.NOTE_SAVE, { type, refId, content }),
  },
  todos: {
    get:    (type, refId)       => ipcRenderer.invoke(CH.TODO_GET, { type, refId }),
    add:    (type, refId, text) => ipcRenderer.invoke(CH.TODO_ADD, { type, refId, text }),
    toggle: (id)                => ipcRenderer.invoke(CH.TODO_TOGGLE, id),
    delete: (id)                => ipcRenderer.invoke(CH.TODO_DELETE, id),
  },
  actions: {
    get: (projectId) => ipcRenderer.invoke('get-actions', projectId),
    add: (projectId, name, command) => ipcRenderer.invoke('add-action', { projectId, name, command }),
    delete: (id) => ipcRenderer.invoke('delete-action', id),
    run: (id) => ipcRenderer.invoke('run-action', id),
  },
  util: {
    openExternal: (url) => ipcRenderer.invoke('open-url', url),
  },
  settings: {
    get: () => ipcRenderer.invoke(CH.APP_SETTINGS_GET),
    update: (status) => ipcRenderer.invoke(CH.APP_SETTINGS_UPDATE, status),
    save: (settings) => ipcRenderer.invoke('settings:save', settings),
  },
  tags: {
    getCustom: () => ipcRenderer.invoke('tags:getCustom'),
    add: (tag) => ipcRenderer.invoke('tags:add', tag),
    remove: (tag) => ipcRenderer.invoke('tags:remove', tag),
  },
  codeHealth: {
    analyze: (projectId, options) => ipcRenderer.invoke(CH.CODE_HEALTH_ANALYZE, { projectId, options }),
  },
  tour: {
    getState:  ()      => ipcRenderer.invoke('tour:getState'),
    saveState: (state) => ipcRenderer.invoke('tour:saveState', state),
  },
  on: {
    status:        (cb) => on(CH.STATUS_UPDATE, cb),
    tick:          (cb) => on(CH.TICK_UPDATE, cb),
    logStream:     (cb) => on(CH.LOG_STREAM, cb),
    portConflict:  (cb) => on(CH.PORT_CONFLICT, cb),
    updateAvailable:(cb)=> on(CH.UPDATE_AVAILABLE, cb),
    updateProgress: (cb)=> on(CH.UPDATE_PROGRESS, cb),
    codeHealthProgress: (cb) => on(CH.CODE_HEALTH_PROGRESS, cb),
  },
  updater: {
    later:   (data)   => ipcRenderer.send('updater:later', data),
    download:(data)   => ipcRenderer.invoke('updater:download', data),
    install: (data)   => ipcRenderer.send('updater:install', data),
  },
});

contextBridge.exposeInMainWorld('api', {
  onMenu: (callback) => {
    ipcRenderer.on('menu:new-project', () => callback('new-project'));
    ipcRenderer.on('menu:new-workspace', () => callback('new-workspace'));
    ipcRenderer.on('menu:edit-project', () => callback('edit-project'));
    ipcRenderer.on('menu:delete-project', () => callback('delete-project'));
    ipcRenderer.on('menu:start-work', () => callback('start-work'));
    ipcRenderer.on('menu:stop-work', () => callback('stop-work'));
    ipcRenderer.on('menu:start-workspace', () => callback('start-workspace'));
    ipcRenderer.on('menu:install-deps', () => callback('install-deps'));
    ipcRenderer.on('menu:install-dependencies', () => callback('install-deps'));
    ipcRenderer.on('menu:toggle-sidebar', () => callback('toggle-sidebar'));
    ipcRenderer.on('menu:toggle-logs', () => callback('toggle-logs'));
    ipcRenderer.on('menu:refresh', () => callback('refresh'));
    ipcRenderer.on('menu:refresh-projects', () => callback('refresh'));
    ipcRenderer.on('menu:toggle-fullscreen', () => callback('toggle-fullscreen'));
    ipcRenderer.on('menu:kill-port', () => callback('kill-port'));
    ipcRenderer.on('menu:open-folder', () => callback('open-folder'));
    ipcRenderer.on('menu:open-ide', () => callback('open-ide'));
    ipcRenderer.on('menu:clear-logs', () => callback('clear-logs'));
    ipcRenderer.on('menu:settings', () => callback('settings'));
    ipcRenderer.on('menu:show-guide', () => callback('show-guide'));
  }
});
