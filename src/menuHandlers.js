import { useEffect } from 'react';

/**
 * Hook to handle menu actions from the main process.
 * Import and invoke this in your App.jsx or main layout.
 */
export function useMenuHandlers({
  setShowProjModal,
  setShowGrpModal,
  loadAll,
  selectedId,
  startWork,
  stopWork,
  delProject,
  setEditProject,
  projects
}) {
  useEffect(() => {
    const api = window.devignite?.window;
    if (!api) return;

    const listeners = [
      api.onMenuAction('new-project', () => {
        setEditProject(null);
        setShowProjModal(true);
      }),
      api.onMenuAction('new-workspace', () => {
        setShowGrpModal(true);
      }),
      api.onMenuAction('import-projects', () => {
        // Implement import logic
      }),
      api.onMenuAction('export-projects', () => {
        // Implement export logic
      }),
      
      api.onMenuAction('edit-project', () => {
        if (!selectedId) return;
        const p = projects?.find(x => x.id === selectedId);
        if (p) {
          setEditProject(p);
          setShowProjModal(true);
        }
      }),
      api.onMenuAction('delete-project', () => {
        if (selectedId) delProject(selectedId);
      }),
      api.onMenuAction('duplicate-project', () => {
        // Implement duplicate logic
      }),
      api.onMenuAction('open-settings', () => {
        // Implement settings logic
      }),

      api.onMenuAction('toggle-sidebar', () => {
        // Implement toggle sidebar logic
      }),
      api.onMenuAction('toggle-logs', () => {
        // Implement toggle logs logic
      }),
      api.onMenuAction('refresh-projects', () => {
        loadAll();
      }),

      api.onMenuAction('start-work', () => {
        if (selectedId) startWork(selectedId);
      }),
      api.onMenuAction('stop-work', () => {
        if (selectedId) stopWork(selectedId);
      }),
      api.onMenuAction('start-workspace', () => {
        // Implement start workspace logic
      }),
      api.onMenuAction('install-dependencies', () => {
        // Implement install logic
      }),

      api.onMenuAction('kill-port', () => {
        // Implement kill port logic
      }),
      api.onMenuAction('open-folder', () => {
        if (selectedId) window.devignite?.work?.openTerminal(selectedId); // Or equivalent
      }),
      api.onMenuAction('open-ide', () => {
        if (selectedId) window.devignite?.work?.openIDE(selectedId);
      }),
      api.onMenuAction('clear-logs', () => {
        if (selectedId) window.devignite?.logs?.clear(selectedId);
      }),

      api.onMenuAction('about', () => {
        // Implement about logic
      }),
      api.onMenuAction('open-logs-folder', () => {
        // Implement generic open logs logic
      })
    ];

    return () => {
      listeners.forEach(unsub => unsub?.());
    };
  }, [
    setShowProjModal,
    setShowGrpModal,
    loadAll,
    selectedId,
    startWork,
    stopWork,
    delProject,
    setEditProject,
    projects
  ]);
}
