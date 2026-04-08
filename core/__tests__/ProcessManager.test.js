// core/__tests__/ProcessManager.test.js
const { EventEmitter } = require('events');
const ProcessManager = require('../process-manager/ProcessManager');

// ─── Fake ChildProcess ────────────────────────────────────────────────────
function makeChild(pid = 12345) {
  const child = new EventEmitter();
  child.pid  = pid;
  child.kill = jest.fn(() => child.emit('close', 0));
  return child;
}

describe('ProcessManager', () => {
  let pm;

  beforeEach(() => { pm = new ProcessManager(); });

  test('registers a running process', () => {
    const child = makeChild(1001);
    pm.register(1, child, 'session-abc');

    expect(pm.isRunning(1)).toBe(true);
    expect(pm.getInfo(1).pid).toBe(1001);
    expect(pm.getInfo(1).sessionId).toBe('session-abc');
  });

  test('auto-removes process on close', () => {
    const child = makeChild(1002);
    pm.register(2, child, 'session-xyz');

    child.emit('close', 0);

    expect(pm.isRunning(2)).toBe(false);
  });

  test('stop() kills the process and returns true', () => {
    const child = makeChild(1003);
    pm.register(3, child, 'session-kill');

    const result = pm.stop(3);
    expect(result).toBe(true);
    expect(pm.isRunning(3)).toBe(false);
  });

  test('stop() returns false for unknown project', () => {
    expect(pm.stop(9999)).toBe(false);
  });

  test('listRunning() returns only running project IDs', () => {
    const c1 = makeChild(2001);
    const c2 = makeChild(2002);
    pm.register(10, c1, 's1');
    pm.register(11, c2, 's2');

    expect(pm.listRunning()).toEqual(expect.arrayContaining([10, 11]));

    pm.stop(10);
    expect(pm.listRunning()).toEqual([11]);
  });

  test('getStatus() returns correct status strings', () => {
    const child = makeChild(3001);
    pm.register(20, child, 's3');

    expect(pm.getStatus(20)).toBe('running');
    expect(pm.getStatus(21)).toBe('stopped');
  });

  test('stopAll() kills every running process', () => {
    const c1 = makeChild(4001);
    const c2 = makeChild(4002);
    pm.register(30, c1, 's4');
    pm.register(31, c2, 's5');

    pm.stopAll();

    expect(pm.listRunning()).toHaveLength(0);
  });
});
