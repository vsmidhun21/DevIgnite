// desktop/renderer/src/components/Sidebar.jsx
// Left panel: project list with status dots and type badges.

export default function Sidebar({ projects, selectedId, onSelect, onAdd }) {
  const running = projects.filter(p => p.status === 'running').length;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="app-title">Dev Launcher</div>
        <div className="app-sub">{projects.length} projects · {running} running</div>
      </div>

      <ul className="project-list">
        {projects.map(p => (
          <li
            key={p.id}
            className={`project-item ${p.id === selectedId ? 'active' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <span className={`status-dot ${p.status || 'stopped'}`} />
            <span className="proj-name">{p.name}</span>
            <span className="type-badge">{p.type?.split(' ')[0]}</span>
          </li>
        ))}
      </ul>

      <button className="add-btn" onClick={onAdd}>+ Add project</button>
    </aside>
  );
}
