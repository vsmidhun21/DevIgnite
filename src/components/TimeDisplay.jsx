// src/components/TimeDisplay.jsx
// Shows session history, today total, and all-time total.

import { useState, useEffect } from 'react';

const api = window.devignite;

const fmt = (s) => {
  if (!s) return '0s';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

export default function TimeDisplay({ projectId }) {
  const [today,    setToday]    = useState(null);
  const [allTime,  setAllTime]  = useState(null);
  const [history,  setHistory]  = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    api.time.today(projectId).then(setToday);
    api.time.allTime(projectId).then(setAllTime);
    api.time.history(projectId, 10).then(setHistory);
  }, [projectId]);

  return (
    <div className="time-display">
      <div className="time-summary">
        <div className="time-stat">
          <span className="time-label">Today</span>
          <span className="time-value">{today ? fmt(today.seconds) : '—'}</span>
        </div>
        <div className="time-stat">
          <span className="time-label">All time</span>
          <span className="time-value">{allTime ? fmt(allTime.seconds) : '—'}</span>
        </div>
        <button
          className="icon-btn"
          title="Session history"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="time-history">
          {history.length === 0 ? (
            <div className="time-empty">No sessions yet.</div>
          ) : (
            history.map((s, i) => (
              <div key={i} className={`time-row ${s.status}`}>
                <span className="time-row-date">
                  {new Date(s.started_at).toLocaleDateString()} {new Date(s.started_at).toTimeString().slice(0,5)}
                </span>
                <span className="time-row-dur">
                  {s.duration_seconds ? fmt(s.duration_seconds) : '—'}
                </span>
                <span className={`time-row-status ${s.status}`}>{s.status}</span>
                {s.env_used && (
                  <span className="time-row-env">{s.env_used}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
