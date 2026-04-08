// core/__tests__/ProjectManager.test.js
// Run with: npx jest core/__tests__

const path = require('path');
const os   = require('os');
const fs   = require('fs');
const ProjectManager = require('../project-manager/ProjectManager');
const { closeDb } = require('../db/database');

// ─── Test setup: use a temp SQLite file per test run ─────────────────────
let testDbPath;
let pm;

beforeEach(() => {
  testDbPath = path.join(os.tmpdir(), `launcher-test-${Date.now()}.sqlite`);
  pm = new ProjectManager(testDbPath);
});

afterEach(() => {
  closeDb();
  try { fs.unlinkSync(testDbPath); } catch {}
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('ProjectManager.add()', () => {
  test('adds a valid project and returns it with an id', () => {
    const { id, project } = pm.add({
      name:    'test-django',
      path:    'C:\\projects\\test',
      type:    'Django',
      command: 'python manage.py runserver',
      port:    8000,
      ide:     'VS Code',
    });

    expect(id).toBeGreaterThan(0);
    expect(project.name).toBe('test-django');
    expect(project.type).toBe('Django');
    expect(project.port).toBe(8000);
  });

  test('throws if name is missing', () => {
    expect(() => pm.add({ path: '/x', command: 'npm start' }))
      .toThrow('Project name is required');
  });

  test('throws if path is missing', () => {
    expect(() => pm.add({ name: 'test', command: 'npm start' }))
      .toThrow('Project path is required');
  });

  test('throws if command is missing', () => {
    expect(() => pm.add({ name: 'test', path: '/x' }))
      .toThrow('Run command is required');
  });
});

describe('ProjectManager.listAll()', () => {
  test('returns empty array when no projects', () => {
    expect(pm.listAll()).toEqual([]);
  });

  test('returns all added projects sorted by name', () => {
    pm.add({ name: 'zebra-app', path: '/z', command: 'npm start' });
    pm.add({ name: 'alpha-app', path: '/a', command: 'npm start' });

    const list = pm.listAll();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('alpha-app');
    expect(list[1].name).toBe('zebra-app');
  });
});

describe('ProjectManager.update()', () => {
  test('updates specific fields without losing others', () => {
    const { id } = pm.add({ name: 'myapp', path: '/x', command: 'npm start', port: 3000 });

    const updated = pm.update(id, { port: 4000 });

    expect(updated.port).toBe(4000);
    expect(updated.name).toBe('myapp');     // unchanged
    expect(updated.command).toBe('npm start'); // unchanged
  });

  test('throws for non-existent project', () => {
    expect(() => pm.update(9999, { name: 'x' })).toThrow('Project 9999 not found');
  });
});

describe('ProjectManager.delete()', () => {
  test('deletes a project and returns true', () => {
    const { id } = pm.add({ name: 'to-delete', path: '/x', command: 'run' });
    expect(pm.delete(id)).toBe(true);
    expect(pm.getById(id)).toBeNull();
  });

  test('returns false for non-existent id', () => {
    expect(pm.delete(9999)).toBe(false);
  });
});

describe('ProjectManager.setActiveEnv()', () => {
  test('switches environment', () => {
    const { id } = pm.add({ name: 'myapp', path: '/x', command: 'run' });
    pm.setActiveEnv(id, 'prod');
    expect(pm.getById(id).active_env).toBe('prod');
  });

  test('rejects invalid env names', () => {
    const { id } = pm.add({ name: 'myapp', path: '/x', command: 'run' });
    expect(() => pm.setActiveEnv(id, 'nuclear')).toThrow('Invalid env');
  });
});
