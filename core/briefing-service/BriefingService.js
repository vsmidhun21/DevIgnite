import fs from 'fs';
import path from 'path';
import { getDb } from '../db/database.js';
import { Scanner } from '../code-health/scanner.js';

export class BriefingService {
  constructor(dbPath, gitService) {
    this.db = getDb(dbPath);
    this.gitService = gitService;
  }

  /**
   * Determine if the briefing should be shown today for a project.
   */
  shouldShow(projectId) {
    const today = new Date().toISOString().split('T')[0];
    const row = this.db.prepare('SELECT last_shown_date FROM project_briefings WHERE project_id = ?').get(projectId);
    
    if (!row) return true;
    return row.last_shown_date !== today;
  }

  /**
   * Mark the briefing as shown for today.
   */
  markShown(projectId) {
    const today = new Date().toISOString().split('T')[0];
    this.db.prepare('INSERT INTO project_briefings (project_id, last_shown_date) VALUES (?, ?) ON CONFLICT(project_id) DO UPDATE SET last_shown_date = excluded.last_shown_date')
      .run(projectId, today);
  }

  /**
   * Gather all data for the briefing.
   */
  async getBriefingData(projectId, projectPath) {
    // 1. Git Info
    const lastCommit = await this.gitService.getLastCommitAsync(projectPath);
    const gitInfo = await this.gitService.getInfoAsync(projectPath);

    // 2. Project Todos from Database
    const dbTodos = this.db.prepare('SELECT * FROM todos WHERE type = ? AND refId = ? AND completed = 0 ORDER BY created_at DESC').all('project', projectId);

    // 3. Scan for TODO/FIXME in code files
    const fileTodos = await this.scanForTodos(projectPath);

    return {
      projectId,
      git: {
        ...gitInfo,
        lastCommit
      },
      todos: [
        ...dbTodos.map(t => ({ type: 'APP', text: t.text, source: 'app' })),
        ...fileTodos.map(t => ({ ...t, source: 'file' }))
      ],
      // We use Git's last changed files as "resume" data
      resume: {
        lastFiles: lastCommit?.changedFiles || []
      }
    };
  }

  async scanForTodos(projectPath) {
    try {
      const files = await Scanner.scanFiles(projectPath, 'full');
      const results = [];
      const regex = /\/\/\s*(TODO|FIXME):?\s*(.*)/gi;

      // Limit files to scan to avoid performance issues (e.g., first 200 files)
      const scanLimit = files.slice(0, 200);

      for (const filePath of scanLimit) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            let match;
            // Reset regex lastIndex since it's global
            regex.lastIndex = 0;
            while ((match = regex.exec(line)) !== null) {
              results.push({
                file: path.relative(projectPath, filePath),
                fullPath: filePath,
                line: index + 1,
                type: match[1].toUpperCase(),
                text: match[2].trim()
              });
            }
          });
        } catch (e) {
          // Skip files that can't be read
        }
        
        // Stop if we found too many todos to keep it clean
        if (results.length > 50) break;
      }

      return results;
    } catch (e) {
      console.error('Todo scan error:', e);
      return [];
    }
  }
}
