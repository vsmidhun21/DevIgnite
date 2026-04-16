import { useState, useEffect } from 'react';
import { Timer, Flame, ChevronDown, ChevronUp } from 'lucide-react';

const api = window.devignite;

const fmt = (s) => {
  if (!s) return '—';
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return [h>0&&`${h}h`,m>0&&`${m}m`,`${sec}s`].filter(Boolean).join(' ');
};

export default function TimeDisplay({ projectId }) {
  const [stats,    setStats]    = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      api.time.productivity(projectId),
      api.time.history(projectId, 10),
    ]).then(([prod, hist]) => setStats({ ...prod, history: hist }));
  }, [projectId]);

  if (!stats) return null;
  const { todaySeconds, weekSeconds, allTimeSeconds, streak } = stats;

  return (
    <div className="time-display">
      <div className="time-summary">
        <div className="time-stat">
          <span className="time-label"><Timer size={9} strokeWidth={2}/> Today</span>
          <span className="time-value">{fmt(todaySeconds)}</span>
        </div>
        <div className="time-stat">
          <span className="time-label">Week</span>
          <span className="time-value">{fmt(weekSeconds)}</span>
        </div>
        {allTimeSeconds > 0 && (
          <div className="time-stat">
            <span className="time-label">All time</span>
            <span className="time-value">{fmt(allTimeSeconds)}</span>
          </div>
        )}
        {streak?.current > 0 && (
          <div className="time-stat">
            <span className="time-label"><Flame size={9} strokeWidth={2}/> Streak</span>
            <span className="time-value" style={{color:'var(--ignite)'}}>{streak.current}d</span>
          </div>
        )}
        <button className="icon-btn" onClick={() => setExpanded(v => !v)} title="Session history">
          {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
        </button>
      </div>
      {expanded && (
        <div className="time-history">
          {!stats.history?.length ? (
            <div className="time-empty">No sessions yet</div>
          ) : (
            stats.history.map((s, i) => (
              <div key={i} className={`time-row ${s.status}`}>
                <span className="time-row-date">
                  {new Date(s.started_at).toLocaleDateString()} {new Date(s.started_at).toTimeString().slice(0,5)}
                </span>
                <span className="time-row-dur">{s.duration_seconds ? fmt(s.duration_seconds) : '—'}</span>
                <span className={`time-row-status ${s.status}`}>{s.status}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
