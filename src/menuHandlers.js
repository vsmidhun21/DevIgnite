import { useEffect } from 'react';

export function useMenuHandlers({
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
  setReady
}) {
  useEffect(() => {
    if (!window.api?.onMenu) return;

    // ── Function Definitions ──
    const openAddProjectModal = () => { setEditProject(null); setShowProjModal(true); };
    const openWorkspaceModal = () => { setEditGroup(null); setShowGrpModal(true); };
    const editSelectedProject = () => {
      const p = projects.find(x => x.id === selectedId);
      if (p) { setEditProject(p); setShowProjModal(true); }
    };
    const deleteSelectedProject = () => { if (selectedId) delProject(selectedId); };
    const startProject = () => { if (selectedId) startWork(selectedId); };
    const stopProject = () => { if (selectedId) stopWork(selectedId); };
    const startWorkspace = async () => { if (selectedGrpId) { await window.devignite.groups.start(selectedGrpId); loadAll(); } };
    const installDependencies = () => { if (selectedId) window.devignite.work.run(selectedId); };
    const toggleSidebar = () => { document.querySelector('.sidebar')?.classList.toggle('hidden'); };
    const toggleLogs = () => { document.querySelector('.detail-right')?.classList.toggle('hidden'); };
    const refreshProjects = () => { setReady(false); loadAll().finally(() => setReady(true)); };
    const toggleFullscreen = () => { window.devignite.window.maximize(); };
    const killPort = () => {
      const p = projects.find(x => x.id === selectedId);
      if (p?.port) window.devignite.ports.kill(p.port);
    };
    const openFolder = () => { if (selectedId) window.devignite.work.openTerminal(selectedId); };
    const openIDE = () => { if (selectedId) window.devignite.work.openIDE(selectedId); };
    const clearLogs = () => { if (selectedId) window.devignite.logs.clear(selectedId); };

    // ── Menu Listener ──
    const unsub = window.api.onMenu((action) => {
      switch (action) {
        case "new-project": openAddProjectModal(); break;
        case "new-workspace": openWorkspaceModal(); break;
        case "edit-project": editSelectedProject(); break;
        case "delete-project": deleteSelectedProject(); break;
        case "start-work": startProject(); break;
        case "stop-work": stopProject(); break;
        case "start-workspace": startWorkspace(); break;
        case "install-deps": installDependencies(); break;
        case "toggle-sidebar": toggleSidebar(); break;
        case "toggle-logs": toggleLogs(); break;
        case "toggle-fullscreen": toggleFullscreen(); break;
        case "refresh": refreshProjects(); break;
        case "kill-port": killPort(); break;
        case "open-folder": openFolder(); break;
        case "open-ide": openIDE(); break;
        case "clear-logs": clearLogs(); break;
        default: break;
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [
    selectedId, selectedGrpId, projects, setEditProject, setShowProjModal,
    setEditGroup, setShowGrpModal, delProject, startWork, stopWork, loadAll, setReady
  ]);
}
