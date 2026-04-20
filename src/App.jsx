import { useState, useEffect, useCallback, useRef, memo } from 'react';
import Sidebar           from './components/Sidebar';
import ProjectDetail     from './components/ProjectDetail';
import GroupPanel        from './components/GroupPanel';
import AddProjectModal   from './components/AddProjectModal';
import GroupModal        from './components/GroupModal';
import PortConflictModal from './components/PortConflictModal';
import Header            from './components/Header';
import StatusBar         from './components/StatusBar';
import Loader            from './components/Loader';
import SponsorshipPopup  from './components/SponsorshipPopup';
import { useMenuHandlers } from './menuHandlers';

const api = window.devignite;

// Memoize components to prevent parent re-renders from affecting them
const MemoSidebar = memo(Sidebar);
const MemoProjectDetail = memo(ProjectDetail);
const MemoGroupPanel = memo(GroupPanel);
const MemoHeader = memo(Header);
const MemoStatusBar = memo(StatusBar);

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
  const [portConflict,  setPortConflict]  = useState(null);
  const [pendingStart,  setPendingStart]  = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem('sidebarWidth')) || 240;
  });
  const [isResizing,  setIsResizing]  = useState(false);
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

    const u1 = api.on.status(({ projectId, status, pid }) => {
      setProjects(prev => {
        const proj = prev.find(p=>p.id===projectId);
        if (!proj) return prev;
        const name = proj.name||`#${projectId}`;
        const msgs = { running:`${name} running${pid?` · PID ${pid}`:''}`, stopped:`${name} stopped`, error:`${name} error`, starting:`${name} starting…` };
        if (msgs[status]) setStatusMsg(msgs[status]);
        return prev.map(p => p.id===projectId ? {...p,status,pid} : p);
      });
    });
    const u2 = api.on.portConflict(conflict => {
      setPortConflict(conflict);
      setPendingStart(conflict.projectId);
    });

    unsubRef.current = [u1, u2];
    return () => unsubRef.current.forEach(fn=>fn?.());
  }, [loadAll]);

  useEffect(() => {
    let frameId;
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      if (frameId) cancelAnimationFrame(frameId);
      
      frameId = requestAnimationFrame(() => {
        let newWidth = e.clientX;
        if (newWidth < 180) newWidth = 180;
        if (newWidth > 600) newWidth = 600;
        setSidebarWidth(newWidth);
      });
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('sidebarWidth', sidebarWidth);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isResizing, sidebarWidth]);

  const startWork = async (id) => {
    const r = await api.work.start(id);
    if (!r.ok && !r.portConflict) setStatusMsg(`Error: ${r.error}`);
    await loadAll();
  };

  const stopWork = async (id) => {
    const r = await api.work.stop(id);
    if (r?.duration) setStatusMsg(`Stopped · ${r.duration.formatted}`);
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

  const togglePinProject = async (id, e) => {
    e?.stopPropagation();
    await api.projects.togglePin(id);
    await loadAll();
  };

  const togglePinGroup = async (id, e) => {
    e?.stopPropagation();
    await api.groups.togglePin(id);
    await loadAll();
  };

  const clearProjectLogs = async (id) => {
    await api.logs.clear(id);
    // Component will handle its own refresh
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
        <MemoHeader
          selectedGroup={selG}
          selectedProject={sel}
          runningCount={runCount}
        />

        <div className="app-body" style={{ '--sidebar-w': `${sidebarWidth}px` }}>
          <MemoSidebar
            projects={projects}
            groups={groups}
            selectedId={selectedId}
            selectedGroupId={selectedGrpId}
            onSelect={id => { setSelectedId(id); setSelectedGrpId(null); }}
            onSelectGroup={id => { setSelectedGrpId(id); setSelectedId(null); }}
            onTogglePinProject={togglePinProject}
            onTogglePinGroup={togglePinGroup}
            onAdd={() => { setEditProject(null); setShowProjModal(true); }}
            onAddGroup={() => { setEditGroup(null); setShowGrpModal(true); }}
          />

          <div className={`resizer-v ${isResizing ? 'active' : ''}`} onMouseDown={() => setIsResizing(true)} />

          <main className="main-panel">
            {selG ? (
              <MemoGroupPanel
                group={selG}
                projects={projects}
                onEdit={() => { setEditGroup(selG); setShowGrpModal(true); }}
                onDelete={() => delGroup(selG.id)}
                onProjectSelect={id => { setSelectedId(id); setSelectedGrpId(null); }}
              />
            ) : sel ? (
              <MemoProjectDetail
                project={sel}
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

        <MemoStatusBar message={statusMsg} runningCount={runCount} projects={projects} />

        {showProjModal && (
          <AddProjectModal project={editProject} onSave={saveProject} onClose={()=>{setShowProjModal(false);setEditProject(null);}} />
        )}
        {showGrpModal && (
          <GroupModal group={editGroup} projects={projects} onSave={saveGroup} onClose={()=>{setShowGrpModal(false);setEditGroup(null);}} />
        )}
        {portConflict && (
          <PortConflictModal conflict={portConflict} onResolved={resolvePort} onCancel={()=>{setPortConflict(null);setPendingStart(null);}} />
        )}
        <SponsorshipPopup />
      </div>
    </>
  );
}

