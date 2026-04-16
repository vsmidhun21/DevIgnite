import { useState } from 'react';

const COLORS = ['#1a6ef5', '#f55d1e', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];

export default function GroupModal({ group, projects, onSave, onClose }) {
  const [name, setName] = useState(group?.name || '');
  const [color, setColor] = useState(group?.color || COLORS[0]);
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
                <button key={c} className={`color-dot ${color === c ? 'selected' : ''}`}
                  style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
          <div className="field">
            <style>{`
              .improved-checklist {
                max-height: 300px;
                overflow-y: auto;
                overflow-x: hidden;
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding: 4px;
                border: 1px solid var(--b0);
                border-radius: 6px;
                background: var(--bg0);
              }
              .improved-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 10px;
                cursor: pointer;
                border-radius: 4px;
                background: transparent;
                transition: background 0.1s ease;
                width: 100%;
              }
              .improved-row:hover {
                background: var(--bg1);
              }
              .improved-row.selected {
                background: var(--bg2);
              }
              .improved-row-center {
                flex: 1;
                margin: 0 10px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 13px;
                color: var(--t1);
              }
              .improved-row.selected .improved-row-center {
                color: var(--t0);
              }
              .improved-row-checkbox {
                flex-shrink: 0;
                margin: 0;
                max-width: fit-content;
                max-height: fit-content;
              }
            `}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ margin: 0 }}>Projects</label>
              <span style={{ fontSize: '11px', color: 'var(--t2)' }}>
                {selectedIds.length} project{selectedIds.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="improved-checklist">
              {projects.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--t2)', fontSize: '12px' }}>
                  No projects available
                </div>
              ) : (
                projects.map(p => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`improved-row ${isSelected ? 'selected' : ''}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggle(p.id);
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(p.id)}
                        className="improved-row-checkbox"
                        tabIndex={-1}
                      />
                      <span className="improved-row-center">
                        {p.name}
                      </span>
                      <span className="type-badge-sm" style={{ flexShrink: 0 }}>
                        {p.type?.split(' ')[0] || 'Unknown'}
                      </span>
                    </label>
                  );
                })
              )}
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
