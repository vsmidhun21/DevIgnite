export const TYPE_OPTIONS = [
  'Django','Flask','FastAPI','React','Next.js','Angular','Vue','Nuxt',
  'Laravel','Spring Boot','Node.js','Python','Custom',
];

export const IDE_OPTIONS = [
  'VS Code','Cursor','Windsurf','Zed',
  'IntelliJ IDEA','PyCharm','WebStorm','Rider','CLion',
  'Sublime Text','Vim','Notepad++','Custom',
];

export const DEFAULT_COMMANDS = {
  'Django':      'python manage.py runserver',
  'Flask':       'flask run',
  'FastAPI':     'uvicorn main:app --reload',
  'React':       'npm start',
  'Next.js':     'npm run dev',
  'Angular':     'ng serve',
  'Vue':         'npm run dev',
  'Nuxt':        'npm run dev',
  'Laravel':     'php artisan serve',
  'Spring Boot': 'mvn spring-boot:run',
  'Node.js':     'node index.js',
  'Python':      'python main.py',
  'Custom':      '',
};

export const DEFAULT_PORTS = {
  'Django': 8000, 'Flask': 5000, 'FastAPI': 8001,
  'React': 3000, 'Next.js': 3000, 'Angular': 4200, 'Vue': 5173, 'Nuxt': 3000,
  'Laravel': 8080, 'Spring Boot': 8080, 'Node.js': 3001, 'Custom': null,
};

export const DEFAULT_IDES = {
  'Django': 'PyCharm', 'Flask': 'VS Code', 'FastAPI': 'VS Code',
  'React': 'VS Code', 'Next.js': 'VS Code', 'Angular': 'VS Code',
  'Vue': 'VS Code', 'Nuxt': 'VS Code', 'Laravel': 'VS Code',
  'Spring Boot': 'IntelliJ IDEA', 'Node.js': 'VS Code',
  'Python': 'PyCharm', 'Custom': 'VS Code',
};
