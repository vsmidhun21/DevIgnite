import { useState, useEffect } from 'react';

const api = window.devignite;

const fmt = (s) => {
  if (!s) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

export default function StatusBar({ message, runningCount }) {
  const [time,       setTime]       = useState(new Date().toTimeString().slice(0, 8));
  const [todaySecs,  setTodaySecs]  = useState(0);
  const [streak,     setStreak]     = useState(null);
  const [ports,      setPorts]      = useState([]);
  const [showPorts,  setShowPorts]  = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toTimeString().slice(0, 8)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Load today's total across all projects every 30s
    const load = async () => {
      try {
        const stats = await api.time.productivity(null);
        setTodaySecs(stats.todaySeconds || 0);
        setStreak(stats.streak);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const loadPorts = async () => {
    const list = await api.ports.snapshot();
    setPorts(list.slice(0, 20)); // cap at 20
    setShowPorts(true);
  };

  const killPort = async (port) => {
    await api.ports.kill(port);
    await new Promise(r => setTimeout(r, 500));
    const list = await api.ports.snapshot();
    setPorts(list.slice(0, 20));
  };

  return (
    <>
      {/* Port snapshot flyout */}
      {showPorts && (
        <div className="port-flyout" onClick={() => setShowPorts(false)}>
          <div className="port-flyout-inner" onClick={e => e.stopPropagation()}>
            <div className="port-flyout-header">
              <span>Listening ports</span>
              <button className="icon-btn" onClick={() => setShowPorts(false)}>×</button>
            </div>
            <div className="port-list">
              {ports.length === 0 && <div className="group-empty-hint">No listening ports found</div>}
              {ports.map((p, i) => (
                <div key={i} className="port-row">
                  <span className="port-num">:{p.port}</span>
                  <span className="port-pid">PID {p.pid}</span>
                  <button className="port-kill-btn" onClick={() => killPort(p.port)}>Kill</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="status-bar">
        {runningCount > 0 && <div className="status-running-dot" />}
        <span className="status-msg">{message}</span>

        {runningCount > 0 && (
          <span className="status-running-count">{runningCount} running</span>
        )}

        <div className="status-right">
          {todaySecs > 0 && (
            <span className="status-today" title="Total coding time today">
              ⏱ {fmt(todaySecs)}
            </span>
          )}
          {streak?.current > 0 && (
            <span className="status-streak" title={`${streak.current}-day streak`}>
              🔥 {streak.current}d
            </span>
          )}
          <button
            className="status-ports-btn"
            onClick={loadPorts}
            title="View listening ports"
          >
            ports
          </button>
          <span className="status-time">{time}</span>
        </div>
      </div>
    </>
  );
}
