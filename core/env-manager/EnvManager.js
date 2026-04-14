import fs from 'fs';
import path from 'path';

// Which .env filenames map to which logical environment
const ENV_FILE_MAP = {
  '.env.dev':         'dev',
  '.env.development': 'dev',
  '.env.local':       'dev',
  '.env.test':        'test',
  '.env.testing':     'test',
  '.env.staging':     'staging',
  '.env.prod':        'prod',
  '.env.production':  'prod',
  '.env':             'dev',   // fallback base
};

const ENV_CANDIDATES = {
  dev:     ['.env.dev', '.env.development', '.env.local', '.env'],
  test:    ['.env.test', '.env.testing', '.env'],
  staging: ['.env.staging', '.env'],
  prod:    ['.env.prod', '.env.production', '.env'],
};

export class EnvManager {
  /**
   * Scan project folder and return which env files actually exist.
   * Returns { available: string[], files: DetectedFile[] }
   * available = array of env names that have a real .env file backing them
   */
  detectEnvFiles(projectPath) {
    const found       = [];
    const available   = new Set();
    const checkedNames = new Set();

    for (const [filename, envName] of Object.entries(ENV_FILE_MAP)) {
      if (checkedNames.has(filename)) continue;
      checkedNames.add(filename);
      const fullPath = path.join(projectPath, filename);
      if (fs.existsSync(fullPath)) {
        found.push({ filename, fullPath, env: envName });
        available.add(envName);
      }
    }

    // Always treat 'dev' as available (it's the baseline)
    available.add('dev');

    return {
      available: [...available],
      files: found,
    };
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
}
