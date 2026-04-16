import { useState } from 'react';

const COLORS = ['#1a6ef5','#f55d1e','#16a34a','#d97706','#7c3aed','#db2777','#0891b2','#65a30d'];

export default function GroupModal({ group, projects, onSave, onClose }) {
  const [name,        setName]        = useState(group?.name       || '');
  const [color,       setColor]       = useState(group?.color      || COLORS[0]);
  const [selectedIds, setSelectedIds] = useState(group?.projectIds || []);

  const toggle = (id) => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color, projectIds: selectedIds });
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 480 }}>
        <div className="modal-header">
          <h3>{group ? 'Edit workspace' : 'New workspace'}</h3>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="FullStack App" autoFocus />
          </div>
          <div className="field">
            <label>Color</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <button key={c} className={`color-dot ${color===c?'selected':''}`}
                  style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
          <div className="field">
            <label>Projects</label>
            <div className="project-checklist">
              {projects.length === 0 && (
                <div className="checklist-empty">No projects added yet.</div>
              )}
              {projects.map(p => (
                <label key={p.id} className="checklist-row">
                  <input type="checkbox" checked={selectedIds.includes(p.id)}
                    onChange={() => toggle(p.id)} />
                  <span className={`status-dot ${p.status||'stopped'}`} />
                  <span className="checklist-name">{p.name}</span>
                  <span className="type-badge-sm">{p.type?.split(' ')[0]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={!name.trim()}>
            {group ? 'Save changes' : 'Create workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}
