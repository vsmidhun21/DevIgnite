import { Activity, Zap } from 'lucide-react';

const fmt = (s) => {
  if (!s && s !== 0) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

export default function Header({ selectedGroup, selectedProject, runningCount, liveSecs, status }) {
  const contextName = selectedGroup?.name || selectedProject?.name || null;
  const isRunning = selectedProject?.status === 'running';
  const timer = isRunning && liveSecs != null ? fmt(liveSecs) : null;

  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="app-header-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
              fill="var(--ignite)" stroke="var(--ignite)" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="app-header-name">DevIgnite</span>
        {contextName && (
          <>
            <span className="app-header-sep">›</span>
            <span className="app-header-ctx">{contextName}</span>
          </>
        )}
      </div>

      <div className="app-header-right">
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
    </header>
  );
}
