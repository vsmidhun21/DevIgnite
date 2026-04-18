import { useState } from 'react';
import { Search, X, Plus, Star } from 'lucide-react';

const fmt = (s) => {
  if (!s) return null;
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return [h>0&&`${h}h`,m>0&&`${m}m`,`${sec}s`].filter(Boolean).join(' ');
};

export default function Sidebar({
  projects, groups, selectedId, selectedGroupId,
  ticks, onSelect, onSelectGroup, onAdd, onAddGroup,
  onTogglePinProject, onTogglePinGroup
}) {
  const [search, setSearch] = useState('');

  const filtered = projects.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.type?.toLowerCase().includes(search.toLowerCase())
  );

  const running = projects.filter(p => p.status === 'running').length;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
              fill="var(--ignite)" stroke="var(--ignite)" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="sidebar-brand-name">DevIgnite</span>
      </div>

      <div className="sidebar-search-wrap">
        <Search size={11} strokeWidth={2} className="search-icon"/>
        <input
          className="sidebar-search"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')}>
            <X size={11} strokeWidth={2}/>
          </button>
        )}
      </div>

      {groups.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-label">Workspaces</span>
            <button className="btn-add-inline" onClick={onAddGroup} title="New workspace">
              <Plus size={11} strokeWidth={2.5}/>
            </button>
          </div>
          {groups.map(g => {
            const gps      = projects.filter(p => g.projectIds.includes(p.id));
            const anyRun   = gps.some(p => p.status === 'running');
            const allRun   = gps.length > 0 && gps.every(p => p.status === 'running');
            return (
              <div key={g.id}
                className={`group-item ${g.id===selectedGroupId?'active':''}`}
                onClick={() => onSelectGroup(g.id)}>
                <span className="group-dot" style={{ background: g.color }}/>
                <div className="proj-info">
                  <span className="proj-name">{g.name}</span>
                  <span className="proj-today">{gps.length} projects</span>
                </div>
                <button className={`pin-btn ${g.isPinned ? 'pinned' : ''}`} onClick={(e) => onTogglePinGroup?.(g.id, e)} title="Pin workspace">
                  <Star size={12} strokeWidth={2.5} fill={g.isPinned ? 'currentColor' : 'none'} />
                </button>
                <span className={`group-status-dot ${allRun?'running':anyRun?'partial':''}`}/>
              </div>
            );
          })}
        </div>
      )}

      <div className="sidebar-section flex-1">
        <div className="sidebar-section-header">
          <span className="sidebar-section-label">
            Projects {search ? `(${filtered.length})` : running > 0 ? `· ${running} running` : ''}
          </span>
          <button className="btn-add-inline" onClick={onAdd} title="Add project">
            <Plus size={11} strokeWidth={2.5}/>
          </button>
        </div>

        <ul className="project-list">
          {filtered.map(p => {
            const live = ticks?.[p.id];
            const git  = p.git;
            return (
              <li key={p.id}
                className={`project-item ${p.id===selectedId?'active':''}`}
                onClick={() => onSelect(p.id)}>
                <span className={`status-dot ${p.status||'stopped'}`}/>
                <div className="proj-info">
                  <div className="proj-name-row">
                    <span className="proj-name">{p.name}</span>
                    {git?.hasGit && git.branch && (
                      <span className="proj-branch">{git.branch}{git.isDirty?'*':''}</span>
                    )}
                  </div>
                  <div className="proj-meta-row">
                    <span className="type-badge-sm">{p.type?.split(' ')[0]}</span>
                    {live != null && p.status === 'running'
                      ? <span className="proj-timer">{fmt(live)}</span>
                      : p.todaySecs > 0
                        ? <span className="proj-today">{fmt(p.todaySecs)}</span>
                        : null}
                  </div>
                </div>
                <button className={`pin-btn ${p.isPinned ? 'pinned' : ''}`} onClick={(e) => onTogglePinProject?.(p.id, e)} title="Pin project">
                  <Star size={12} strokeWidth={2.5} fill={p.isPinned ? 'currentColor' : 'none'} />
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && search && (
            <li className="proj-empty">No matches</li>
          )}
        </ul>
      </div>

      {groups.length === 0 && (
        <button className="add-group-btn" onClick={onAddGroup}>
          <Plus size={11} strokeWidth={2}/> New workspace
        </button>
      )}
    </aside>
  );
}
