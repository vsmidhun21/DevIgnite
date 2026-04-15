import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar            from './components/Sidebar';
import ProjectDetail      from './components/ProjectDetail';
import GroupPanel         from './components/GroupPanel';
import AddProjectModal    from './components/AddProjectModal';
import GroupModal         from './components/GroupModal';
import PortConflictModal  from './components/PortConflictModal';
import StatusBar          from './components/StatusBar';

const api = window.devignite;

export default function App() {
  const [projects,      setProjects]      = useState([]);
  const [groups,        setGroups]        = useState([]);
  const [selectedId,    setSelectedId]    = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showGroupModal,   setShowGroupModal]   = useState(false);
  const [editProject,  setEditProject]    = useState(null);
  const [editGroup,    setEditGroup]      = useState(null);
  const [statusMsg,    setStatusMsg]      = useState('Ready');
  const [logs,         setLogs]           = useState({});
  const [ticks,        setTicks]          = useState({});
  const [portConflict, setPortConflict]   = useState(null); // { projectId, port, pid }
  const [pendingStart, setPendingStart]   = useState(null); // projectId awaiting resolution
  const unsubRef = useRef([]);

  const loadAll = useCallback(async () => {
    const [pList, gList] = await Promise.all([
      api.projects.list(),
      api.groups.list(),
    ]);
    setProjects(pList);
    setGroups(gList);
  }, []);

  useEffect(() => {
    loadAll();

    const u1 = api.on.logStream(data => {
      setLogs(prev => ({
        ...prev,
        [data.projectId]: [...(prev[data.projectId] || []).slice(-500), data],
      }));
    });

    const u2 = api.on.status(({ projectId, status, pid }) => {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status, pid } : p));
      const name = projects.find(p => p.id === projectId)?.name || `#${projectId}`;
      const msgs = { running:`${name} running${pid?` · PID ${pid}`:''}`, stopped:`${name} stopped`, error:`${name} error`, starting:`${name} starting…` };
      if (msgs[status]) setStatusMsg(msgs[status]);
    });

    const u3 = api.on.tick(({ projectId, liveSecs }) => {
      setTicks(prev => ({ ...prev, [projectId]: liveSecs }));
    });

    const u4 = api.on.portConflict(conflict => {
      setPortConflict(conflict);
      setPendingStart(conflict.projectId);
    });

    unsubRef.current = [u1, u2, u3, u4];
    return () => unsubRef.current.forEach(fn => fn?.());
  }, [loadAll]);

  // ── Work handlers ────────────────────────────────────────────────────────
  const handleStartWork = async (id) => {
    const result = await api.work.start(id);
    if (!result.ok && !result.portConflict) setStatusMsg(`Error: ${result.error}`);
    await loadAll();
  };

  const handleStopWork = async (id) => {
    const result = await api.work.stop(id);
    if (result?.duration) setStatusMsg(`Stopped · session: ${result.duration.formatted}`);
    setTicks(prev => { const n = {...prev}; delete n[id]; return n; });
    await loadAll();
  };

  // ── Port conflict resolution ─────────────────────────────────────────────
  const handlePortResolution = async (resolution) => {
    const projectId = pendingStart;
    setPortConflict(null); setPendingStart(null);
    if (resolution === 'cancel') return;

    if (resolution === 'increment') {
      // Re-run start — ExecutionManager will use next free port via portManager
      const p = projects.find(x => x.id === projectId);
      if (p) {
        const freePort = await api.ports.check(p.port, 'increment');
        if (freePort.port !== p.port) {
          await api.projects.update(projectId, { port: freePort.port });
          await loadAll();
        }
      }
    }
    // For 'killed': port was freed in PortConflictModal, just retry start
    await handleStartWork(projectId);
  };

  // ── Projects ─────────────────────────────────────────────────────────────
  const handleSaveProject = async (data) => {
    if (editProject) await api.projects.update(editProject.id, data);
    else {
      const { id } = await api.projects.add(data);
      setSelectedId(id); setSelectedGroupId(null);
    }
    await loadAll();
    setShowProjectModal(false); setEditProject(null);
  };

  const handleDeleteProject = async (id) => {
    if (!confirm('Delete this project?')) return;
    await api.projects.delete(id);
    if (selectedId === id) setSelectedId(null);
    await loadAll();
  };

  const handleSetEnv = async (projectId, env) => {
    await api.projects.update(projectId, { active_env: env });
    await loadAll();
  };

  // ── Groups ────────────────────────────────────────────────────────────────
  const handleSaveGroup = async (data) => {
    if (editGroup) await api.groups.update(editGroup.id, data);
    else {
      const g = await api.groups.add(data);
      setSelectedGroupId(g.id); setSelectedId(null);
    }
    await loadAll();
    setShowGroupModal(false); setEditGroup(null);
  };

  const handleDeleteGroup = async (id) => {
    if (!confirm('Delete this workspace?')) return;
    await api.groups.delete(id);
    if (selectedGroupId === id) setSelectedGroupId(null);
    await loadAll();
  };

  const selected      = projects.find(p => p.id === selectedId) ?? null;
  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? null;

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        groups={groups}
        selectedId={selectedId}
        selectedGroupId={selectedGroupId}
        ticks={ticks}
        onSelect={id => { setSelectedId(id); setSelectedGroupId(null); }}
        onSelectGroup={id => { setSelectedGroupId(id); setSelectedId(null); }}
        onAdd={() => { setEditProject(null); setShowProjectModal(true); }}
        onAddGroup={() => { setEditGroup(null); setShowGroupModal(true); }}
      />

      <main className="main-panel">
        {selectedGroup ? (
          <GroupPanel
            group={selectedGroup}
            projects={projects}
            ticks={ticks}
            onEdit={() => { setEditGroup(selectedGroup); setShowGroupModal(true); }}
            onDelete={() => handleDeleteGroup(selectedGroup.id)}
            onProjectSelect={id => { setSelectedId(id); setSelectedGroupId(null); }}
          />
        ) : selected ? (
          <ProjectDetail
            project={selected}
            logs={logs[selected.id] || []}
            liveSecs={ticks[selected.id] ?? null}
            onStartWork={() => handleStartWork(selected.id)}
            onStopWork={() => handleStopWork(selected.id)}
            onEdit={() => { setEditProject(selected); setShowProjectModal(true); }}
            onDelete={() => handleDeleteProject(selected.id)}
            onSetEnv={env => handleSetEnv(selected.id, env)}
            onReload={loadAll}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">⚡</div>
            <p>Select a project or workspace</p>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn primary" onClick={() => setShowProjectModal(true)}>Add project</button>
              <button className="btn" onClick={() => setShowGroupModal(true)}>New workspace</button>
            </div>
          </div>
        )}
      </main>

      <StatusBar
        message={statusMsg}
        runningCount={projects.filter(p => p.status === 'running').length}
      />

      {showProjectModal && (
        <AddProjectModal
          project={editProject}
          onSave={handleSaveProject}
          onClose={() => { setShowProjectModal(false); setEditProject(null); }}
        />
      )}
      {showGroupModal && (
        <GroupModal
          group={editGroup}
          projects={projects}
          onSave={handleSaveGroup}
          onClose={() => { setShowGroupModal(false); setEditGroup(null); }}
        />
      )}
      {portConflict && (
        <PortConflictModal
          conflict={portConflict}
          onResolved={handlePortResolution}
          onCancel={() => { setPortConflict(null); setPendingStart(null); }}
        />
      )}
    </div>
  );
}
