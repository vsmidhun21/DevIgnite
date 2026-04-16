import { useState, useEffect } from 'react';
import { Timer, Flame, Server, X } from 'lucide-react';

const api = window.devignite;

const DEV_PORTS = new Set([
  3000,3001,3002,3003,3004,3005,3006,3007,3008,3009,
  4000,4200,4201,5000,5001,5002,5173,5174,5175,
  6000,7000,8000,8001,8002,8008,8080,8081,8082,8083,8084,8085,8086,8088,8090,
  9000,9001,9002,9200,
]);

const isDevPort = (port) => DEV_PORTS.has(port) || (port >= 3000 && port <= 9999);

const fmt = (s) => {
  if (!s) return null;
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return [h>0&&`${h}h`, m>0&&`${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

export default function StatusBar({ message, runningCount, projects }) {
  const [time,      setTime]      = useState(new Date().toTimeString().slice(0,8));
  const [todaySecs, setTodaySecs] = useState(0);
  const [streak,    setStreak]    = useState(null);
  const [ports,     setPorts]     = useState([]);
  const [showPorts, setShowPorts] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toTimeString().slice(0,8)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const s = await api.time.productivity(null);
        setTodaySecs(s.todaySeconds || 0);
        setStreak(s.streak);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const loadPorts = async () => {
    try {
      const list = await api.ports.snapshot();
      const devOnly = list
        .filter(p => isDevPort(p.port))
        .map(p => {
          const matched = projects?.find(proj => proj.port === p.port);
          return { ...p, projectName: matched?.name || null };
        })
        .slice(0, 30);
      setPorts(devOnly);
      setShowPorts(true);
    } catch {}
  };

  const killPort = async (port) => {
    await api.ports.kill(port);
    await new Promise(r => setTimeout(r, 500));
    const list = await api.ports.snapshot();
    setPorts(
      list.filter(p => isDevPort(p.port))
        .map(p => ({ ...p, projectName: projects?.find(pr => pr.port === p.port)?.name || null }))
        .slice(0, 30)
    );
  };

  return (
    <>
      {showPorts && (
        <div className="port-flyout" onClick={() => setShowPorts(false)}>
          <div className="port-flyout-inner" onClick={e => e.stopPropagation()}>
            <div className="port-flyout-header">
              <span>Dev ports</span>
              <button className="icon-btn" onClick={() => setShowPorts(false)}>
                <X size={12} />
              </button>
            </div>
            <div className="port-list">
              {ports.length === 0 && (
                <div className="group-empty-hint">No dev ports in use</div>
              )}
              {ports.map((p, i) => (
                <div key={i} className="port-row">
                  <span className="port-num">:{p.port}</span>
                  <span className="port-pid">PID {p.pid}</span>
                  {p.projectName && (
                    <span className="port-project">{p.projectName}</span>
                  )}
                  <button className="port-kill-btn" onClick={() => killPort(p.port)}>Kill</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="status-bar">
        {runningCount > 0 && <span className="status-running-dot" />}
        <span className="status-msg">{message}</span>
        {runningCount > 0 && (
          <span className="status-running-count">{runningCount} running</span>
        )}
        <div className="status-right">
          {todaySecs > 0 && (
            <span className="status-today" title="Today">
              <Timer size={10} strokeWidth={2} />
              {fmt(todaySecs)}
            </span>
          )}
          {streak?.current > 0 && (
            <span className="status-streak" title={`${streak.current}d streak`}>
              <Flame size={10} strokeWidth={2} />
              {streak.current}d
            </span>
          )}
          <button className="status-ports-btn" onClick={loadPorts} title="Dev ports">
            <Server size={10} strokeWidth={2} />
            ports
          </button>
          <span className="status-time">{time}</span>
        </div>
      </div>
    </>
  );
}
