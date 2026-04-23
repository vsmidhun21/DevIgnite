export const PROJECT_STATUS = { RUNNING: 'running', STOPPED: 'stopped', ERROR: 'error', STARTING: 'starting' };

export const IPC_CHANNELS = {
  // Projects
  PROJECT_LIST: 'project:list', PROJECT_GET: 'project:get',
  PROJECT_ADD: 'project:add', PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete', PROJECT_TOGGLE_PIN: 'project:togglePin',
  DETECT_PROJECT: 'project:detect', VALIDATE_PROJECT: 'project:validate',
  // Work
  START_WORK: 'work:start', STOP_WORK: 'work:stop', RUN_ONLY: 'work:run',
  RESTART: 'work:restart', START_DOCKER: 'work:startDocker',
  OPEN_IDE: 'work:openIDE', OPEN_TERMINAL: 'work:openTerminal', OPEN_BROWSER: 'work:openBrowser',
  // Groups
  GROUP_LIST: 'group:list', GROUP_GET: 'group:get',
  GROUP_ADD: 'group:add', GROUP_UPDATE: 'group:update', GROUP_DELETE: 'group:delete',
  GROUP_TOGGLE_PIN: 'group:togglePin',
  GROUP_START: 'group:start', GROUP_STOP: 'group:stop',
  GROUP_ADD_PROJECT: 'group:addProject', GROUP_REMOVE_PROJECT: 'group:removeProject',
  // Port
  PORT_CHECK: 'port:check', PORT_KILL: 'port:kill', PORT_SNAPSHOT: 'port:snapshot',
  // Git
  GIT_INFO: 'git:info', GIT_INFO_BATCH: 'git:infoBatch',
  // Config & Logs
  CONFIG_GET: 'config:get', CONFIG_SET: 'config:set',
  LOG_CLEAR: 'log:clear', LOG_READ: 'log:read', LOG_META: 'log:meta',
  // IDE
  IDE_LIST: 'ide:list', IDE_BROWSE: 'ide:browse',
  // Env
  ENV_DETECT: 'env:detect', ENV_PARSE: 'env:parse',
  // Sessions / Productivity
  SESSION_HISTORY: 'session:history',
  SESSION_TODAY: 'session:today', SESSION_ALL_TIME: 'session:alltime',
  SESSION_ADD_MANUAL: 'session:addManual',
  PRODUCTIVITY_STATS: 'productivity:stats',
  // Notes & Todos
  NOTE_GET: 'note:get', NOTE_SAVE: 'note:save',
  TODO_GET: 'todo:get', TODO_ADD: 'todo:add',
  TODO_TOGGLE: 'todo:toggle', TODO_DELETE: 'todo:delete',
  // App Settings
  APP_SETTINGS_GET: 'app:settingsGet', APP_SETTINGS_UPDATE: 'app:settingsUpdate',
  // Code Health
  CODE_HEALTH_ANALYZE: 'codeHealth:analyze',
  // Push channels (main → renderer)
  LOG_STREAM: 'log:stream', STATUS_UPDATE: 'status:update', TICK_UPDATE: 'tick:update',
  PORT_CONFLICT: 'port:conflict',
  CODE_HEALTH_PROGRESS: 'codeHealth:progress',
};

export const DEFAULT_COMMANDS = {
  'Django': 'python manage.py runserver', 'Flask': 'flask run',
  'FastAPI': 'uvicorn main:app --reload', 'React': 'npm start',
  'Next.js': 'npm run dev', 'Angular': 'ng serve', 'Vue': 'npm run dev',
  'Laravel': 'php artisan serve', 'Spring Boot': 'mvn spring-boot:run',
  'Node.js': 'node index.js', 'Python': 'python main.py', 'Custom': '',
};

export const DEFAULT_PORTS = {
  'Django': 8000, 'Flask': 5000, 'FastAPI': 8001, 'React': 3000,
  'Next.js': 3000, 'Angular': 4200, 'Vue': 5173, 'Laravel': 8080,
  'Spring Boot': 8080, 'Node.js': 3001, 'Custom': null,
};
