// shared/constants/index.js
// CommonJS exports — used by: Electron main process, Core layer, CLI
// The Renderer (Vite/React) imports from shared/constants/esm.js instead

export const PROJECT_TYPES = {
  DJANGO:      'Django',
  FLASK:       'Flask',
  FASTAPI:     'FastAPI',
  REACT:       'React',
  NEXTJS:      'Next.js',
  LARAVEL:     'Laravel',
  SPRING_BOOT: 'Spring Boot',
  NODEJS:      'Node.js',
  CUSTOM:      'Custom',
};

export const IDE_COMMANDS = {
  'VS Code':       'code .',
  'IntelliJ IDEA': 'idea .',
  'WebStorm':      'webstorm .',
  'PyCharm':       'pycharm .',
  'Android Studio':'studio .',
};

export const ENVIRONMENTS = { DEV: 'dev', STAGING: 'staging', PROD: 'prod' };

export const PROJECT_STATUS = {
  RUNNING:  'running',
  STOPPED:  'stopped',
  ERROR:    'error',
  STARTING: 'starting',
};

export const DEFAULT_COMMANDS = {
  'Django':      'python manage.py runserver',
  'Flask':       'flask run',
  'FastAPI':     'uvicorn main:app --reload',
  'React':       'npm start',
  'Next.js':     'npm run dev',
  'Laravel':     'php artisan serve',
  'Spring Boot': 'mvn spring-boot:run',
  'Node.js':     'node index.js',
  'Custom':      '',
};

export const DEFAULT_PORTS = {
  'Django':      8000,
  'Flask':       5000,
  'FastAPI':     8001,
  'React':       3000,
  'Next.js':     3000,
  'Laravel':     8080,
  'Spring Boot': 8080,
  'Node.js':     3001,
  'Custom':      3000,
};

export const DEFAULT_IDES = {
  'Django':      'VS Code',
  'Flask':       'VS Code',
  'FastAPI':     'VS Code',
  'React':       'VS Code',
  'Next.js':     'VS Code',
  'Laravel':     'VS Code',
  'Spring Boot': 'IntelliJ IDEA',
  'Node.js':     'VS Code',
  'Custom':      'VS Code',
};

export const IPC_CHANNELS = {
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

// module.exports = {
//   PROJECT_TYPES,
//   IDE_COMMANDS,
//   ENVIRONMENTS,
//   PROJECT_STATUS,
//   DEFAULT_COMMANDS,
//   DEFAULT_PORTS,
//   DEFAULT_IDES,
//   IPC_CHANNELS,
// };
