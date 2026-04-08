// core/execution-engine/AutoDetector.js
// Phase 3 feature: scan a folder and guess the project type + command.
// Pure Node.js — no Electron dependency.

import fs from 'fs';
import path from 'path';
import { PROJECT_TYPES, DEFAULT_COMMANDS, DEFAULT_PORTS } from '../../shared/constants/index.js';


// const fs = require('fs');
// const path = require('path');
// const { PROJECT_TYPES, DEFAULT_COMMANDS, DEFAULT_PORTS } = require('../../shared/constants');

/**
 * Ordered detection rules. First match wins.
 * Each rule: { type, files[], dirs[], pkgScripts[] }
 */
const DETECTION_RULES = [
  // ── Python frameworks ─────────────────────────────────────────
  {
    type: PROJECT_TYPES.DJANGO,
    files: ['manage.py'],
    pkgFiles: ['requirements.txt'],
    pkgContains: { 'requirements.txt': 'django' },
  },
  {
    type: PROJECT_TYPES.FASTAPI,
    files: ['main.py'],
    pkgContains: { 'requirements.txt': 'fastapi' },
  },
  {
    type: PROJECT_TYPES.FLASK,
    files: ['app.py'],
    pkgContains: { 'requirements.txt': 'flask' },
  },

  // ── JavaScript / Node ─────────────────────────────────────────
  {
    type: PROJECT_TYPES.NEXTJS,
    files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    pkgDepContains: 'next',
  },
  {
    type: PROJECT_TYPES.REACT,
    files: ['src/App.jsx', 'src/App.tsx', 'src/App.js'],
    pkgDepContains: 'react-scripts',
    // CRA or Vite React project
  },

  // ── PHP ───────────────────────────────────────────────────────
  {
    type: PROJECT_TYPES.LARAVEL,
    files: ['artisan'],
    dirs: ['app/Http', 'routes/web.php'],
  },

  // ── Java ─────────────────────────────────────────────────────
  {
    type: PROJECT_TYPES.SPRING_BOOT,
    files: ['pom.xml', 'build.gradle'],
    pkgContains: { 'pom.xml': 'spring-boot' },
  },

  // ── Generic Node ─────────────────────────────────────────────
  {
    type: PROJECT_TYPES.NODEJS,
    files: ['package.json'],
    pkgScripts: ['start'],
  },
];

export class AutoDetector {
  /**
   * Detect the project type from a folder path.
   * @param {string} folderPath
   * @returns {{ type: string, command: string, port: number } | null}
   */
  detect(folderPath) {
    if (!fs.existsSync(folderPath)) return null;

    const files  = this._listFiles(folderPath);
    const pkgJson = this._readPackageJson(folderPath);

    for (const rule of DETECTION_RULES) {
      if (this._matches(rule, files, folderPath, pkgJson)) {
        const command = this._resolveCommand(rule.type, pkgJson);
        return {
          type:    rule.type,
          command,
          port:    DEFAULT_PORTS[rule.type] || 3000,
          ide:     this._suggestIDE(rule.type),
        };
      }
    }

    // Fallback: generic Node project if package.json exists
    if (pkgJson) {
      return {
        type:    PROJECT_TYPES.NODEJS,
        command: pkgJson.scripts?.start || 'node index.js',
        port:    3000,
        ide:     'VS Code',
      };
    }

    return null;
  }

  // ─── Private ────────────────────────────────────────────────────

  _listFiles(dir) {
    try {
      return fs.readdirSync(dir);
    } catch {
      return [];
    }
  }

  _readPackageJson(dir) {
    try {
      const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  _fileExists(folderPath, relPath) {
    return fs.existsSync(path.join(folderPath, relPath));
  }

  _fileContains(folderPath, relPath, text) {
    try {
      const content = fs.readFileSync(path.join(folderPath, relPath), 'utf8');
      return content.toLowerCase().includes(text.toLowerCase());
    } catch {
      return false;
    }
  }

  _matches(rule, files, folderPath, pkgJson) {
    // Check required files
    if (rule.files) {
      const found = rule.files.some(f => this._fileExists(folderPath, f));
      if (!found) return false;
    }

    // Check file content
    if (rule.pkgContains) {
      for (const [file, keyword] of Object.entries(rule.pkgContains)) {
        if (!this._fileContains(folderPath, file, keyword)) return false;
      }
    }

    // Check package.json dependencies
    if (rule.pkgDepContains && pkgJson) {
      const allDeps = {
        ...pkgJson.dependencies,
        ...pkgJson.devDependencies,
      };
      if (!Object.keys(allDeps).some(k => k.includes(rule.pkgDepContains))) {
        return false;
      }
    }

    // Check package.json scripts
    if (rule.pkgScripts && pkgJson) {
      const hasScript = rule.pkgScripts.every(s => pkgJson.scripts?.[s]);
      if (!hasScript) return false;
    }

    return true;
  }

  _resolveCommand(type, pkgJson) {
    // For Node projects, prefer package.json scripts
    if (pkgJson?.scripts?.start && [PROJECT_TYPES.REACT, PROJECT_TYPES.NEXTJS, PROJECT_TYPES.NODEJS].includes(type)) {
      const script = type === PROJECT_TYPES.NEXTJS && pkgJson.scripts.dev
        ? 'npm run dev'
        : 'npm start';
      return script;
    }
    return DEFAULT_COMMANDS[type] || 'npm start';
  }

  _suggestIDE(type) {
    return type === PROJECT_TYPES.SPRING_BOOT ? 'IntelliJ IDEA' : 'VS Code';
  }
}

// module.exports = AutoDetector;
