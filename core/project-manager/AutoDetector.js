// core/project-manager/AutoDetector.js
// Phase 3: Detect project type, command, and port by inspecting the filesystem.
// Called when adding a project — provides smart defaults so users rarely type anything.

import fs from 'fs';
import path from 'path';
import { PROJECT_TYPES, DEFAULT_COMMANDS, DEFAULT_PORTS } from '../../shared/constants/index.js';

// const fs   = require('fs');
// const path = require('path');
// const { PROJECT_TYPES, DEFAULT_COMMANDS, DEFAULT_PORTS } = require('../../shared/constants');

/**
 * Detect everything about a project just from its directory.
 *
 * @param {string} projectPath - Absolute path to the project root
 * @returns {DetectedProject}  - { type, command, port, ide, name }
 */
async function detectProject(projectPath) {
  const files = safeReadDir(projectPath);

  const result = {
    name:    path.basename(projectPath),
    type:    PROJECT_TYPES.CUSTOM,
    command: '',
    port:    null,
    ide:     'VS Code',
    detected: false,
  };

  // ── Django ──────────────────────────────────────────────────────────────
  if (files.includes('manage.py') && files.includes('requirements.txt')) {
    const reqs = safeReadFile(path.join(projectPath, 'requirements.txt'));
    if (reqs.includes('django') || reqs.includes('Django')) {
      return { ...result, type: PROJECT_TYPES.DJANGO,
        command: 'python manage.py runserver',
        port: 8000, detected: true };
    }
  }

  // ── FastAPI ──────────────────────────────────────────────────────────────
  if (files.includes('requirements.txt')) {
    const reqs = safeReadFile(path.join(projectPath, 'requirements.txt'));
    if (reqs.includes('fastapi')) {
      const mainFile = files.includes('main.py') ? 'main' : 'app';
      return { ...result, type: PROJECT_TYPES.FASTAPI,
        command: `uvicorn ${mainFile}:app --reload`,
        port: 8001, detected: true };
    }
    // ── Flask ──────────────────────────────────────────────────────────────
    if (reqs.includes('flask') || reqs.includes('Flask')) {
      return { ...result, type: PROJECT_TYPES.FLASK,
        command: 'flask run', port: 5000, detected: true };
    }
  }

  // ── Next.js ──────────────────────────────────────────────────────────────
  if (files.includes('package.json')) {
    const pkg = safeReadJson(path.join(projectPath, 'package.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps['next']) {
      return { ...result, type: PROJECT_TYPES.NEXTJS,
        command: 'npm run dev', port: 3000, detected: true };
    }

    // ── React (Create React App / Vite) ───────────────────────────────────
    if (deps['react']) {
      const cmd = pkg.scripts?.dev ? 'npm run dev' : 'npm start';
      return { ...result, type: PROJECT_TYPES.REACT,
        command: cmd, port: 3000, detected: true };
    }

    // ── Plain Node.js ─────────────────────────────────────────────────────
    const startScript = pkg.scripts?.start || pkg.scripts?.dev;
    if (startScript) {
      return { ...result, type: PROJECT_TYPES.NODEJS,
        command: 'npm start', port: 3001, detected: true };
    }
  }

  // ── Spring Boot ───────────────────────────────────────────────────────────
  if (files.includes('pom.xml')) {
    const pom = safeReadFile(path.join(projectPath, 'pom.xml'));
    if (pom.includes('spring-boot')) {
      return { ...result, type: PROJECT_TYPES.SPRING_BOOT,
        command: 'mvn spring-boot:run', port: 8080,
        ide: 'IntelliJ IDEA', detected: true };
    }
  }

  if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
    return { ...result, type: PROJECT_TYPES.SPRING_BOOT,
      command: './gradlew bootRun', port: 8080,
      ide: 'IntelliJ IDEA', detected: true };
  }

  // ── Laravel ───────────────────────────────────────────────────────────────
  if (files.includes('artisan') && files.includes('composer.json')) {
    return { ...result, type: PROJECT_TYPES.LARAVEL,
      command: 'php artisan serve', port: 8080, detected: true };
  }

  // ── Fallback: fill what we can ─────────────────────────────────────────
  return {
    ...result,
    command: DEFAULT_COMMANDS[result.type] || '',
    port:    DEFAULT_PORTS[result.type]    || null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function safeReadDir(dirPath) {
  try { return fs.readdirSync(dirPath); } catch { return []; }
}

function safeReadFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8').toLowerCase(); } catch { return ''; }
}

function safeReadJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return {}; }
}

export { detectProject };
