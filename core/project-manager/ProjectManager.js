// core/project-manager/ProjectManager.js
import { getDb } from '../db/database.js';
// const { getDb } = require('../db/database');

export class ProjectManager {
  constructor(dbPath) {
    this.db = getDb(dbPath);
    this._stmts = {
      listAll: this.db.prepare('SELECT * FROM projects ORDER BY name ASC'),
      getById: this.db.prepare('SELECT * FROM projects WHERE id = ?'),
      insert: this.db.prepare(`
        INSERT INTO projects (name, path, type, command, ide, port, active_env, startup_steps)
        VALUES (@name, @path, @type, @command, @ide, @port, @active_env, @startup_steps)
      `),
      update: this.db.prepare(`
        UPDATE projects
        SET name=@name, path=@path, type=@type, command=@command,
            ide=@ide, port=@port, active_env=@active_env, startup_steps=@startup_steps,
            updated_at=datetime('now')
        WHERE id=@id
      `),
      delete: this.db.prepare('DELETE FROM projects WHERE id = ?'),
      setEnv: this.db.prepare("UPDATE projects SET active_env=? WHERE id=?"),
    };
  }

  listAll() { return this._stmts.listAll.all(); }
  getById(id) { return this._stmts.getById.get(id) ?? null; }

  add(data) {
    this._validate(data);
    const row = {
      name: data.name.trim(),
      path: data.path.trim(),
      type: data.type || 'Custom',
      command: data.command?.trim() || '',
      ide: data.ide || 'VS Code',
      port: data.port ?? null,
      active_env: data.env || 'dev',
      startup_steps: data.startup_steps
        ? JSON.stringify(data.startup_steps)
        : '[]',
    };
    const result = this._stmts.insert.run(row);
    this._seedEnvironments(result.lastInsertRowid);
    return { id: result.lastInsertRowid, project: this.getById(result.lastInsertRowid) };
  }

  update(id, data) {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Project ${id} not found`);
    const merged = {
      id,
      name: data.name ?? existing.name,
      path: data.path ?? existing.path,
      type: data.type ?? existing.type,
      command: data.command ?? existing.command,
      ide: data.ide ?? existing.ide,
      port: data.port ?? existing.port,
      active_env: data.env ?? existing.active_env,
      startup_steps: data.startup_steps != null
        ? JSON.stringify(data.startup_steps)
        : existing.startup_steps,
    };
    this._stmts.update.run(merged);
    return this.getById(id);
  }

  delete(id) { return this._stmts.delete.run(id).changes > 0; }

  setActiveEnv(id, env) {
    if (!['dev', 'staging', 'prod'].includes(env)) throw new Error(`Invalid env: ${env}`);
    this._stmts.setEnv.run(env, id);
    return this.getById(id);
  }

  _validate(data) {
    if (!data.name?.trim()) throw new Error('Project name is required');
    if (!data.path?.trim()) throw new Error('Project path is required');
  }

  _seedEnvironments(projectId) {
    this.db.prepare(
      `INSERT OR IGNORE INTO environments (project_id, name) VALUES (?,?),(?,?),(?,?)`
    ).run(projectId, 'dev', projectId, 'staging', projectId, 'prod');
  }
}

// module.exports = ProjectManager;
