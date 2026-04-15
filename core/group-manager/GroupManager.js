// core/group-manager/GroupManager.js
import { getDb } from '../db/database.js';

export class GroupManager {
  constructor(dbPath) {
    this.db = getDb(dbPath);
    this._stmts = {
      listAll:  this.db.prepare('SELECT * FROM groups ORDER BY name ASC'),
      getById:  this.db.prepare('SELECT * FROM groups WHERE id = ?'),
      getByName:this.db.prepare('SELECT * FROM groups WHERE name = ?'),
      insert:   this.db.prepare(`INSERT INTO groups (name, project_ids, color) VALUES (@name, @project_ids, @color)`),
      update:   this.db.prepare(`UPDATE groups SET name=@name, project_ids=@project_ids, color=@color, updated_at=datetime('now') WHERE id=@id`),
      delete:   this.db.prepare('DELETE FROM groups WHERE id = ?'),
    };
  }

  listAll() {
    return this._stmts.listAll.all().map(this._parse);
  }

  getById(id) {
    const g = this._stmts.getById.get(id);
    return g ? this._parse(g) : null;
  }

  add({ name, projectIds = [], color = '#1a6ef5' }) {
    if (!name?.trim()) throw new Error('Group name required');
    const result = this._stmts.insert.run({
      name: name.trim(),
      project_ids: JSON.stringify(projectIds),
      color,
    });
    return this.getById(result.lastInsertRowid);
  }

  update(id, { name, projectIds, color }) {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Group ${id} not found`);
    this._stmts.update.run({
      id,
      name:        name        ?? existing.name,
      project_ids: JSON.stringify(projectIds ?? existing.projectIds),
      color:       color       ?? existing.color,
    });
    return this.getById(id);
  }

  delete(id) { return this._stmts.delete.run(id).changes > 0; }

  addProject(groupId, projectId) {
    const group = this.getById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);
    const ids = [...new Set([...group.projectIds, projectId])];
    return this.update(groupId, { projectIds: ids });
  }

  removeProject(groupId, projectId) {
    const group = this.getById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);
    return this.update(groupId, { projectIds: group.projectIds.filter(id => id !== projectId) });
  }

  _parse(row) {
    return {
      ...row,
      projectIds: (() => { try { return JSON.parse(row.project_ids || '[]'); } catch { return []; } })(),
    };
  }
}
