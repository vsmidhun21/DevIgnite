// src/components/ProductivityPanel.jsx
import { useState, useEffect } from 'react';
const api = window.devignite;

const fmt = (s) => {
  if (!s) return '0s';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

const MAX_BAR_H = 60;

export default function ProductivityPanel({ projectId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (projectId === undefined) return;
    api.time.productivity(projectId || null).then(setStats);
  }, [projectId]);

  if (!stats) return <div className="time-empty">Loading…</div>;

  const { todaySeconds, weekSeconds, allTimeSeconds, streak, daily } = stats;
  const maxDay = Math.max(...(daily.map(d => d.seconds) || [1]), 1);

  return (
    <div className="productivity-panel">
      {/* Summary row */}
      <div className="prod-summary">
        <div className="prod-stat">
          <span className="prod-label">Today</span>
          <span className="prod-value">{fmt(todaySeconds)}</span>
        </div>
        <div className="prod-stat">
          <span className="prod-label">This week</span>
          <span className="prod-value">{fmt(weekSeconds)}</span>
        </div>
        {allTimeSeconds > 0 && (
          <div className="prod-stat">
            <span className="prod-label">All time</span>
            <span className="prod-value">{fmt(allTimeSeconds)}</span>
          </div>
        )}
        <div className="prod-stat streak">
          <span className="prod-label">Streak</span>
          <span className="prod-value streak-val">
            {streak.current > 0 ? `🔥 ${streak.current}d` : '—'}
          </span>
          {streak.longest > streak.current && (
            <span className="prod-best">best: {streak.longest}d</span>
          )}
        </div>
      </div>

      {/* Bar chart — last 14 days */}
      {daily.length > 0 && (
        <div className="prod-chart">
          {[...daily].reverse().map((d, i) => {
            const h = Math.round((d.seconds / maxDay) * MAX_BAR_H);
            const isToday = d.day === new Date().toISOString().slice(0, 10);
            return (
              <div key={i} className="prod-bar-col" title={`${d.day}: ${fmt(d.seconds)}`}>
                <div
                  className={`prod-bar ${isToday ? 'today' : ''}`}
                  style={{ height: Math.max(h, 2) }}
                />
                <div className="prod-bar-label">
                  {new Date(d.day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
