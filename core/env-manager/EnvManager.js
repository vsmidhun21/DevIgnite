// core/env-manager/EnvManager.js
import fs from 'fs';
import path from 'path';

const ENV_CANDIDATES = {
  dev:     ['.env.dev',  '.env.development', '.env.local', '.env'],
  test:    ['.env.test', '.env.testing',                   '.env'],
  staging: ['.env.staging',                                '.env'],
  prod:    ['.env.prod', '.env.production',                '.env'],
};

export class EnvManager {
  detectEnvFiles(projectPath) {
    const found   = [];
    const checked = new Set();

    for (const [env, candidates] of Object.entries(ENV_CANDIDATES)) {
      for (const filename of candidates) {
        if (checked.has(filename)) continue;
        checked.add(filename);
        const fullPath = path.join(projectPath, filename);
        if (fs.existsSync(fullPath)) {
          found.push({ filename, fullPath, env });
        }
      }
    }
    return found;
  }

  parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const result  = {};

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let   val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key) result[key] = val;
    }
    return result;
  }

  /**
   * Build merged env for spawning.
   * Priority: process.env < .env file < DB overrides
   * @returns {{ env: Record<string,string>, loadedFile: string|null }}
   */
  buildEnv(projectPath, envFile, activeEnv, overrides = {}) {
    let loadedFile = null;
    let fileVars   = {};

    if (envFile) {
      const fullPath = path.join(projectPath, envFile);
      if (fs.existsSync(fullPath)) {
        fileVars   = this.parseEnvFile(fullPath);
        loadedFile = envFile;
      }
    } else {
      const candidates = ENV_CANDIDATES[activeEnv] || ENV_CANDIDATES.dev;
      for (const filename of candidates) {
        const fullPath = path.join(projectPath, filename);
        if (fs.existsSync(fullPath)) {
          fileVars   = this.parseEnvFile(fullPath);
          loadedFile = filename;
          break;
        }
      }
    }

    return {
      env: { ...process.env, ...fileVars, ...overrides },
      loadedFile,
    };
  }

  getBestEnvFile(projectPath, activeEnv) {
    const candidates = ENV_CANDIDATES[activeEnv] || ENV_CANDIDATES.dev;
    for (const filename of candidates) {
      if (fs.existsSync(path.join(projectPath, filename))) return filename;
    }
    return null;
  }
}
