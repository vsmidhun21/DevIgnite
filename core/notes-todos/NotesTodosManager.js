import { getDb } from '../db/database.js';

export class NotesTodosManager {
  constructor(dbPath) {
    this.db = getDb(dbPath);
    this._stmts = {
      getNote: this.db.prepare('SELECT content FROM notes WHERE type = ? AND refId = ?'),
      saveNote: this.db.prepare('INSERT INTO notes (type, refId, content, updated_at) VALUES (?, ?, ?, datetime(\'now\')) ON CONFLICT(type, refId) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at'),
      getTodos: this.db.prepare('SELECT * FROM todos WHERE type = ? AND refId = ? ORDER BY created_at ASC'),
      addTodo: this.db.prepare('INSERT INTO todos (type, refId, text) VALUES (?, ?, ?)'),
      toggleTodo: this.db.prepare('UPDATE todos SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END WHERE id = ?'),
      deleteTodo: this.db.prepare('DELETE FROM todos WHERE id = ?')
    };
  }

  getNote(type, refId) {
    const row = this._stmts.getNote.get(type, refId);
    return row ? row.content : '';
  }

  saveNote(type, refId, content) {
    this._stmts.saveNote.run(type, refId, content);
    return { ok: true };
  }

  getTodos(type, refId) {
    return this._stmts.getTodos.all(type, refId).map(t => ({ ...t, completed: t.completed === 1 }));
  }

  addTodo(type, refId, text) {
    const r = this._stmts.addTodo.run(type, refId, text);
    return this.db.prepare('SELECT * FROM todos WHERE id = ?').get(r.lastInsertRowid);
  }

  toggleTodo(id) {
    this._stmts.toggleTodo.run(id);
    return { ok: true };
  }

  deleteTodo(id) {
    this._stmts.deleteTodo.run(id);
    return { ok: true };
  }
}
