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
        <div className="prod-stat streak">
          <span className="prod-label"><Flame size={9} strokeWidth={2}/> Streak</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="prod-value streak-val">{streak.current>0?`${streak.current}d`:'—'}</span>
            {streak.longest>streak.current&&<span className="prod-best">(best {streak.longest}d)</span>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="section-label" style={{ fontSize: '9px', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>Weekly Breakdown</span>
          <span style={{ opacity: 0.5 }}>{fmt(weekSeconds)} total</span>
        </div>
        <div className="prod-chart" style={{ height: 60 }}>
          {[...daily].slice(0, 7).reverse().map((d,i)=>{
            const h = Math.round((d.seconds/max)*60);
            const today = d.day===new Date().toISOString().slice(0,10);
            return (
              <div key={i} className="prod-bar-col" title={`${d.day}: ${fmt(d.seconds)}`}>
                <div className={`prod-bar ${today?'today':''}`} style={{height:Math.max(h,2), background: today ? 'var(--ignite)' : 'var(--accent)'}}/>
                <div className="prod-bar-label" style={{ fontSize: '8px' }}>
                  {new Date(d.day+'T00:00:00').toLocaleDateString(undefined,{weekday:'narrow'})}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="section-label" style={{ fontSize: '10px', marginBottom: 10, color: 'var(--t2)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Monthly Report (April)</span>
          <span style={{ color: 'var(--accent)', opacity: 0.8 }}>{stats.daily.length > 0 ? 'Project Insight' : 'Wait for data...'}</span>
        </div>
        <div className="calendar-chart-container" style={{ 
          height: '110px', 
          background: 'var(--bg2)', 
          borderRadius: '12px', 
          padding: '16px 12px 10px 12px',
          border: '1px solid var(--b0)',
          position: 'relative',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <svg width="100%" height="70" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ignite)" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="var(--ignite)" stopOpacity="0"/>
              </linearGradient>
            </defs>
            
            {/* Grid Lines */}
            <line x1="0" y1="40" x2="100" y2="40" stroke="var(--b1)" strokeWidth="0.2" />
            <line x1="0" y1="20" x2="100" y2="20" stroke="var(--b1)" strokeWidth="0.1" strokeDasharray="1,1" />
            <line x1="0" y1="0" x2="100" y2="0" stroke="var(--b1)" strokeWidth="0.2" />

            {(() => {
              const now = new Date();
              const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              const todayDay = now.getDate();
              
              // Prepare monthly data points (1 to daysInMonth)
              const monthData = [];
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const entry = daily.find(x => x.day === dateStr);
                monthData.push({ day: d, seconds: entry ? entry.seconds : 0, isFuture: d > todayDay });
              }

              // Max for scaling - use 1 hour minimum floor for nice visuals
              const monthMax = Math.max(...monthData.map(m => m.seconds), 3600);

              // Path points up to today
              const activePoints = monthData.filter(m => !m.isFuture).map((m, i) => {
                const x = ((m.day - 1) / (daysInMonth - 1)) * 100;
                const h = (m.seconds / monthMax) * 38;
                return `${x},${40 - h}`;
              }).join(' ');

              // Path points for future (ghost track)
              const futurePoints = monthData.map((m, i) => {
                const x = ((m.day - 1) / (daysInMonth - 1)) * 100;
                return `${x},40`;
              }).join(' ');

              return (
                <>
                  {/* Fill Area */}
                  {activePoints && (
                    <path 
                      d={`M 0 40 ${activePoints} L ${((todayDay - 1) / (daysInMonth - 1)) * 100} 40 Z`}
                      fill="url(#monthGrad)"
                    />
                  )}

                  {/* Future Track Base */}
                  <polyline
                    fill="none"
                    stroke="var(--b1)"
                    strokeWidth="0.5"
                    strokeDasharray="1,2"
                    points={monthData.map(m => `${((m.day - 1) / (daysInMonth - 1)) * 100},40`).join(' ')}
                  />

                  {/* Active Line */}
                  <polyline
                    fill="none"
                    stroke="var(--ignite)"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={activePoints}
                    style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}
                  />

                  {/* Markers */}
                  {monthData.map((m, i) => {
                    if (m.isFuture || m.seconds <= 0) return null;
                    const x = ((m.day - 1) / (daysInMonth - 1)) * 100;
                    const h = (m.seconds / monthMax) * 38;
                    const isToday = m.day === todayDay;
                    return (
                      <g key={i}>
                        <circle 
                          cx={x} 
                          cy={40 - h} 
                          r={isToday ? 2.5 : 1.5} 
                          fill={isToday ? 'var(--ignite)' : 'var(--bg0)'} 
                          stroke="var(--ignite)" 
                          strokeWidth={isToday ? 0 : 1}
                        />
                        {isToday && (
                          <circle cx={x} cy={40 - h} r="5" fill="var(--ignite)" opacity="0.2">
                            <animate attributeName="r" from="2.5" to="6" dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
                          </circle>
                        )}
                      </g>
                    );
                  })}
                  
                  {/* Today Indicator Text */}
                  <text 
                    x={((todayDay - 1) / (daysInMonth - 1)) * 100} 
                    y="45" 
                    textAnchor="middle" 
                    fill="var(--ignite)" 
                    fontSize="5" 
                    fontWeight="bold"
                  >
                    TODAY
                  </text>
                </>
              );
            })()}
          </svg>
          
          {/* Calendar Day Labels (selective) */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: 18, 
            padding: '0 2px' 
          }}>
            {[1, 5, 10, 15, 20, 25, 30].map(d => (
              <span key={d} style={{ fontSize: '8px', color: 'var(--t2)', fontWeight: 600 }}>{d}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
