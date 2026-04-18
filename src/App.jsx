import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar           from './components/Sidebar';
import ProjectDetail     from './components/ProjectDetail';
import GroupPanel        from './components/GroupPanel';
import AddProjectModal   from './components/AddProjectModal';
import GroupModal        from './components/GroupModal';
import PortConflictModal from './components/PortConflictModal';
import Header            from './components/Header';
import StatusBar         from './components/StatusBar';
import Loader            from './components/Loader';
import { useMenuHandlers } from './menuHandlers';

const api = window.devignite;

export default function App() {
  const [ready,         setReady]         = useState(false);
  const [projects,      setProjects]      = useState([]);
  const [groups,        setGroups]        = useState([]);
  const [selectedId,    setSelectedId]    = useState(null);
  const [selectedGrpId, setSelectedGrpId] = useState(null);
  const [showProjModal, setShowProjModal] = useState(false);
  const [showGrpModal,  setShowGrpModal]  = useState(false);
  const [editProject,   setEditProject]   = useState(null);
  const [editGroup,     setEditGroup]     = useState(null);
  const [statusMsg,     setStatusMsg]     = useState('Ready');
  const [logs,          setLogs]          = useState({});
  const [ticks,         setTicks]         = useState({});
  const [portConflict,  setPortConflict]  = useState(null);
  const [pendingStart,  setPendingStart]  = useState(null);
  const unsubRef = useRef([]);

  const loadAll = useCallback(async () => {
    const [pList, gList] = await Promise.all([
      api.projects.list(),
      api.groups.list(),
    ]);
    setProjects(pList);
    setGroups(gList);
    return pList;
  }, []);

  useEffect(() => {
    loadAll().then(() => setReady(true));

    const u1 = api.on.logStream(data => {
      setLogs(prev => ({
        ...prev,
        [data.projectId]: [...(prev[data.projectId]||[]).slice(-500), data],
      }));
    });
    const u2 = api.on.status(({ projectId, status, pid }) => {
      setProjects(prev => {
        const name = prev.find(p=>p.id===projectId)?.name||`#${projectId}`;
        const msgs = { running:`${name} running${pid?` · PID ${pid}`:''}`, stopped:`${name} stopped`, error:`${name} error`, starting:`${name} starting…` };
        if (msgs[status]) setStatusMsg(msgs[status]);
        return prev.map(p => p.id===projectId ? {...p,status,pid} : p);
      });
    });
    const u3 = api.on.tick(({ projectId, liveSecs }) => {
      setTicks(prev => ({...prev,[projectId]:liveSecs}));
    });
    const u4 = api.on.portConflict(conflict => {
      setPortConflict(conflict);
      setPendingStart(conflict.projectId);
    });

    unsubRef.current = [u1,u2,u3,u4];
    return () => unsubRef.current.forEach(fn=>fn?.());
  }, [loadAll]);

  const startWork = async (id) => {
    const r = await api.work.start(id);
    if (!r.ok && !r.portConflict) setStatusMsg(`Error: ${r.error}`);
    await loadAll();
  };

  const stopWork = async (id) => {
    const r = await api.work.stop(id);
    if (r?.duration) setStatusMsg(`Stopped · ${r.duration.formatted}`);
    setTicks(prev => { const n={...prev}; delete n[id]; return n; });
    await loadAll();
  };

  const resolvePort = async (resolution) => {
    const id = pendingStart;
    setPortConflict(null); setPendingStart(null);
    if (resolution==='cancel') return;
    if (resolution==='increment') {
      const p = projects.find(x=>x.id===id);
      if (p) {
        const fp = await api.ports.check(p.port,'increment');
        if (fp.port!==p.port) { await api.projects.update(id,{port:fp.port}); await loadAll(); }
      }
    }
    await startWork(id);
  };

  const saveProject = async (data) => {
    if (editProject) await api.projects.update(editProject.id, data);
    else { const {id} = await api.projects.add(data); setSelectedId(id); setSelectedGrpId(null); }
    await loadAll();
    setShowProjModal(false); setEditProject(null);
  };

  const delProject = async (id) => {
    if (!confirm('Delete project?')) return;
    await api.projects.delete(id);
    if (selectedId===id) setSelectedId(null);
    await loadAll();
  };

  const setEnv = async (projectId, env) => {
    await api.projects.update(projectId, {active_env:env});
    await loadAll();
  };

  const clearProjectLogs = async (id) => {
    await api.logs.clear(id);
    setLogs(prev => { const n={...prev}; delete n[id]; return n; });
  };

  const saveGroup = async (data) => {
    if (editGroup) await api.groups.update(editGroup.id, data);
    else { const g = await api.groups.add(data); setSelectedGrpId(g.id); setSelectedId(null); }
    await loadAll();
    setShowGrpModal(false); setEditGroup(null);
  };

  const delGroup = async (id) => {
    if (!confirm('Delete workspace?')) return;
    await api.groups.delete(id);
    if (selectedGrpId===id) setSelectedGrpId(null);
    await loadAll();
  };

  const sel  = projects.find(p=>p.id===selectedId)??null;
  const selG = groups.find(g=>g.id===selectedGrpId)??null;
  const runCount = projects.filter(p=>p.status==='running').length;

  useMenuHandlers({
    selectedId,
    selectedGrpId,
    projects,
    setEditProject,
    setShowProjModal,
    setEditGroup,
    setShowGrpModal,
    delProject,
    startWork,
    stopWork,
    loadAll,
    setReady,
    clearProjectLogs
  });

  return (
    <>
      <Loader visible={!ready} />
      <div className={`app-shell ${ready?'app-ready':''}`}>
        <Header
          selectedGroup={selG}
          selectedProject={sel}
          runningCount={runCount}
          liveSecs={sel ? ticks[sel.id] : null}
        />

        <div className="app-body">
          <Sidebar
            projects={projects}
            groups={groups}
            selectedId={selectedId}
            selectedGroupId={selectedGrpId}
            ticks={ticks}
            onSelect={id => { setSelectedId(id); setSelectedGrpId(null); }}
            onSelectGroup={id => { setSelectedGrpId(id); setSelectedId(null); }}
            onAdd={() => { setEditProject(null); setShowProjModal(true); }}
            onAddGroup={() => { setEditGroup(null); setShowGrpModal(true); }}
          />

          <main className="main-panel">
            {selG ? (
              <GroupPanel
                group={selG}
                projects={projects}
                ticks={ticks}
                onEdit={() => { setEditGroup(selG); setShowGrpModal(true); }}
                onDelete={() => delGroup(selG.id)}
                onProjectSelect={id => { setSelectedId(id); setSelectedGrpId(null); }}
              />
            ) : sel ? (
              <ProjectDetail
                project={sel}
                logs={logs[sel.id]||[]}
                liveSecs={ticks[sel.id]??null}
                onStartWork={() => startWork(sel.id)}
                onStopWork={() => stopWork(sel.id)}
                onEdit={() => { setEditProject(sel); setShowProjModal(true); }}
                onDelete={() => delProject(sel.id)}
                onSetEnv={env => setEnv(sel.id, env)}
                onReload={loadAll}
                onClearLogs={() => clearProjectLogs(sel.id)}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
                      fill="var(--ignite)" stroke="var(--ignite)" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p>Select a project or workspace</p>
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button className="btn primary" onClick={()=>setShowProjModal(true)}>Add project</button>
                  <button className="btn" onClick={()=>setShowGrpModal(true)}>New workspace</button>
                </div>
              </div>
            )}
          </main>
        </div>

        <StatusBar message={statusMsg} runningCount={runCount} projects={projects} />

        {showProjModal && (
          <AddProjectModal project={editProject} onSave={saveProject} onClose={()=>{setShowProjModal(false);setEditProject(null);}} />
        )}
        {showGrpModal && (
          <GroupModal group={editGroup} projects={projects} onSave={saveGroup} onClose={()=>{setShowGrpModal(false);setEditGroup(null);}} />
        )}
        {portConflict && (
          <PortConflictModal conflict={portConflict} onResolved={resolvePort} onCancel={()=>{setPortConflict(null);setPendingStart(null);}} />
        )}
      </div>
    </>
  );
}
