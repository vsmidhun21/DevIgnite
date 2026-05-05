import { useState, useEffect, useCallback, useRef, useMemo, memo, startTransition } from 'react';
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
import UpdateModal       from './components/UpdateModal';
import { useMenuHandlers } from './menuHandlers';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import GlobalSearchModal from './components/GlobalSearchModal';
import SettingsModal     from './components/SettingsModal';
import Tour              from './components/Tour';
import DailyBriefingModal from './components/DailyBriefingModal';

const api = window.devignite;

// Memoize components to prevent parent re-renders from affecting them
const MemoSidebar = memo(Sidebar);
const MemoProjectDetail = ProjectDetail;
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
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem('sidebarWidth')) || 240;
  });
  const [isResizing,  setIsResizing]  = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [appSettings,  setAppSettings]  = useState({
    shortcuts: {},
    notifications_enabled: 1,
    auto_update_enabled: 1,
    daily_briefing_enabled: 1,
    theme: 'system'
  });
  const [isTourActive, setIsTourActive] = useState(false);
  const [showBriefing, setShowBriefing] = useState(null); // stores the project object for briefing
  const unsubRef = useRef([]);
  const sidebarSearchRef = useRef(null);
  const projectDetailRef = useRef(null);
  const sidebarWidthRef = useRef(sidebarWidth);

  const loadAll = useCallback(async () => {
    const [pList, gList, settings] = await Promise.all([
      api.projects.list(),
      api.groups.list(),
      api.settings.get(),
    ]);
    setProjects(pList);
    setGroups(gList);
    if (settings) setAppSettings(settings);
    return pList;
  }, []);

  const statusMsgTimer = useRef(null);

  useEffect(() => {
    if (!isSidebarCollapsed) {
      sidebarWidthRef.current = sidebarWidth;
    }
  }, [isSidebarCollapsed, sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    if (appSettings.theme === 'light') root.classList.add('theme-light');
    else if (appSettings.theme === 'dark') root.classList.add('theme-dark');
  }, [appSettings.theme]);

  useEffect(() => {
    loadAll().then((pList) => {
      setReady(true);
      // Tour activation is driven by SQLite state inside Tour.jsx itself.
      // We start it for ALL new launches; Tour.jsx decides whether to show.
      setIsTourActive(true);
    });

    const u1 = api.on.status(({ projectId, status, pid }) => {
      startTransition(() => {
        setProjects(prev => {
          const idx = prev.findIndex(p => p.id === projectId);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], status, pid };
          
          if (statusMsgTimer.current) clearTimeout(statusMsgTimer.current);
          statusMsgTimer.current = setTimeout(() => {
            const proj = next[idx];
            const name = proj.name || `#${projectId}`;
            const msgs = { running:`${name} running${pid?` · PID ${pid}`:''}`, stopped:`${name} stopped`, error:`${name} error`, starting:`${name} starting…` };
            if (msgs[status]) setStatusMsg(msgs[status]);
          }, 200);

          return next;
        });
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

  const focusSidebarSearch = useCallback(() => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      setSidebarWidth(sidebarWidthRef.current || 240);
    }

    requestAnimationFrame(() => {
      sidebarSearchRef.current?.focus();
      sidebarSearchRef.current?.select?.();
    });
  }, [isSidebarCollapsed]);

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
    else {
      const { id } = await api.projects.add(data);
      setSelectedId(id);
      setSelectedGrpId(null);
      // Tour Step 1 → 2: project was just created
      window.dispatchEvent(new Event('tour:projectCreated'));
    }
    await loadAll();
    setShowProjModal(false); setEditProject(null);
  };

  const delProject = async (id) => {
    if (!confirm('Delete project?')) return;
    await api.projects.delete(id);
    if (selectedId===id) setSelectedId(null);
    await loadAll();
  };

  const reloadProject = useCallback(async (id) => {
    const p = await api.projects.get(id);
    if (!p) return;
    startTransition(() => {
      setProjects(prev => {
        const idx = prev.findIndex(x => x.id === id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], ...p };
        return next;
      });
    });
  }, []);

  const setEnv = async (projectId, env) => {
    await api.projects.update(projectId, {active_env:env});
    await reloadProject(projectId);
  };

  useEffect(() => {
    if (!selectedId || !ready) return;
    const p = projects.find(x => x.id === selectedId);
    if (!p || p.archived) return;

    // Check if briefing should be shown
    api.projects.getBriefing(p.id, p.path).then(res => {
      if (res.shouldShow) {
        setShowBriefing(p);
      }
    }).catch(e => console.error('Briefing check error:', e));
  }, [selectedId, ready]);

  const togglePinProject = async (id, e) => {
    e?.stopPropagation();
    await api.projects.togglePin(id);
    await reloadProject(id);
  };

  const togglePinGroup = async (id, e) => {
    e?.stopPropagation();
    await api.groups.togglePin(id);
    await loadAll();
  };

  const clearProjectLogs = async (id) => {
    await api.logs.clear(id);
  };

  const archiveProject = async (id) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    if (project.status === 'running' || project.status === 'starting') {
      await api.work.stop(id);
    }
    await api.projects.update(id, { archived: true });
    await reloadProject(id);
  };

  const unarchiveProject = async (id) => {
    await api.projects.update(id, { archived: false });
    await reloadProject(id);
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

  const activeProjects = useMemo(() => projects.filter(p => !p.archived), [projects]);
  const archivedProjects = useMemo(() => projects.filter(p => !!p.archived), [projects]);
  const sel  = projects.find(p=>p.id===selectedId)??null;
  const selG = groups.find(g=>g.id===selectedGrpId)??null;
  const runCount = activeProjects.filter(p=>p.status==='running').length;

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      if (!prev) {
        sidebarWidthRef.current = sidebarWidth;
      }
      return !prev;
    });

    if (isSidebarCollapsed) {
      setSidebarWidth(sidebarWidthRef.current || 240);
    }
  }, [isSidebarCollapsed, sidebarWidth]);

  const toggleGlobalSearch = useCallback(() => {
    setIsGlobalSearchOpen(prev => !prev);
  }, []);

  const startSelectedProject = useCallback(() => {
    if (!sel || sel.archived) return;
    if (sel.status === 'running' || sel.status === 'starting') return;
    startWork(sel.id);
  }, [sel]);

  const stopSelectedProject = useCallback(() => {
    if (!sel) return;
    if (sel.status !== 'running' && sel.status !== 'starting') return;
    stopWork(sel.id);
  }, [sel]);

  const restartProject = useCallback((id) => {
    api.work.restart(id);
  }, []);

  const restartSelectedProject = useCallback(() => {
    if (!sel) return;
    const isRunning = sel.status === 'running' || sel.status === 'starting';
    if (!isRunning) return;
    restartProject(sel.id);
  }, [restartProject, sel]);

  const focusLogs = useCallback(() => {
    projectDetailRef.current?.focusLogs?.();
  }, []);

  const focusSearchSurface = useCallback(() => {
    if (projectDetailRef.current?.isLogViewerActive?.()) {
      projectDetailRef.current?.focusLogSearch?.();
      return;
    }

    focusSidebarSearch();
  }, [focusSidebarSearch]);

  useKeyboardShortcuts({
    shortcutsConfig: appSettings.shortcuts,
    onGlobalSearch: toggleGlobalSearch,
    onStartProject: startSelectedProject,
    onStopProject: stopSelectedProject,
    onRestartProject: restartSelectedProject,
    onToggleSidebar: toggleSidebar,
    onFocusLogs: focusLogs,
    onFocusSearch: focusSearchSurface
  });

  useMenuHandlers({
    selectedId,
    selectedGrpId,
    projects: activeProjects,
    setEditProject,
    setShowProjModal,
    setEditGroup,
    setShowGrpModal,
    delProject,
    startWork,
    stopWork,
    loadAll,
    setReady,
    clearProjectLogs,
    setShowSettings,
    onShowGuide: async () => {
      // Reset tour state in SQLite
      await api.tour.saveState({ tourCompleted: false, currentStep: 0, skipped: false });
      // Force reactivation
      setIsTourActive(false);
      setTimeout(() => setIsTourActive(true), 50);
    }
  });

  const saveSettings = async (newSettings) => {
    await api.settings.save(newSettings);
    setAppSettings(newSettings);
  };

  return (
    <>
      <Loader visible={!ready} />
      <div className={`app-shell ${ready?'app-ready':''}`}>
        <MemoHeader
          selectedGroup={selG}
          selectedProject={sel}
          runningCount={runCount}
        />

        <div className={`app-body ${isSidebarCollapsed ? 'sidebar-hidden' : ''}`} style={{ '--sidebar-w': `${isSidebarCollapsed ? 0 : sidebarWidth}px` }}>
          <MemoSidebar
            projects={activeProjects}
            archivedProjects={archivedProjects}
            groups={groups}
            selectedId={selectedId}
            selectedGroupId={selectedGrpId}
            searchInputRef={sidebarSearchRef}
            onSelect={id => {
              setSelectedId(id);
              setSelectedGrpId(null);
              // Tour Step 2 → 3: a project was selected
              window.dispatchEvent(new Event('tour:projectSelected'));
            }}
            onSelectGroup={id => { setSelectedGrpId(id); setSelectedId(null); }}
            onTogglePinProject={togglePinProject}
            onTogglePinGroup={togglePinGroup}
            onUnarchiveProject={unarchiveProject}
            onAdd={() => { setEditProject(null); setShowProjModal(true); }}
            onAddGroup={() => { setEditGroup(null); setShowGrpModal(true); }}
            onOpenSettings={() => setShowSettings(true)}
          />

          {!isSidebarCollapsed && (
            <div className={`resizer-v ${isResizing ? 'active' : ''}`} onMouseDown={() => setIsResizing(true)} />
          )}

          <main className="main-panel">
            {selG ? (
              <MemoGroupPanel
                group={selG}
                projects={activeProjects}
                onEdit={() => { setEditGroup(selG); setShowGrpModal(true); }}
                onDelete={() => delGroup(selG.id)}
                onProjectSelect={id => { setSelectedId(id); setSelectedGrpId(null); }}
              />
            ) : sel ? (
              <MemoProjectDetail
                ref={projectDetailRef}
                project={sel}
                onStartWork={() => {
                  startWork(sel.id);
                  // Tour Step 3 → 4: start-work clicked
                  window.dispatchEvent(new Event('tour:startWorkClicked'));
                }}
                onStopWork={() => stopWork(sel.id)}
                onEdit={() => { setEditProject(sel); setShowProjModal(true); }}
                onDelete={() => delProject(sel.id)}
                onArchive={() => archiveProject(sel.id)}
                onUnarchive={() => unarchiveProject(sel.id)}
                onSetEnv={env => setEnv(sel.id, env)}
                onReload={loadAll}
                onClearLogs={() => clearProjectLogs(sel.id)}
                onCustomCommandRun={() => {
                  // Tour Step 4 → 5: a custom command was run
                  window.dispatchEvent(new Event('tour:customCommandClicked'));
                }}
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

        <MemoStatusBar message={statusMsg} runningCount={runCount} projects={activeProjects} />

        {showProjModal && (
          <AddProjectModal project={editProject} onSave={saveProject} onClose={()=>{setShowProjModal(false);setEditProject(null);}} />
        )}
        {showGrpModal && (
          <GroupModal group={editGroup} projects={activeProjects} onSave={saveGroup} onClose={()=>{setShowGrpModal(false);setEditGroup(null);}} />
        )}
        {portConflict && (
          <PortConflictModal conflict={portConflict} onResolved={resolvePort} onCancel={()=>{setPortConflict(null);setPendingStart(null);}} />
        )}
        <SponsorshipPopup />
        <UpdateModal />
        <GlobalSearchModal
          isOpen={isGlobalSearchOpen}
          onClose={() => setIsGlobalSearchOpen(false)}
          projects={activeProjects}
          groups={groups}
          onSelectProject={(id) => { setSelectedId(id); setSelectedGrpId(null); }}
          onSelectGroup={(id) => { setSelectedGrpId(id); setSelectedId(null); }}
          startWork={startWork}
          stopWork={stopWork}
          onRestartProject={restartProject}
        />
        {showSettings && (
          <SettingsModal 
            settings={appSettings} 
            onSave={saveSettings} 
            onClose={() => setShowSettings(false)} 
          />
        )}
        <Tour
          isActive={isTourActive}
          projects={activeProjects}
          selectedId={selectedId}
          onComplete={() => setIsTourActive(false)}
        />
        {showBriefing && (
          <DailyBriefingModal 
            project={showBriefing} 
            onClose={() => setShowBriefing(null)} 
            onResumeWork={() => startWork(showBriefing.id)}
            onOpenIDE={() => api.work.openIDE(showBriefing.id)}
          />
        )}
      </div>
    </>
  );
}
