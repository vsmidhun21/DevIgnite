const fmt = (s) => {
  if (!s) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

export default function Sidebar({ projects, selectedId, ticks, onSelect, onAdd }) {
  const running = projects.filter(p => p.status === 'running').length;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">⚡</span>
        <span className="brand-name">DevIgnite</span>
      </div>

      <div className="sidebar-header">
        <span className="sidebar-count">{projects.length} projects · {running} running</span>
        <button className="btn-add" onClick={onAdd} title="Add project">+</button>
      </div>

      <ul className="project-list">
        {projects.map(p => {
          const live = ticks?.[p.id];
          return (
            <li
              key={p.id}
              className={`project-item ${p.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(p.id)}
            >
              <span className={`status-dot ${p.status || 'stopped'}`} />
              <div className="proj-info">
                <span className="proj-name">{p.name}</span>
                {live != null && p.status === 'running' ? (
                  <span className="proj-timer">{fmt(live)}</span>
                ) : p.todaySecs > 0 ? (
                  <span className="proj-today">{fmt(p.todaySecs)} today</span>
                ) : null}
              </div>
              <span className="type-badge">{p.type?.split(' ')[0]}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
