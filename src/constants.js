export const DEFAULT_COMMANDS = {
  'Django': 'python manage.py runserver', 'Flask': 'flask run',
  'FastAPI': 'uvicorn main:app --reload', 'React': 'npm start',
  'Next.js': 'npm run dev', 'Laravel': 'php artisan serve',
  'Spring Boot': 'mvn spring-boot:run', 'Node.js': 'node index.js', 'Custom': '',
};
export const DEFAULT_PORTS = {
  'Django': 8000, 'Flask': 5000, 'FastAPI': 8001, 'React': 3000,
  'Next.js': 3000, 'Laravel': 8080, 'Spring Boot': 8080, 'Node.js': 3001, 'Custom': null,
};
export const DEFAULT_IDES = {
  'Django': 'VS Code', 'Flask': 'VS Code', 'FastAPI': 'VS Code',
  'React': 'VS Code', 'Next.js': 'VS Code', 'Laravel': 'VS Code',
  'Spring Boot': 'IntelliJ IDEA', 'Node.js': 'VS Code', 'Custom': 'VS Code',
};
export const TYPE_OPTIONS = [
  'Django','Flask','FastAPI','React','Next.js','Laravel','Spring Boot','Node.js','Custom',
];
export const IDE_OPTIONS = [
  'VS Code','IntelliJ IDEA','WebStorm','PyCharm','Android Studio',
];
