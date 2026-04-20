import { useState, useEffect, useMemo } from 'react';
import { Timer, Flame, TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

const api = window.devignite;
const fmt = (s) => {
  if (!s) return '0s';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg1)',
        border: '1px solid var(--b0)',
        padding: '10px 12px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        fontSize: '11px'
      }}>
        <div style={{ color: 'var(--t2)', marginBottom: '4px', fontWeight: 600 }}>{payload[0].payload.fullDate}</div>
        <div style={{ color: 'var(--ignite)', fontWeight: 700 }}>
          {fmt(payload[0].value)}
        </div>
      </div>
    );
  }
  return null;
};

export default function ProductivityPanel({ projectId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (projectId === undefined) return;
    api.time.productivity(projectId || null).then(setStats);
  }, [projectId]);

  const monthData = useMemo(() => {
    if (!stats?.daily) return [];
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const todayDay = now.getDate();
    const data = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(now.getFullYear(), now.getMonth(), d);
      const dateStr = date.toISOString().slice(0, 10);
      const entry = stats.daily.find(x => x.day === dateStr);
      data.push({
        day: d,
        seconds: (entry ? entry.seconds : 0),
        fullDate: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        isFuture: d > todayDay
      });
    }
    return data;
  }, [stats]);

  if (!stats) return <div className="time-empty">Loading…</div>;
  const { todaySeconds, weekSeconds, allTimeSeconds, streak, daily } = stats;
  const max = Math.max(...(daily.map(d => d.seconds) || [1]), 3600);

  return (
    <div className="productivity-panel">
      <div className="prod-summary">
        <div className="prod-stat">
          <span className="prod-label"><Timer size={9} strokeWidth={2} /> Today</span>
          <span className="prod-value">{fmt(todaySeconds)}</span>
        </div>
        <div className="prod-stat">
          <span className="prod-label"><TrendingUp size={9} strokeWidth={2} /> Week</span>
          <span className="prod-value">{fmt(weekSeconds)}</span>
        </div>
        <div className="prod-stat streak">
          <span className="prod-label"><Flame size={9} strokeWidth={2} /> Streak</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="prod-value streak-val">{streak.current > 0 ? `${streak.current}d` : '—'}</span>
            {streak.longest > streak.current && <span className="prod-best">({streak.longest}d)</span>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="section-label" style={{ fontSize: '9px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span>Weekly Breakdown</span>
          <span style={{ opacity: 0.5 }}>{fmt(weekSeconds)} total</span>
        </div>
        <div className="prod-chart" style={{ height: 50 }}>
          {[...daily].slice(0, 7).reverse().map((d, i) => {
            const h = Math.round((d.seconds / max) * 50);
            const today = d.day === new Date().toISOString().slice(0, 10);
            return (
              <div key={i} className="prod-bar-col" title={`${d.day}: ${fmt(d.seconds)}`}>
                <div className={`prod-bar ${today ? 'today' : ''}`} style={{ height: Math.max(h, 2), background: today ? 'var(--ignite)' : 'var(--accent)' }} />
                <div className="prod-bar-label" style={{ fontSize: '8px' }}>
                  {new Date(d.day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="section-label" style={{ fontSize: '10px', marginBottom: 12, color: 'var(--t2)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Monthly Report</span>
          <span style={{ color: 'var(--ignite)', opacity: 0.8, fontSize: '9px' }}>Current Month Total: {fmt(monthData.reduce((acc, curr) => acc + curr.seconds, 0))}</span>
        </div>

        <div style={{
          height: '160px',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '12px',
          padding: '20px 10px 10px 0px',
          border: '1px solid var(--b0)'
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSeconds" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--ignite)" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="var(--ignite)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--t2)', fontSize: 9 }}
                interval={4}
              />
              <YAxis hide domain={[0, 'dataMax + 1200']} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--b1)', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="seconds"
                stroke="var(--ignite)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorSeconds)"
                animationDuration={1500}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.isFuture || payload.seconds === 0) return null;
                  const isToday = payload.day === new Date().getDate();
                  return (
                    <circle
                      key={payload.day}
                      cx={cx} cy={cy} r={isToday ? 4 : 1.5}
                      fill={isToday ? 'var(--ignite)' : 'var(--bg1)'}
                      stroke="var(--ignite)" strokeWidth={1}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
