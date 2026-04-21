import { useState, useMemo, useEffect, memo } from 'react';
import { Search, X, Plus, Star, ArchiveRestore, ChevronRight } from 'lucide-react';

const api = window.devignite;
const SIDEBAR_SECTIONS_KEY = 'sidebarSections';

const fmt = (s) => {
  if (!s) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

const getInitialSections = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SIDEBAR_SECTIONS_KEY) || '{}');
    return {
      workspaces: saved.workspaces ?? true,
      projects: saved.projects ?? true,
      archived: saved.archived ?? false,
    };
  } catch {
    return {
      workspaces: true,
      projects: true,
      archived: false,
    };
  }
};

const ProjectItem = memo(({ p, isSelected, onSelect, onTogglePin, status }) => {
  const [live, setLive] = useState(null);

  useEffect(() => {
    if (status !== 'running') {
      setLive(null);
      return;
    }
    const unsub = api.on.tick(({ projectId, liveSecs }) => {
      if (projectId === p.id) setLive(liveSecs);
    });
    return () => unsub?.();
  }, [p.id, status]);

  const git = p.git;

  return (
    <li className={`project-item ${isSelected ? 'active' : ''}`} onClick={() => onSelect(p.id)}>
      <span className={`status-dot ${status || 'stopped'}`} />
      <div className="proj-info">
        <div className="proj-name-row">
          <span className="proj-name">{p.name}</span>
          {git?.hasGit && git.branch && (
            <span className="proj-branch">{git.branch}{git.isDirty ? '*' : ''}</span>
          )}
        </div>
        <div className="proj-meta-row">
          <span className="type-badge-sm">{p.type?.split(' ')[0]}</span>
          {live != null && status === 'running'
            ? <span className="proj-timer">{fmt(live)}</span>
            : p.todaySecs > 0
              ? <span className="proj-today">{fmt(p.todaySecs)}</span>
              : null}
        </div>
      </div>
      <button className={`pin-btn ${p.isPinned ? 'pinned' : ''}`} onClick={(e) => { e.stopPropagation(); onTogglePin(p.id, e); }} title="Pin project">
        <Star size={12} strokeWidth={2.5} fill={p.isPinned ? 'currentColor' : 'none'} />
      </button>
    </li>
  );
});

const ArchivedProjectItem = memo(({ p, isSelected, onSelect, onUnarchive }) => (
  <li className={`project-item ${isSelected ? 'active' : ''}`} onClick={() => onSelect(p.id)}>
    <span className="status-dot stopped" />
    <div className="proj-info">
      <div className="proj-name-row">
        <span className="proj-name">{p.name}</span>
      </div>
      <div className="proj-meta-row">
        <span className="type-badge-sm">{p.type?.split(' ')[0]}</span>
      </div>
    </div>
    <button className="pin-btn pinned" onClick={(e) => { e.stopPropagation(); onUnarchive(p.id); }} title="Restore project">
      <ArchiveRestore size={12} strokeWidth={2.5} />
    </button>
  </li>
));

