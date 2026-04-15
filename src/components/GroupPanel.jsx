// src/components/GroupPanel.jsx
// Workspace (group) detail panel with START ALL / STOP ALL.
import { useState } from 'react';

const api = window.devignite;

const fmt = (s) => {
  if (!s) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

export default function GroupPanel({ group, projects, ticks, onEdit, onDelete, onProjectSelect }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const members = projects.filter(p => group.projectIds.includes(p.id));
  const allRunning  = members.length > 0 && members.every(p => p.status === 'running');
  const anyRunning  = members.some(p => p.status === 'running');

  const handleStartAll = async () => {
    setLoading(true); setResults([]);
    const r = await api.groups.start(group.id);
    setResults(r.results || []);
    setLoading(false);
  };

  const handleStopAll = async () => {
    setLoading(true);
    await api.groups.stop(group.id);
    setResults([]);
    setLoading(false);
  };

  return (
    <div className="project-detail">
      <div className="detail-header">
        <div className="detail-title-block">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="group-color-dot" style={{ background: group.color }} />
            <h2 className="detail-title">{group.name}</h2>
          </div>
          <div className="detail-path">{members.length} projects in workspace</div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={onEdit}>Edit</button>
          <button className="btn danger small" onClick={onDelete}>Delete</button>
        </div>
      </div>

      {/* Action bar */}
      <div className="action-bar">
        <button
          className={`start-work-btn ${allRunning ? 'running' : ''} ${loading ? 'loading' : ''}`}
          onClick={allRunning ? handleStopAll : handleStartAll}
          disabled={loading || members.length === 0}
        >
          {loading ? <span className="btn-spinner" /> :
           allRunning ? <><span className="btn-icon stop-icon" /> Stop All</> :
                        <><span className="btn-icon play-icon" /> Start All</>}
        </button>
        {anyRunning && !allRunning && (
          <button className="action-btn danger" onClick={handleStopAll} disabled={loading}>
            Stop Running
          </button>
        )}
        {members.length > 0 && (
          <span className="work-today" style={{marginLeft:8}}>
            {members.filter(p=>p.status==='running').length}/{members.length} running
          </span>
        )}
      </div>

      {/* Member project cards */}
      <div className="group-members">
        {members.length === 0 && (
          <div className="steps-empty" style={{margin:'20px'}}>
            No projects in this workspace yet. Edit to add projects.
          </div>
        )}
        {members.map(p => {
          const live   = ticks?.[p.id];
          const result = results.find(r => r.projectId === p.id);
          return (
            <div
              key={p.id}
              className={`group-member-card ${p.status === 'running' ? 'running' : ''}`}
              onClick={() => onProjectSelect(p.id)}
            >
              <div className="gmc-left">
                <span className={`status-dot ${p.status || 'stopped'}`} style={{flexShrink:0}} />
                <div>
                  <div className="gmc-name">{p.name}</div>
                  <div className="gmc-meta">
                    <span className="type-badge-sm">{p.type?.split(' ')[0]}</span>
                    {p.port && <span className="gmc-port">:{p.port}</span>}
                    {p.git?.hasGit && p.git.branch && (
                      <span className="proj-branch">{p.git.branch}{p.git.isDirty ? '*' : ''}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="gmc-right">
                {live != null && p.status === 'running' && (
                  <span className="live-timer">{fmt(live)}</span>
                )}
                {result && !result.ok && (
                  <span className="gmc-error" title={result.error}>✗</span>
                )}
                {result?.ok && (
                  <span className="gmc-ok">✓</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
