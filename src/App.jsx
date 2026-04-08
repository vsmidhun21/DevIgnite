// desktop/renderer/src/App.jsx
// Root component. Manages selected project state and layout.

import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ProjectDetail from './components/ProjectDetail';
import AddProjectModal from './components/AddProjectModal';
import StatusBar from './components/StatusBar';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Ready');
  const [logs, setLogs] = useState({}); // { [projectId]: LogLine[] }

  // ─── Load projects on mount ───────────────────────────────────────
  const loadProjects = useCallback(async () => {
    if (window.launcher) {
      window.launcher.projects.list().then(setProjects)
    }
  }, []);

  useEffect(() => {
    loadProjects();

    // Subscribe to real-time log streaming from main process
    const unsubLogs = window.launcher.logs.onStream((data) => {
      setLogs(prev => ({
        ...prev,
        [data.projectId]: [...(prev[data.projectId] || []).slice(-200), data],
      }));
    });

    // Subscribe to process status updates
    const unsubStatus = window.launcher.onStatusUpdate(({ projectId, status, pid }) => {
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, status, pid } : p
      ));
      setStatusMsg(status === 'running'
        ? `Running project (PID ${pid})`
        : `Project stopped`);
    });

    return () => { unsubLogs(); unsubStatus(); };
  }, [loadProjects]);

  // ─── Actions ──────────────────────────────────────────────────────
  const handleRun = async (id) => {
    try {
      await window.launcher.run(id);
    } catch (err) {
      console.error('Run failed:', err);
    }
  };

  const handleStop = async (id) => {
    await window.launcher.stop(id);
    setStatusMsg('Stopping project...');
  };

  const handleOpenIDE = async (id) => {
    await window.launcher.openIDE(id);
    const p = projects.find(x => x.id === id);
    setStatusMsg(`Opened ${p?.ide || 'IDE'}`);
  };

  const handleSaveProject = async (data) => {
    if (editProject) {
      await window.launcher.projects.update(editProject.id, data);
    } else {
      const { id } = await window.launcher.projects.add(data);
      setSelectedId(id);
    }
    await loadProjects();
    setShowModal(false);
    setEditProject(null);
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    await window.launcher.projects.delete(id);
    if (selectedId === id) setSelectedId(null);
    await loadProjects();
  };

  const handleSetEnv = async (projectId, env) => {
    await window.launcher.projects.update(projectId, { env });
    await loadProjects();
  };

  const selectedProject = projects.find(p => p.id === selectedId) ?? null;

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={() => { setEditProject(null); setShowModal(true); }}
      />

      <main className="main-panel">
        {selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            logs={logs[selectedProject.id] || []}
            onRun={() => handleRun(selectedProject.id)}
            onStop={() => handleStop(selectedProject.id)}
            onOpenIDE={() => handleOpenIDE(selectedProject.id)}
            onEdit={() => { setEditProject(selectedProject); setShowModal(true); }}
            onDelete={() => handleDeleteProject(selectedProject.id)}
            onSetEnv={(env) => handleSetEnv(selectedProject.id, env)}
          />
        ) : (
          <div className="empty-state">
            <p>Select a project from the sidebar, or add a new one.</p>
          </div>
        )}
      </main>

      <StatusBar message={statusMsg} runningCount={projects.filter(p => p.status === 'running').length} />

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
