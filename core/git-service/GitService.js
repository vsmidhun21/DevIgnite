// core/git-service/GitService.js
import { execSync, exec } from 'child_process';
import fs   from 'fs';
import path from 'path';

export class GitService {
  /**
   * Get git info for a project path.
   * @returns {{ hasGit, branch, shortHash, isDirty, remoteUrl, ahead, behind }}
   */
  getInfo(projectPath) {
    if (!fs.existsSync(path.join(projectPath, '.git'))) {
      return { hasGit: false };
    }

    const run = (cmd) => {
      try {
        return execSync(cmd, { cwd: projectPath, stdio: 'pipe', timeout: 3000 })
          .toString().trim();
      } catch {
        return null;
      }
    };

    const branch    = run('git rev-parse --abbrev-ref HEAD');
    const shortHash = run('git rev-parse --short HEAD');
    const status    = run('git status --porcelain');
    const remoteUrl = run('git remote get-url origin 2>/dev/null');
    const aheadBehind = run('git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null');

    let ahead = 0, behind = 0;
    if (aheadBehind) {
      const parts = aheadBehind.split('\t');
      behind = parseInt(parts[0]) || 0;
      ahead  = parseInt(parts[1]) || 0;
    }

    return {
      hasGit:    true,
      branch:    branch    || 'HEAD',
      shortHash: shortHash || null,
      isDirty:   status !== null && status.length > 0,
      changedFiles: status ? status.split('\n').filter(Boolean).length : 0,
      remoteUrl: remoteUrl || null,
      ahead,
      behind,
    };
  }

  /**
   * Watch a project for branch changes (polls every 5s).
   * Returns an interval handle. Call clearInterval to stop.
   */
  watch(projectPath, onChange) {
    let lastBranch = null;
    const check = () => {
      const info = this.getInfo(projectPath);
      if (info.hasGit && info.branch !== lastBranch) {
        lastBranch = info.branch;
        onChange(info);
      }
    };
    check();
    return setInterval(check, 5000);
  }

  /**
   * Get git info for multiple paths at once.
   * @returns {Record<string, GitInfo>}
   */
  getBatch(projectPaths) {
    const result = {};
    for (const p of projectPaths) {
      result[p] = this.getInfo(p);
    }
    return result;
  }
}
