import { useState } from 'react';

const api = window.devignite;

const fmt = (s) => {
  if (!s) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

export default function Sidebar({
  projects, groups, selectedId, selectedGroupId,
  ticks, onSelect, onSelectGroup, onAdd, onAddGroup,
}) {
  const [search, setSearch] = useState('');

  const filtered = projects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.type?.toLowerCase().includes(search.toLowerCase())
  );

  const running = projects.filter(p => p.status === 'running').length;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">⚡</span>
        <span className="brand-name">DevIgnite</span>
      </div>

      {/* Search */}
      <div className="sidebar-search-wrap">
        <input
          className="sidebar-search"
          placeholder="Search projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')}>×</button>
        )}
      </div>

      {/* Groups section */}
      {groups.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-label">Workspaces</span>
            <button className="btn-add-inline" onClick={onAddGroup} title="New workspace">+</button>
          </div>
          {groups.map(g => {
            const groupProjects  = projects.filter(p => g.projectIds.includes(p.id));
            const anyRunning     = groupProjects.some(p => p.status === 'running');
            const allRunning     = groupProjects.length > 0 && groupProjects.every(p => p.status === 'running');
            return (
              <div
                key={g.id}
                className={`group-item ${g.id === selectedGroupId ? 'active' : ''}`}
                onClick={() => onSelectGroup(g.id)}
              >
                <span className="group-dot" style={{ background: g.color }} />
                <div className="proj-info">
                  <span className="proj-name">{g.name}</span>
                  <span className="proj-today">{groupProjects.length} projects</span>
                </div>
                <span className={`group-status ${allRunning ? 'running' : anyRunning ? 'partial' : ''}`}>
                  {allRunning ? '●' : anyRunning ? '◐' : '○'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Projects section */}
      <div className="sidebar-section flex-1">
        <div className="sidebar-section-header">
          <span className="sidebar-section-label">
            Projects {search ? `(${filtered.length}/${projects.length})` : `· ${running} running`}
          </span>
          <button className="btn-add-inline" onClick={onAdd} title="Add project">+</button>
        </div>

        <ul className="project-list">
          {filtered.map(p => {
            const live = ticks?.[p.id];
            const git  = p.git;
            return (
              <li
                key={p.id}
                className={`project-item ${p.id === selectedId ? 'active' : ''}`}
                onClick={() => onSelect(p.id)}
              >
                <span className={`status-dot ${p.status || 'stopped'}`} />
                <div className="proj-info">
                  <div className="proj-name-row">
                    <span className="proj-name">{p.name}</span>
                    {git?.hasGit && git.branch && (
                      <span className="proj-branch" title={`Branch: ${git.branch}${git.isDirty ? ' (modified)' : ''}`}>
                        {git.branch}{git.isDirty ? '*' : ''}
                      </span>
                    )}
                  </div>
                  <div className="proj-meta-row">
                    <span className="type-badge-sm">{p.type?.split(' ')[0]}</span>
                    {live != null && p.status === 'running' ? (
                      <span className="proj-timer">{fmt(live)}</span>
                    ) : p.todaySecs > 0 ? (
                      <span className="proj-today">{fmt(p.todaySecs)}</span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && search && (
            <li className="proj-empty">No projects match "{search}"</li>
          )}
        </ul>
      </div>

      {!groups.length && (
        <button className="add-group-btn" onClick={onAddGroup}>+ New workspace</button>
      )}
    </aside>
  );
}
