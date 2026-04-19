import { useState, useEffect, useCallback } from 'react';
import { Save, Plus, Trash2, CheckSquare, Square } from 'lucide-react';

const api = window.devignite;

export default function NotesTodosPanel({ type, refId }) {
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');

  const loadData = useCallback(async () => {
    if (!refId) return;
    const [n, t] = await Promise.all([
      api.notes.get(type, refId),
      api.todos.get(type, refId)
    ]);
    setNote(n || '');
    setTodos(t || []);
  }, [type, refId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveNote = async () => {
    setSavingNote(true);
    await api.notes.save(type, refId, note);
    setTimeout(() => setSavingNote(false), 800);
  };

  const handleWordLimit = (e) => {
    const val = e.target.value;
    const words = val.trim().split(/\s+/);
    if (words.length > 500 && words[0] !== "") {
      return;
    }
    setNote(val);
  };

  const addTodo = async (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      if (!newTodo.trim()) return;
      await api.todos.add(type, refId, newTodo.trim());
      setNewTodo('');
      loadData();
    }
  };

  const toggleTodo = async (id) => {
    await api.todos.toggle(id);
    loadData();
  };

  const deleteTodo = async (id) => {
    await api.todos.delete(id);
    loadData();
  };

  const wordCount = note.trim() ? note.trim().split(/\s+/).length : 0;

  return (
    <div className="notes-todos-panel" style={{display:'flex', flexDirection:'column', gap:0}}>
      <section style={{marginBottom: 20}}>
        <div className="section-label" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span>Notes</span>
          <button className="btn small primary" onClick={saveNote} disabled={savingNote}>
            {savingNote ? 'Saved!' : <><Save size={11} strokeWidth={2}/> Save</>}
          </button>
        </div>
        <textarea
          style={{width:'100%', padding:'8px 10px', fontSize:12, fontFamily:'var(--font)', border:'1px solid var(--b1)', borderRadius:6, background:'var(--bg1)', color:'var(--t0)', outline:'none', resize:'vertical'}}
          value={note}
          onChange={handleWordLimit}
          placeholder="Jot down notes, links, or ideas... (Max 500 words)"
          rows={5}
        />
        <div style={{fontSize: 10, color: 'var(--t2)', textAlign: 'right', marginTop: 4}}>
          {wordCount} / 500 words
        </div>
      </section>

      <section>
        <div className="section-label">Todos</div>
        <div className="todos-container">
          <div className="todo-input-row" style={{display:'flex', gap:6, marginBottom:10}}>
            <input
              type="text"
              value={newTodo}
              onChange={e => setNewTodo(e.target.value)}
              onKeyDown={addTodo}
              placeholder="Add a new task..."
              style={{flex:1, padding:'6px 10px', fontSize:12, fontFamily:'var(--font)', border:'1px solid var(--b1)', borderRadius:6, background:'var(--bg1)', color:'var(--t0)', outline:'none'}}
            />
            <button className="btn primary" onClick={addTodo}><Plus size={14} strokeWidth={2}/></button>
          </div>
          
            <div className="todos-list">
              {todos.length === 0 && <div className="checklist-empty">No todos yet.</div>}
              {todos.map(t => (
                <div key={t.id} className={`todo-item ${t.completed ? 'completed' : ''}`}>
                  <button 
                    className="todo-check-btn" 
                    onClick={() => toggleTodo(t.id)}
                  >
                    {t.completed ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                  <span className="todo-text">
                    {t.text}
                  </span>
                  <button className="todo-delete-btn" onClick={() => deleteTodo(t.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
        </div>
      </section>
    </div>
  );
}
