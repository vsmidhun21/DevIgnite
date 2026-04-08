// core/index.js
// Barrel export. Both Desktop (Electron main) and CLI import from here.
// This is the ONLY entry point into the core layer.

// const ProjectManager  = require('./project-manager/ProjectManager');
// const ExecutionEngine = require('./execution-engine/ExecutionEngine');
// const ConfigManager   = require('./config-manager/ConfigManager');
// const ProcessManager  = require('./process-manager/ProcessManager');
// const { getDb, closeDb } = require('./db/database');

import { ProjectManager }  from './project-manager/ProjectManager.js';
import { ExecutionEngine } from './execution-engine/ExecutionEngine.js';
import { ConfigManager }   from './config-manager/ConfigManager.js';
import { ProcessManager }  from './process-manager/ProcessManager.js';
import { getDb, closeDb } from './db/database.js';

// module.exports = {
//   ProjectManager,
//   ExecutionEngine,
//   ConfigManager,
//   ProcessManager,
//   getDb,
//   closeDb,
// };

export {
  ProjectManager,
  ExecutionEngine,
  ConfigManager,
  ProcessManager,
  getDb,
  closeDb,
};
