export const PROJECT_TYPES = {
  DJANGO: 'Django', FLASK: 'Flask', FASTAPI: 'FastAPI',
  REACT: 'React', NEXTJS: 'Next.js', LARAVEL: 'Laravel',
  SPRING_BOOT: 'Spring Boot', NODEJS: 'Node.js', CUSTOM: 'Custom',
};

export const IDE_COMMANDS = {
  'VS Code': 'code .', 'IntelliJ IDEA': 'idea .',
  'WebStorm': 'webstorm .', 'PyCharm': 'pycharm .', 'Android Studio': 'studio .',
};

export const ENVIRONMENTS = { DEV: 'dev', TEST: 'test', STAGING: 'staging', PROD: 'prod' };

export const PROJECT_STATUS = {
  RUNNING: 'running', STOPPED: 'stopped', ERROR: 'error', STARTING: 'starting',
};

export const DEFAULT_COMMANDS = {
  'Django': 'python manage.py runserver', 'Flask': 'flask run',
  'FastAPI': 'uvicorn main:app --reload', 'React': 'npm start',
  'Next.js': 'npm run dev', 'Laravel': 'php artisan serve',
  'Spring Boot': 'mvn spring-boot:run', 'Node.js': 'node index.js', 'Custom': '',
};

export const DEFAULT_PORTS = {
  'Django': 8000, 'Flask': 5000, 'FastAPI': 8001, 'React': 3000,
  'Next.js': 3000, 'Laravel': 8080, 'Spring Boot': 8080, 'Node.js': 3001, 'Custom': 3000,
};

export const DEFAULT_IDES = {
  'Django': 'VS Code', 'Flask': 'VS Code', 'FastAPI': 'VS Code',
  'React': 'VS Code', 'Next.js': 'VS Code', 'Laravel': 'VS Code',
  'Spring Boot': 'IntelliJ IDEA', 'Node.js': 'VS Code', 'Custom': 'VS Code',
};

export const IPC_CHANNELS = {
  // Existing
  PROJECT_LIST: 'project:list', PROJECT_GET: 'project:get',
  PROJECT_ADD: 'project:add', PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete', IDE_OPEN: 'ide:open',
  CONFIG_GET: 'config:get', CONFIG_SET: 'config:set',
  LOG_CLEAR: 'log:clear',

  // DevIgnite — Start Work
  START_WORK:  'work:start',
  STOP_WORK:   'work:stop',

  // DevIgnite — streaming push channels (main → renderer)
  LOG_STREAM:    'log:stream',
  STATUS_UPDATE: 'status:update',
  TICK_UPDATE:   'tick:update',

  // DevIgnite — logs
  LOG_READ:    'log:read',
  LOG_META:    'log:meta',

  // DevIgnite — time tracking
  SESSION_HISTORY:   'session:history',
  SESSION_TODAY:     'session:today',
  SESSION_ALL_TIME:  'session:alltime',

  // DevIgnite — env
  ENV_DETECT:  'env:detect',
  ENV_PARSE:   'env:parse',
};
