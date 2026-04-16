import { useState, useEffect } from 'react';
import { Timer, Flame, TrendingUp } from 'lucide-react';

const api = window.devignite;
const fmt = (s) => {
  if (!s) return '0s';
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return [h>0&&`${h}h`,m>0&&`${m}m`,`${sec}s`].filter(Boolean).join(' ');
};
const MAX_H = 60;

export default function ProductivityPanel({ projectId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (projectId===undefined) return;
    api.time.productivity(projectId||null).then(setStats);
  }, [projectId]);

  if (!stats) return <div className="time-empty">Loading…</div>;
  const { todaySeconds, weekSeconds, allTimeSeconds, streak, daily } = stats;
  const max = Math.max(...(daily.map(d=>d.seconds)||[1]),1);

  return (
    <div className="productivity-panel">
      <div className="prod-summary">
        <div className="prod-stat">
          <span className="prod-label"><Timer size={9} strokeWidth={2}/> Today</span>
          <span className="prod-value">{fmt(todaySeconds)}</span>
        </div>
        <div className="prod-stat">
          <span className="prod-label"><TrendingUp size={9} strokeWidth={2}/> Week</span>
          <span className="prod-value">{fmt(weekSeconds)}</span>
        </div>
        {allTimeSeconds>0 && (
          <div className="prod-stat">
            <span className="prod-label">All time</span>
            <span className="prod-value">{fmt(allTimeSeconds)}</span>
          </div>
        )}
        <div className="prod-stat streak">
          <span className="prod-label"><Flame size={9} strokeWidth={2}/> Streak</span>
          <span className="prod-value streak-val">
            {streak.current>0?`${streak.current}d`:'—'}
          </span>
          {streak.longest>streak.current&&<span className="prod-best">best {streak.longest}d</span>}
        </div>
      </div>
      {daily.length>0 && (
        <div className="prod-chart">
          {[...daily].reverse().map((d,i)=>{
            const h = Math.round((d.seconds/max)*MAX_H);
            const today = d.day===new Date().toISOString().slice(0,10);
            return (
              <div key={i} className="prod-bar-col" title={`${d.day}: ${fmt(d.seconds)}`}>
                <div className={`prod-bar ${today?'today':''}`} style={{height:Math.max(h,2)}}/>
                <div className="prod-bar-label">
                  {new Date(d.day+'T00:00:00').toLocaleDateString(undefined,{weekday:'narrow'})}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
