import { getDb } from '../db/database.js';

export class ActionManager {
  constructor(dbPath) {
    this.db = getDb(dbPath);
  }

  getActions(projectId) {
    let list = this.db.prepare('SELECT * FROM actions WHERE projectId = ?').all(projectId);
    if (list.length === 0) {
      const p = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
      if (p) {
        const type = (p.type || '').toLowerCase();
        let added = false;
        if (type.includes('react') || type.includes('node') || type.includes('next') || type.includes('vue')) {
           this.addAction(projectId, 'Build', 'npm run build');
           this.addAction(projectId, 'Test', 'npm test');
           added = true;
        } else if (type.includes('spring')) {
           this.addAction(projectId, 'Build', 'mvn package');
           added = true;
        }
        if (added) {
           list = this.db.prepare('SELECT * FROM actions WHERE projectId = ?').all(projectId);
        }
      }
    }
    return list;
  }

  addAction(projectId, name, command) {
    const r = this.db.prepare('INSERT INTO actions (projectId, name, command) VALUES (?, ?, ?)').run(projectId, name, command);
    return { id: r.lastInsertRowid, projectId, name, command };
  }

  deleteAction(id) {
    this.db.prepare('DELETE FROM actions WHERE id = ?').run(id);
    return { ok: true };
  }
}
