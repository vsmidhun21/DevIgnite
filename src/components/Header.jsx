import { Activity, Minus, Square, X, Copy } from 'lucide-react';
import { useState, useEffect, memo } from 'react';

const api = window.devignite;

const fmt = (s) => {
  if (!s && s !== 0) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

export default memo(function Header({ selectedGroup, selectedProject, runningCount }) {
  const contextName = selectedGroup?.name || selectedProject?.name || null;
  const isRunning = selectedProject?.status === 'running';
  
  const [live, setLive] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isRunning || !selectedProject?.id) {
      setLive(null);
      return;
    }
    const unsub = api.on.tick(({ projectId, liveSecs }) => {
      if (projectId === selectedProject.id) setLive(liveSecs);
    });
    return () => unsub?.();
  }, [selectedProject?.id, isRunning]);

  useEffect(() => {
    const win = api?.window;
    if (!win) return;

    win.isMaximized().then(setIsMaximized);
    return win.onMaximizeChange(setIsMaximized);
  }, []);

  const handleMenuClick = (menu) => {
    setActiveMenu(menu);
    api?.window?.popupMenu(menu);
    setTimeout(() => setActiveMenu(null), 200); 
  };

  const timer = isRunning && live != null ? fmt(live) : null;

  return (
    <header className="app-header" onClick={() => setActiveMenu(null)}>
      <div className="app-header-left">
        <div className="app-header-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
              fill="var(--ignite)" stroke="var(--ignite)" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>

        <nav className="app-menu">
          {['File', 'Edit', 'View', 'Run', 'Window', 'Help'].map(menu => (
            <button
              key={menu}
              className={`menu-btn ${activeMenu === menu ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); handleMenuClick(menu); }}
            >
              {menu}
            </button>
          ))}
        </nav>
      </div>

      <div className="app-header-center">
        {contextName ? (
          <span className="app-header-ctx">{contextName} - DevIgnite</span>
        ) : (
          <span className="app-header-ctx">DevIgnite</span>
        )}
      </div>

      <div className="app-header-right">
        <div className="app-header-stats">
          {timer && (
            <div className="app-header-timer">
              <Activity size={11} strokeWidth={2} />
              <span>{timer}</span>
            </div>
          )}
          {runningCount > 0 && (
            <div className="app-header-running">
              <span className="header-run-dot" />
              <span>{runningCount} running</span>
            </div>
          )}
        </div>

        <div className="window-controls">
          <button className="win-btn minimize" onClick={() => api?.window?.minimize()}>
            <Minus size={14} />
          </button>
          <button className="win-btn maximize" onClick={() => api?.window?.maximize()}>
            {isMaximized ? <Copy size={12} /> : <Square size={12} />}
          </button>
          <button className="win-btn close" onClick={() => api?.window?.close()}>
            <X size={14} />
          </button>
        </div>
      </div>
    </header>
  );
});

