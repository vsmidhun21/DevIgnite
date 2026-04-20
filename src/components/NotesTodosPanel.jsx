import { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, Plus, Trash2, CheckSquare, Square, BarChart2, Clock, History } from 'lucide-react';

const api = window.devignite;

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${s}s`].filter(Boolean).join(' ');
};

export function NotesSection({ type, refId, note, setNote, onSave, savingNote }) {
  const handleWordLimit = (val) => {
    const words = val.trim().split(/\s+/);
    if (words.length > 500 && words[0] !== "") return;
    setNote(val);
  };

  const wordCount = note.trim() ? note.trim().split(/\s+/).length : 0;

  return (
    <section>
      <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Notes</span>
        <button className="btn small primary" onClick={onSave} disabled={savingNote}>
          {savingNote ? 'Saved!' : <><Save size={11} strokeWidth={2}/> Save</>}
        </button>
      </div>
      <div style={{ position: 'relative' }}>
        <textarea
          style={{
            width:'100%', padding:'12px', fontSize:12, fontFamily:'var(--font)', 
            border:'1px solid var(--b1)', borderRadius:8, background:'var(--bg1)', 
            color:'var(--t0)', outline:'none', resize:'vertical', minHeight: '120px',
            maxHeight: '400px', lineHeight: '1.5'
          }}
          value={note}
          onChange={(e) => handleWordLimit(e.target.value)}
          placeholder="Jot down important details..."
          rows={6}
        />
      </div>
      <div style={{ fontSize: 10, color: 'var(--t2)', textAlign: 'right', marginTop: 4 }}>
        {wordCount} / 500 words
      </div>
    </section>
  );
}

export function TodoSection({ type, refId, todos, newTodo, setNewTodo, onAdd, onToggle, onDelete }) {
  return (
    <section>
      <div className="section-label" style={{ marginBottom: 12 }}>Todo List</div>
      <div className="todos-container">
        <div className="todo-input-row" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <input
            type="text"
            value={newTodo}
            onChange={e => setNewTodo(e.target.value)}
            onKeyDown={onAdd}
            placeholder="Add a task..."
            style={{ flex: 1, padding: '8px 12px', fontSize: 12, fontFamily: 'var(--font)', border: '1px solid var(--b1)', borderRadius: 6, background: 'var(--bg1)', color: 'var(--t0)', outline: 'none' }}
          />
          <button className="btn primary small" onClick={onAdd} style={{ padding: '0 12px' }}><Plus size={16}/></button>
        </div>
        <div className="todos-list">
          {todos.length === 0 && <div style={{ fontSize: '11px', opacity: 0.5, padding: '8px 0', textAlign: 'center' }}>No active tasks.</div>}
          {todos.map(t => (
            <div key={t.id} className={`todo-item ${t.completed ? 'completed' : ''}`} style={{ padding: '8px 0', borderBottom: '1px solid var(--b0)' }}>
              <button className="todo-check-btn" onClick={() => onToggle(t.id)}>
                {t.completed ? <CheckSquare size={14} color="var(--green)" /> : <Square size={14} />}
              </button>
              <span className="todo-text" style={{ fontSize: '12px', flex: 1, marginLeft: 10 }}>{t.text}</span>
              <button className="todo-delete-btn" onClick={() => onDelete(t.id)} style={{ opacity: 0.4 }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WorkInsightsSection({ stats, chartData, manualHours, setManualHours, manualMins, setManualMins, manualNote, setManualNote, onLog, isLogging }) {
  return (
    <section>
      <div className="section-title" style={{ color: 'var(--t1)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <BarChart2 size={14} color="var(--ignite)"/> Work Intelligence
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Weekly Effort Chart */}
        <div className="insights-card" style={{ background: 'var(--bg1)', border: '1px solid var(--b0)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'var(--t2)', fontWeight: 700, marginBottom: 12 }}>
             LAST 7 DAYS ACTIVITY
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '50px', gap: '4px', padding: '0 2px' }}>
            {chartData.map((secs, i) => {
              const max = Math.max(...chartData, 3600);
              const pct = Math.max(8, (secs / max) * 100);
              const isToday = i === 6;
              return (
                <div key={i} 
                  style={{ 
                    flex: 1, height: `${pct}%`, 
                    background: isToday ? 'var(--ignite)' : 'var(--b2)', 
                    borderRadius: '3px 3px 0 0', position: 'relative'
                  }} 
                  title={formatDuration(secs)} 
                >
                  {isToday && <div style={{ position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)', fontSize: '8px', color: 'var(--ignite)', fontWeight: 700 }}>NOW</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Manual Entry Form */}
        <div className="insights-card" style={{ background: 'var(--bg1)', border: '1px solid var(--b0)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Clock size={13} color="var(--t2)"/>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t1)' }}>QUICK TIME LOG</span>
          </div>
          
          <form onSubmit={onLog} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                 <label style={{ fontSize: '9px', color: 'var(--t2)', display: 'block', marginBottom: 4 }}>HOURS</label>
                 <input type="number" min="0" max="24" value={manualHours} onChange={e=>setManualHours(e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '12px', background: 'var(--bg0)', border: '1px solid var(--b1)', borderRadius: 6, color: 'var(--t0)', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                 <label style={{ fontSize: '9px', color: 'var(--t2)', display: 'block', marginBottom: 4 }}>MINUTES</label>
                 <input type="number" min="0" max="59" value={manualMins} onChange={e=>setManualMins(e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '12px', background: 'var(--bg0)', border: '1px solid var(--b1)', borderRadius: 6, color: 'var(--t0)', outline: 'none' }} />
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '9px', color: 'var(--t2)', display: 'block', marginBottom: 4 }}>WORK DESCRIPTION</label>
              <input 
                type="text" 
                placeholder="What did you do?" 
                value={manualNote} 
                onChange={e => setManualNote(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '12px', background: 'var(--bg0)', border: '1px solid var(--b1)', borderRadius: 6, color: 'var(--t0)', outline: 'none' }}
              />
            </div>

            <button 
              type="submit" 
              disabled={isLogging} 
              style={{ 
                background: 'var(--ignite)', border: 'none', color: '#fff', 
                padding: '10px', fontSize: '12px', borderRadius: 6, cursor: 'pointer',
                fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 4, transition: 'all 0.2s'
              }}
            >
              <Plus size={14}/> {isLogging ? 'Logging...' : 'Log Time Entry'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default function NotesTodosPanel({ type, refId, onlySection }) {
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [stats, setStats] = useState(null);
  const [manualHours, setManualHours] = useState('1');
  const [manualMins, setManualMins] = useState('0');
  const [manualNote, setManualNote] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  const loadData = useCallback(async () => {
    if (!refId) return;
    const [n, t, s] = await Promise.all([
      api.notes.get(type, refId),
      api.todos.get(type, refId),
      api.time.productivity(refId)
    ]);
    setNote(n || '');
    setTodos(t || []);
    setStats(s);
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

  const addManualTime = async (e) => {
    e.preventDefault();
    if (!refId) {
      console.error('WorkInsights: No project ID');
      return;
    }
    const h = parseInt(manualHours) || 0;
    const m = parseInt(manualMins) || 0;
    const secs = h * 3600 + m * 60;
    
    if (secs <= 0) return;
    
    setIsLogging(true);
    try {
      await api.time.addManual(refId, secs, manualNote);
      setManualNote('');
      setManualHours('1');
      setManualMins('0');
      loadData();
    } catch (err) {
      console.error('Failed to log time:', err);
    } finally {
      setIsLogging(false);
    }
  };

  const chartData = useMemo(() => {
    if (!stats?.daily) return [];
    const results = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const Y = date.getFullYear();
      const M = String(date.getMonth() + 1).padStart(2, '0');
      const D = String(date.getDate()).padStart(2, '0');
      const ds = `${Y}-${M}-${D}`;
      const match = stats.daily.find(x => x.day === ds);
      results.push(match ? match.seconds : 0);
    }

    return results;
  }, [stats]);

  const wordCount = note.trim() ? note.trim().split(/\s+/).length : 0;

  if (onlySection === 'notes') return <NotesSection note={note} setNote={setNote} onSave={saveNote} savingNote={savingNote} />;
  if (onlySection === 'todos') return <TodoSection todos={todos} newTodo={newTodo} setNewTodo={setNewTodo} onAdd={addTodo} onToggle={toggleTodo} onDelete={deleteTodo} />;
  if (onlySection === 'insights') return <WorkInsightsSection stats={stats} chartData={chartData} manualHours={manualHours} setManualHours={setManualHours} manualMins={manualMins} setManualMins={setManualMins} manualNote={manualNote} setManualNote={setManualNote} onLog={addManualTime} isLogging={isLogging} />;

  return (
    <div className="notes-todos-panel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <NotesSection note={note} setNote={setNote} onSave={saveNote} savingNote={savingNote} />
      <TodoSection todos={todos} newTodo={newTodo} setNewTodo={setNewTodo} onAdd={addTodo} onToggle={toggleTodo} onDelete={deleteTodo} />
      <WorkInsightsSection stats={stats} chartData={chartData} manualHours={manualHours} setManualHours={setManualHours} manualMins={manualMins} setManualMins={setManualMins} manualNote={manualNote} setManualNote={setManualNote} onLog={addManualTime} isLogging={isLogging} />
    </div>
  );
}
