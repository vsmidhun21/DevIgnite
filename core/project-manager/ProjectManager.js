import { getDb } from '../db/database.js';

export class ProjectManager {
  constructor(dbPath) {
    this.db = getDb(dbPath);
    this._stmts = {
      listAll: this.db.prepare('SELECT * FROM projects ORDER BY isPinned DESC, name COLLATE NOCASE ASC'),
      getById: this.db.prepare('SELECT * FROM projects WHERE id = ?'),
      insert: this.db.prepare(`
        INSERT INTO projects
          (name, path, type, archived, command, ide, ide_path, port, url,
           active_env, env_file, startup_steps,
           open_terminal, open_browser, install_deps)
        VALUES
          (@name, @path, @type, @archived, @command, @ide, @ide_path, @port, @url,
           @active_env, @env_file, @startup_steps,
           @open_terminal, @open_browser, @install_deps)
      `),
      update: this.db.prepare(`
        UPDATE projects SET
          name=@name, path=@path, type=@type, archived=@archived, command=@command,
          ide=@ide, ide_path=@ide_path, port=@port, url=@url,
          active_env=@active_env, env_file=@env_file,
          startup_steps=@startup_steps,
          open_terminal=@open_terminal, open_browser=@open_browser,
          install_deps=@install_deps,
          updated_at=datetime('now')
        WHERE id=@id
      `),
      delete:  this.db.prepare('DELETE FROM projects WHERE id = ?'),
      setEnv:  this.db.prepare('UPDATE projects SET active_env=? WHERE id=?'),
    };
  }

  listAll()   { return this._stmts.listAll.all(); }
  getById(id) { return this._stmts.getById.get(id) ?? null; }

  add(data) {
    this._validate(data);
    const row = this._toRow(data);
    const result = this._stmts.insert.run(row);
    return { id: result.lastInsertRowid, project: this.getById(result.lastInsertRowid) };
  }

  update(id, data) {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Project ${id} not found`);
    const merged = { ...this._fromRow(existing), ...data, id };
    this._stmts.update.run(this._toRow(merged, id));
    return this.getById(id);
  }

  delete(id) { return this._stmts.delete.run(id).changes > 0; }

  setActiveEnv(id, env) {
    this._stmts.setEnv.run(env, id);
    return this.getById(id);
  }

  togglePin(id) {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Project ${id} not found`);
    const newPin = existing.isPinned ? 0 : 1;
    this.db.prepare('UPDATE projects SET isPinned = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newPin, id);
    return this.getById(id);
  }

  _validate(data) {
    if (!data.name?.trim()) throw new Error('Project name is required');
    if (!data.path?.trim()) throw new Error('Project path is required');
  }

  _toRow(data, id) {
    return {
      ...(id !== undefined ? { id } : {}),
      name:          data.name?.trim()    ?? '',
      path:          data.path?.trim()    ?? '',
      type:          data.type            ?? 'Custom',
      archived:      data.archived != null ? (data.archived ? 1 : 0) : 0,
      command:       data.command?.trim() ?? '',
      ide:           data.ide             ?? 'VS Code',
      ide_path:      data.ide_path        ?? null,
      port:          data.port            ?? null,
      url:           data.url             ?? null,
      active_env:    data.env             ?? data.active_env ?? 'dev',
      env_file:      data.env_file        ?? null,
      startup_steps: Array.isArray(data.startup_steps)
                       ? JSON.stringify(data.startup_steps)
                       : (data.startup_steps ?? '[]'),
      open_terminal: data.open_terminal != null ? (data.open_terminal ? 1 : 0) : 1,
      open_browser:  data.open_browser  != null ? (data.open_browser  ? 1 : 0) : 1,
      install_deps:  data.install_deps  != null ? (data.install_deps  ? 1 : 0) : 0,
      isPinned:      data.isPinned != null ? (data.isPinned ? 1 : 0) : 0,
    };
  }

  _fromRow(row) {
    return {
      name: row.name, path: row.path, type: row.type,
      archived: row.archived === 1 || row.archived === true,
      command: row.command, ide: row.ide, ide_path: row.ide_path,
      port: row.port, url: row.url,
      env: row.active_env, env_file: row.env_file,
      startup_steps: row.startup_steps,
      open_terminal: row.open_terminal, open_browser: row.open_browser,
      install_deps: row.install_deps,
      isPinned: row.isPinned === 1 || row.isPinned === true,
    };
  }
}
