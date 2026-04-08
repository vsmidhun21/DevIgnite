// core/__tests__/core.test.js
// Unit tests for the core layer.
// Run: npx jest from the project root.
// Tests run against an in-memory SQLite database.

const path = require('path');
const os = require('os');
const fs = require('fs');

const ProjectManager  = require('../project-manager/ProjectManager');
const ConfigManager   = require('../config-manager/ConfigManager');
const ProcessManager  = require('../process-manager/ProcessManager');
const AutoDetector    = require('../execution-engine/AutoDetector');
const { PROJECT_STATUS } = require('../../shared/constants');

const { closeDb } = require('../db/database');

// Use a temp DB file per test run, cleaned up after
const TEST_DB = path.join(os.tmpdir(), `test-launcher-${Date.now()}.sqlite`);

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(TEST_DB); } catch {}
});

// ─── ProjectManager ─────────────────────────────────────────────────────────
describe('ProjectManager', () => {
  let pm;

  beforeEach(() => {
    pm = new ProjectManager(TEST_DB);
  });

  test('add() creates a project and returns it with an ID', () => {
    const { id, project } = pm.add({
      name:    'test-app',
      path:    'C:\\projects\\test-app',
      type:    'Django',
      command: 'python manage.py runserver',
      ide:     'VS Code',
      port:    8000,
    });

    expect(id).toBeGreaterThan(0);
    expect(project.name).toBe('test-app');
    expect(project.type).toBe('Django');
    expect(project.port).toBe(8000);
  });

  test('listAll() returns added projects', () => {
    const before = pm.listAll().length;
    pm.add({ name: 'proj-a', path: '/a', type: 'React', command: 'npm start' });
    pm.add({ name: 'proj-b', path: '/b', type: 'Flask', command: 'flask run' });
    expect(pm.listAll().length).toBe(before + 2);
  });

  test('getById() returns the correct project', () => {
    const { id } = pm.add({ name: 'find-me', path: '/x', type: 'Custom', command: 'node .' });
    const p = pm.getById(id);
    expect(p.name).toBe('find-me');
  });

  test('getById() returns null for non-existent ID', () => {
    expect(pm.getById(999999)).toBeNull();
  });

  test('update() modifies fields', () => {
    const { id } = pm.add({ name: 'old-name', path: '/z', type: 'Custom', command: 'node .' });
    const updated = pm.update(id, { name: 'new-name', port: 4000 });
    expect(updated.name).toBe('new-name');
    expect(updated.port).toBe(4000);
  });

  test('delete() removes the project', () => {
    const { id } = pm.add({ name: 'delete-me', path: '/d', type: 'Custom', command: 'node .' });
    expect(pm.delete(id)).toBe(true);
    expect(pm.getById(id)).toBeNull();
  });

  test('add() throws if name is missing', () => {
    expect(() => pm.add({ path: '/x', command: 'node .' })).toThrow('name is required');
  });

  test('add() throws if command is missing', () => {
    expect(() => pm.add({ name: 'x', path: '/x' })).toThrow('command is required');
  });

  test('setActiveEnv() updates the environment', () => {
    const { id } = pm.add({ name: 'env-test', path: '/e', type: 'Django', command: 'python manage.py runserver' });
    pm.setActiveEnv(id, 'prod');
    expect(pm.getById(id).active_env).toBe('prod');
  });

  test('setActiveEnv() throws for invalid env', () => {
    const { id } = pm.add({ name: 'env-bad', path: '/eb', type: 'Django', command: 'python manage.py runserver' });
    expect(() => pm.setActiveEnv(id, 'invalid')).toThrow('Invalid env');
  });
});

// ─── ConfigManager ──────────────────────────────────────────────────────────
describe('ConfigManager', () => {
  let pm, cfg;

  beforeEach(() => {
    pm  = new ProjectManager(TEST_DB);
    cfg = new ConfigManager(TEST_DB);
  });

  test('getMergedConfig() falls back to project defaults', () => {
    const { id, project } = pm.add({
      name: 'cfg-test', path: '/c', type: 'React',
      command: 'npm start', port: 3000,
    });
    const merged = cfg.getMergedConfig(project, 'dev');
    expect(merged.command).toBe('npm start');
    expect(merged.port).toBe(3000);
  });

  test('setEnvConfig() overrides command for a specific env', () => {
    const { id, project } = pm.add({
      name: 'cfg-override', path: '/co', type: 'Node.js',
      command: 'node index.js', port: 3001,
    });
    cfg.setEnvConfig(id, 'prod', { command: 'node dist/index.js', port: 8080 });
    const merged = cfg.getMergedConfig(project, 'prod');
    expect(merged.command).toBe('node dist/index.js');
    expect(merged.port).toBe(8080);
  });
});

// ─── ProcessManager ─────────────────────────────────────────────────────────
describe('ProcessManager', () => {
  test('isRunning() returns false for unregistered project', () => {
    const pm = new ProcessManager();
    expect(pm.isRunning(42)).toBe(false);
  });

  test('getStatus() returns stopped for unknown project', () => {
    const pm = new ProcessManager();
    expect(pm.getStatus(99)).toBe(PROJECT_STATUS.STOPPED);
  });

  test('listRunning() returns empty array initially', () => {
    const pm = new ProcessManager();
    expect(pm.listRunning()).toEqual([]);
  });
});

// ─── AutoDetector ───────────────────────────────────────────────────────────
describe('AutoDetector', () => {
  const detector = new AutoDetector();
  const tmpDir = path.join(os.tmpdir(), 'detect-test-' + Date.now());

  beforeAll(() => fs.mkdirSync(tmpDir, { recursive: true }));
  afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  test('detects Django from manage.py + requirements.txt', () => {
    const dir = path.join(tmpDir, 'django');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'manage.py'), '');
    fs.writeFileSync(path.join(dir, 'requirements.txt'), 'Django==4.2\npsycopg2');
    const result = detector.detect(dir);
    expect(result?.type).toBe('Django');
  });

  test('detects Next.js from next.config.js', () => {
    const dir = path.join(tmpDir, 'nextjs');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'next.config.js'), '');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      dependencies: { next: '^14', react: '^18' },
      scripts: { dev: 'next dev' },
    }));
    const result = detector.detect(dir);
    expect(result?.type).toBe('Next.js');
  });

  test('returns null for empty directory', () => {
    const dir = path.join(tmpDir, 'empty');
    fs.mkdirSync(dir);
    expect(detector.detect(dir)).toBeNull();
  });

  test('returns null for non-existent path', () => {
    expect(detector.detect('/this/does/not/exist')).toBeNull();
  });
});