const SectionHeader = memo(function SectionHeader({ label, expanded, onToggle, children }) {
  return (
    <div className="sidebar-section-header" onClick={onToggle}>
      <div className="sidebar-section-toggle">
        <span className={`sidebar-section-chevron ${expanded ? 'expanded' : ''}`}>
          <ChevronRight size={11} strokeWidth={2.4} />
        </span>
        <span className="sidebar-section-label">{label}</span>
      </div>
      <div className="sidebar-section-actions" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
});

export default memo(function Sidebar({
  projects,
  archivedProjects,
  groups,
  selectedId,
  selectedGroupId,
  onSelect,
  onSelectGroup,
  onAdd,
  onAddGroup,
  onTogglePinProject,
  onTogglePinGroup,
  onUnarchiveProject
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sections, setSections] = useState(getInitialSections);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(sections));
  }, [sections]);

  const toggleSection = (key) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filtered = useMemo(() => projects.filter(p =>
    !debouncedSearch ||
    p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    p.type?.toLowerCase().includes(debouncedSearch.toLowerCase())
  ), [projects, debouncedSearch]);

  const filteredArchived = useMemo(() => archivedProjects.filter(p =>
    !debouncedSearch ||
    p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    p.type?.toLowerCase().includes(debouncedSearch.toLowerCase())
  ), [archivedProjects, debouncedSearch]);

  const workspaceItems = useMemo(() => groups.map(g => {
    const gps = projects.filter(p => g.projectIds.includes(p.id));
    const anyRun = gps.some(p => p.status === 'running');
    const allRun = gps.length > 0 && gps.every(p => p.status === 'running');
    return (
      <div
        key={g.id}
        className={`group-item ${g.id === selectedGroupId ? 'active' : ''}`}
        onClick={() => onSelectGroup(g.id)}
      >
        <span className="group-dot" style={{ background: g.color }} />
        <div className="proj-info">
          <span className="proj-name">{g.name}</span>
          <span className="proj-today">{gps.length} projects</span>
        </div>
        <button className={`pin-btn ${g.isPinned ? 'pinned' : ''}`} onClick={(e) => { e.stopPropagation(); onTogglePinGroup?.(g.id, e); }} title="Pin workspace">
          <Star size={12} strokeWidth={2.5} fill={g.isPinned ? 'currentColor' : 'none'} />
        </button>
        <span className={`group-status-dot ${allRun ? 'running' : anyRun ? 'partial' : ''}`} />
      </div>
    );
  }), [groups, onSelectGroup, onTogglePinGroup, projects, selectedGroupId]);

  const projectItems = useMemo(() => filtered.map(p => (
    <ProjectItem
      key={p.id}
      p={p}
      isSelected={p.id === selectedId}
      onSelect={onSelect}
      onTogglePin={onTogglePinProject}
      status={p.status}
    />
  )), [filtered, onSelect, onTogglePinProject, selectedId]);

  const archivedItems = useMemo(() => filteredArchived.map(p => (
    <ArchivedProjectItem
      key={p.id}
      p={p}
      isSelected={p.id === selectedId}
      onSelect={onSelect}
      onUnarchive={onUnarchiveProject}
    />
  )), [filteredArchived, onSelect, onUnarchiveProject, selectedId]);

  const runningCount = useMemo(() => projects.filter(p => p.status === 'running').length, [projects]);
  const showArchivedSection = archivedProjects.length > 0 || (debouncedSearch && filteredArchived.length > 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
              fill="var(--ignite)" stroke="var(--ignite)" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="sidebar-brand-name">DevIgnite</span>
      </div>

      <div className="sidebar-search-wrap">
        <Search size={11} strokeWidth={2} className="search-icon" />
        <input
          className="sidebar-search"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')}>
            <X size={11} strokeWidth={2} />
          </button>
        )}
      </div>

      {groups.length > 0 && (
        <div className="sidebar-section">
          <SectionHeader
            label="Workspaces"
            expanded={sections.workspaces}
            onToggle={() => toggleSection('workspaces')}
          >
            <button className="btn-add-inline" onClick={onAddGroup} title="New workspace">
              <Plus size={11} strokeWidth={2.5} />
            </button>
          </SectionHeader>
          <div className={`sidebar-section-content ${sections.workspaces ? 'expanded' : 'collapsed'}`}>
            {sections.workspaces && workspaceItems}
          </div>
        </div>
      )}

      <div className="sidebar-section flex-1">
        <SectionHeader
          label={`Projects ${search ? `(${filtered.length})` : runningCount > 0 ? `- ${runningCount} running` : ''}`}
          expanded={sections.projects}
          onToggle={() => toggleSection('projects')}
        >
          <button className="btn-add-inline" onClick={onAdd} title="Add project">
            <Plus size={11} strokeWidth={2.5} />
          </button>
        </SectionHeader>

        <div className={`sidebar-section-content ${sections.projects ? 'expanded fill' : 'collapsed'}`}>
          {sections.projects && (
            <ul className="project-list">
              {projectItems}
              {filtered.length === 0 && debouncedSearch && (
                <li className="proj-empty">No matches</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {showArchivedSection && (
        <div className="sidebar-section">
          <SectionHeader
            label={`Archived ${debouncedSearch ? `(${filteredArchived.length})` : `(${archivedProjects.length})`}`}
            expanded={sections.archived}
            onToggle={() => toggleSection('archived')}
          />
          <div className={`sidebar-section-content ${sections.archived ? 'expanded' : 'collapsed'}`}>
            {sections.archived && (
              <ul className="project-list" style={{ maxHeight: 180 }}>
                {archivedItems}
                {filteredArchived.length === 0 && debouncedSearch && (
                  <li className="proj-empty">No archived matches</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <button className="add-group-btn" onClick={onAddGroup}>
          <Plus size={11} strokeWidth={2} /> New workspace
        </button>
      )}
    </aside>
  );
});
