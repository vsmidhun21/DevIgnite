import { Activity, Minus, Square, X } from 'lucide-react';
import { useState } from 'react';

const fmt = (s) => {
  if (!s && s !== 0) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

export default function Header({ selectedGroup, selectedProject, runningCount, liveSecs, status }) {
  const contextName = selectedGroup?.name || selectedProject?.name || null;
  const isRunning = selectedProject?.status === 'running';
  const timer = isRunning && liveSecs != null ? fmt(liveSecs) : null;

  const [activeMenu, setActiveMenu] = useState(null);

  const handleMenuClick = (menu) => {
    setActiveMenu(menu);
    window.devignite?.window?.popupMenu(menu);
    setTimeout(() => setActiveMenu(null), 200); // Reset visual state after a short delay since native menu blocks thread
  };

  const closeMenu = () => setActiveMenu(null);

  return (
    <header className="app-header" onClick={closeMenu}>
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
          <button className="win-btn minimize" onClick={() => window.devignite?.window?.minimize()}>
            <Minus size={14} />
          </button>
          <button className="win-btn maximize" onClick={() => window.devignite?.window?.maximize()}>
            <Square size={12} />
          </button>
          <button className="win-btn close" onClick={() => window.devignite?.window?.close()}>
            <X size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
