export const PROJECT_STATUS = { RUNNING: 'running', STOPPED: 'stopped', ERROR: 'error', STARTING: 'starting' };

export const IPC_CHANNELS = {
  PROJECT_LIST: 'project:list', PROJECT_GET: 'project:get',
  PROJECT_ADD: 'project:add', PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  CONFIG_GET: 'config:get', CONFIG_SET: 'config:set',
  LOG_CLEAR: 'log:clear', LOG_READ: 'log:read', LOG_META: 'log:meta',
  START_WORK: 'work:start', STOP_WORK: 'work:stop',
  RUN_ONLY: 'work:run',
  OPEN_IDE: 'work:openIDE', OPEN_TERMINAL: 'work:openTerminal', OPEN_BROWSER: 'work:openBrowser',
  VALIDATE_PROJECT: 'project:validate',
  DETECT_PROJECT: 'project:detect',
  IDE_LIST: 'ide:list', IDE_BROWSE: 'ide:browse',
  LOG_STREAM: 'log:stream', STATUS_UPDATE: 'status:update', TICK_UPDATE: 'tick:update',
  SESSION_HISTORY: 'session:history', SESSION_TODAY: 'session:today', SESSION_ALL_TIME: 'session:alltime',
  ENV_DETECT: 'env:detect', ENV_PARSE: 'env:parse',
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
