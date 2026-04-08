// src/preload.js — Secure IPC bridge (Forge Vite version)
// Forge compiles this to .vite/build/preload.js alongside main.js.
// Only require('electron') is safe here — no core/ or shared/ imports.

// import { contextBridge, ipcRenderer } from 'electron';

const { contextBridge, ipcRenderer } = require('electron');

// IPC channel names — inlined to avoid any require() outside of 'electron'
const CH = {
  PROJECT_LIST:    'project:list',
  PROJECT_GET:     'project:get',
  PROJECT_ADD:     'project:add',
  PROJECT_UPDATE:  'project:update',
  PROJECT_DELETE:  'project:delete',
  PROJECT_RUN:     'project:run',
  PROJECT_STOP:    'project:stop',
  PROJECT_RESTART: 'project:restart',
  IDE_OPEN:        'ide:open',
  CONFIG_GET:      'config:get',
  CONFIG_SET:      'config:set',
  LOG_STREAM:      'log:stream',
  LOG_CLEAR:       'log:clear',
  STATUS_UPDATE:   'status:update',
};

contextBridge.exposeInMainWorld('launcher', {
  // Native folder picker
  pickFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  projects: {
    list:   ()           => ipcRenderer.invoke(CH.PROJECT_LIST),
    get:    (id)         => ipcRenderer.invoke(CH.PROJECT_GET, id),
    add:    (data)       => ipcRenderer.invoke(CH.PROJECT_ADD, data),
    update: (id, data)   => ipcRenderer.invoke(CH.PROJECT_UPDATE, { id, data }),
    delete: (id)         => ipcRenderer.invoke(CH.PROJECT_DELETE, id),
  },

  run:     (id) => ipcRenderer.invoke(CH.PROJECT_RUN, id),
  stop:    (id) => ipcRenderer.invoke(CH.PROJECT_STOP, id),
  restart: (id) => ipcRenderer.invoke(CH.PROJECT_RESTART, id),
  openIDE: (id) => ipcRenderer.invoke(CH.IDE_OPEN, id),

  config: {
    get: (projectId, env)            => ipcRenderer.invoke(CH.CONFIG_GET, { projectId, env }),
    set: (projectId, env, overrides) => ipcRenderer.invoke(CH.CONFIG_SET, { projectId, env, overrides }),
  },

  logs: {
    clear:    (id) => ipcRenderer.invoke(CH.LOG_CLEAR, id),
    onStream: (cb) => {
      const handler = (_, data) => cb(data);
      ipcRenderer.on(CH.LOG_STREAM, handler);
      return () => ipcRenderer.removeListener(CH.LOG_STREAM, handler);
    },
  },

  onStatusUpdate: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on(CH.STATUS_UPDATE, handler);
    return () => ipcRenderer.removeListener(CH.STATUS_UPDATE, handler);
  },
});
