import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar       from './components/Sidebar';
import ProjectDetail from './components/ProjectDetail';
import AddProjectModal from './components/AddProjectModal';
import StatusBar     from './components/StatusBar';

const api = window.devignite;

export default function App() {
  const [projects,    setProjects]    = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [showModal,   setShowModal]   = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [statusMsg,   setStatusMsg]   = useState('Ready');
  const [logs,        setLogs]        = useState({});   // { [projectId]: LogLine[] }
  const [ticks,       setTicks]       = useState({});   // { [projectId]: liveSecs }
  const unsubRef = useRef([]);

  const loadProjects = useCallback(async () => {
    const list = await api.projects.list();
    setProjects(list);
  }, []);

  useEffect(() => {
    loadProjects();

    const u1 = api.on.logStream(data => {
      setLogs(prev => ({
        ...prev,
        [data.projectId]: [...(prev[data.projectId] || []).slice(-500), data],
      }));
    });

    const u2 = api.on.status(({ projectId, status, pid }) => {
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, status, pid } : p
      ));
      setStatusMsg(status === 'running' ? `Running (PID ${pid})` : 'Stopped');
    });

    const u3 = api.on.tick(({ projectId, liveSecs }) => {
      setTicks(prev => ({ ...prev, [projectId]: liveSecs }));
    });

    unsubRef.current = [u1, u2, u3];
    return () => unsubRef.current.forEach(fn => fn());
  }, [loadProjects]);

  const handleStartWork = async (id) => {
    const result = await api.work.start(id);
    if (!result.ok) setStatusMsg(`Error: ${result.error}`);
    else setStatusMsg(`Starting ${projects.find(p => p.id === id)?.name}...`);
    await loadProjects();
  };

  const handleStopWork = async (id) => {
    const result = await api.work.stop(id);
    if (result?.duration) setStatusMsg(`Stopped. Session: ${result.duration.formatted}`);
    await loadProjects();
  };

  const handleSaveProject = async (data) => {
    if (editProject) {
      await api.projects.update(editProject.id, data);
    } else {
      const { id } = await api.projects.add(data);
      setSelectedId(id);
    }
    await loadProjects();
    setShowModal(false);
    setEditProject(null);
  };

  const handleDeleteProject = async (id) => {
    if (!confirm('Delete this project?')) return;
    await api.projects.delete(id);
    if (selectedId === id) setSelectedId(null);
    await loadProjects();
  };

  const handleSetEnv = async (projectId, env) => {
    await api.projects.update(projectId, { env });
    await loadProjects();
  };

  const selected = projects.find(p => p.id === selectedId) ?? null;

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        selectedId={selectedId}
        ticks={ticks}
        onSelect={setSelectedId}
        onAdd={() => { setEditProject(null); setShowModal(true); }}
      />

      <main className="main-panel">
        {selected ? (
          <ProjectDetail
            project={selected}
            logs={logs[selected.id] || []}
            liveSecs={ticks[selected.id] ?? null}
            onStartWork={() => handleStartWork(selected.id)}
            onStopWork={() => handleStopWork(selected.id)}
            onEdit={() => { setEditProject(selected); setShowModal(true); }}
            onDelete={() => handleDeleteProject(selected.id)}
            onSetEnv={env => handleSetEnv(selected.id, env)}
            onReload={loadProjects}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">⚡</div>
            <p>Select a project to ignite it</p>
            <button className="btn primary" onClick={() => setShowModal(true)}>Add project</button>
          </div>
        )}
      </main>

      <StatusBar
        message={statusMsg}
        runningCount={projects.filter(p => p.status === 'running').length}
      />

      {showModal && (
        <AddProjectModal
          project={editProject}
          onSave={handleSaveProject}
          onClose={() => { setShowModal(false); setEditProject(null); }}
        />
      )}
    </div>
  );
}
