// core/git-service/GitService.js
import { exec } from 'child_process';
import fs   from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitService {
  /**
   * Get git info for a project path (Async).
   * @returns {Promise<{ hasGit, branch, shortHash, isDirty, changedFiles, remoteUrl, ahead, behind }>}
   */
  async getInfoAsync(projectPath) {
    if (!fs.existsSync(path.join(projectPath, '.git'))) {
      return { hasGit: false };
    }

    try {
      // Combined command for efficiency
      const commands = [
        'git rev-parse --abbrev-ref HEAD',
        'git rev-parse --short HEAD',
        'git status --porcelain',
        'git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null',
        'git remote get-url origin 2>/dev/null'
      ];
      
      const results = await Promise.all(commands.map(cmd => 
        execAsync(cmd, { cwd: projectPath, timeout: 3000 }).then(r => r.stdout.trim()).catch(() => null)
      ));

      const [branch, shortHash, status, aheadBehind, remoteUrl] = results;

      let ahead = 0, behind = 0;
      if (aheadBehind) {
        const parts = aheadBehind.split(/\s+/);
        behind = parseInt(parts[0]) || 0;
        ahead  = parseInt(parts[1]) || 0;
      }

      return {
        hasGit: true,
        branch: branch || 'HEAD',
        shortHash: shortHash || null,
        isDirty: status !== null && status.length > 0,
        changedFiles: status ? status.split('\n').filter(Boolean).length : 0,
        remoteUrl: remoteUrl || null,
        ahead,
        behind,
      };
    } catch {
      return { hasGit: false };
    }
  }

  /**
   * Synchronous version (fallback/legacy) - kept but made safer
   */
  getInfo(projectPath) {
     if (!fs.existsSync(path.join(projectPath, '.git'))) return { hasGit: false };
     return { hasGit: true, branch: 'loading...' };
  }

  /**
   * Get git info for multiple paths at once (Async).
   */
  async getBatchAsync(projectPaths) {
    const results = await Promise.all(projectPaths.map(p => this.getInfoAsync(p)));
    const map = {};
    projectPaths.forEach((p, i) => map[p] = results[i]);
    return map;
  }

  getBatch(projectPaths) {
    const result = {};
    for (const p of projectPaths) result[p] = this.getInfo(p);
    return result;
  }
}

