// core/port-manager/PortManager.js
import { createServer } from 'net';
import { execSync }     from 'child_process';
import os               from 'os';

const WIN = process.platform === 'win32';

export class PortManager {
  /**
   * Check if a port is in use.
   * @returns {Promise<boolean>}
   */
  isPortInUse(port) {
    return new Promise((resolve) => {
      const server = createServer();
      server.once('error', () => resolve(true));
      server.once('listening', () => { server.close(); resolve(false); });
      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Find the first free port starting from `startPort`.
   * @param {number} startPort
   * @param {number} maxTries
   * @returns {Promise<number>}
   */
  async findFreePort(startPort, maxTries = 20) {
    for (let p = startPort; p < startPort + maxTries; p++) {
      if (!(await this.isPortInUse(p))) return p;
    }
    throw new Error(`No free port found in range ${startPort}–${startPort + maxTries}`);
  }

  /**
   * Get PID of the process using a port.
   * Returns null if nothing is on that port.
   * @param {number} port
   * @returns {number|null}
   */
  getPidOnPort(port) {
    try {
      if (WIN) {
        const out = execSync(
          `netstat -ano | findstr ":${port} " | findstr "LISTENING"`,
          { stdio: 'pipe', timeout: 3000 }
        ).toString();
        const match = out.trim().split('\n')[0]?.match(/\s+(\d+)$/);
        return match ? parseInt(match[1]) : null;
      } else {
        const out = execSync(
          `lsof -ti :${port} 2>/dev/null || fuser ${port}/tcp 2>/dev/null`,
          { stdio: 'pipe', timeout: 3000 }
        ).toString().trim();
        return out ? parseInt(out.split('\n')[0]) : null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Kill the process using a port.
   * @param {number} port
   * @returns {{ ok: boolean, pid: number|null, error?: string }}
   */
  killProcessOnPort(port) {
    const pid = this.getPidOnPort(port);
    if (!pid) return { ok: true, pid: null };
    try {
      if (WIN) {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGTERM');
        setTimeout(() => { try { process.kill(pid, 'SIGKILL'); } catch {} }, 2000);
      }
      return { ok: true, pid };
    } catch (err) {
      return { ok: false, pid, error: err.message };
    }
  }

  /**
   * Full pre-launch check.
   * Returns { ok, port, action, pid? }
   *   action: 'clear' | 'incremented' | 'conflict'
   */
  async checkBeforeLaunch(port, resolution = 'increment') {
    if (!port) return { ok: true, port, action: 'none' };

    const inUse = await this.isPortInUse(port);
    if (!inUse) return { ok: true, port, action: 'clear' };

    const pid = this.getPidOnPort(port);

    if (resolution === 'kill') {
      const result = this.killProcessOnPort(port);
      await new Promise(r => setTimeout(r, 800)); // wait for port to free
      return { ok: result.ok, port, action: 'killed', pid };
    }

    if (resolution === 'increment') {
      const freePort = await this.findFreePort(port + 1);
      return { ok: true, port: freePort, action: 'incremented', originalPort: port, pid };
    }

    // resolution === 'prompt' — caller handles UI
    return { ok: false, port, action: 'conflict', pid };
  }

  /**
   * Snapshot of all listening ports on the system.
   * Returns [{ port, pid, name }]
   */
  getListeningPorts() {
    try {
      if (WIN) {
        const out = execSync('netstat -ano | findstr "LISTENING"', { stdio: 'pipe', timeout: 5000 }).toString();
        return out.trim().split('\n').map(line => {
          const parts = line.trim().split(/\s+/);
          const portMatch = parts[1]?.match(/:(\d+)$/);
          return portMatch ? { port: parseInt(portMatch[1]), pid: parseInt(parts[4]) } : null;
        }).filter(Boolean);
      } else {
        const out = execSync('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null', { stdio: 'pipe', timeout: 5000 }).toString();
        return out.trim().split('\n').slice(1).map(line => {
          const m = line.match(/:(\d+)\s+.*pid=(\d+)/);
          return m ? { port: parseInt(m[1]), pid: parseInt(m[2]) } : null;
        }).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
}
