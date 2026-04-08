// core/__tests__/AutoDetector.test.js
const path = require('path');
const os   = require('os');
const fs   = require('fs');
const { detectProject } = require('../project-manager/AutoDetector');

// Helper: create a temp project directory with specific files
function makeTempProject(files) {
  const dir = path.join(os.tmpdir(), `detect-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true }); } catch {}
}

describe('AutoDetector', () => {
  test('detects Django project', async () => {
    const dir = makeTempProject({
      'manage.py':       '# django manage',
      'requirements.txt': 'Django==4.2\npsycopg2==2.9',
    });
    const result = await detectProject(dir);
    cleanup(dir);

    expect(result.type).toBe('Django');
    expect(result.command).toBe('python manage.py runserver');
    expect(result.port).toBe(8000);
    expect(result.detected).toBe(true);
  });

  test('detects FastAPI project', async () => {
    const dir = makeTempProject({
      'main.py':         'from fastapi import FastAPI',
      'requirements.txt': 'fastapi==0.110.0\nuvicorn==0.27.0',
    });
    const result = await detectProject(dir);
    cleanup(dir);

    expect(result.type).toBe('FastAPI');
    expect(result.command).toContain('uvicorn');
    expect(result.port).toBe(8001);
  });

  test('detects Next.js project', async () => {
    const dir = makeTempProject({
      'package.json': JSON.stringify({
        dependencies: { next: '14.0.0', react: '18.0.0' },
        scripts: { dev: 'next dev' },
      }),
    });
    const result = await detectProject(dir);
    cleanup(dir);

    expect(result.type).toBe('Next.js');
    expect(result.command).toBe('npm run dev');
  });

  test('detects React project', async () => {
    const dir = makeTempProject({
      'package.json': JSON.stringify({
        dependencies: { react: '18.0.0', 'react-dom': '18.0.0' },
        scripts: { start: 'react-scripts start' },
      }),
    });
    const result = await detectProject(dir);
    cleanup(dir);

    expect(result.type).toBe('React');
  });

  test('detects Spring Boot (Maven)', async () => {
    const dir = makeTempProject({
      'pom.xml': '<project><parent><artifactId>spring-boot-starter-parent</artifactId></parent></project>',
    });
    const result = await detectProject(dir);
    cleanup(dir);

    expect(result.type).toBe('Spring Boot');
    expect(result.ide).toBe('IntelliJ IDEA');
  });

  test('falls back to Custom for unknown project', async () => {
    const dir = makeTempProject({ 'README.md': '# hello' });
    const result = await detectProject(dir);
    cleanup(dir);

    expect(result.type).toBe('Custom');
    expect(result.detected).toBe(false);
  });
});
