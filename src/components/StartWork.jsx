import { useState } from 'react';
import { Play, Square, Loader2 } from 'lucide-react';

const fmt = (s) => {
  if (!s && s!==0) return null;
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return [h>0&&`${h}h`,m>0&&`${m}m`,`${sec}s`].filter(Boolean).join(' ');
};

export default function StartWork({ project, liveSecs, onStartWork, onStopWork }) {
  const [loading, setLoading] = useState(false);
  const isRunning = project.status==='running'||project.status==='starting';

  const click = async () => {
    setLoading(true);
    try { if (isRunning) await onStopWork(); else await onStartWork(); }
    finally { setLoading(false); }
  };

  return (
    <div className="start-work-block">
      <button
        className={`start-work-btn ${isRunning?'running':''} ${loading?'loading':''}`}
        onClick={click} disabled={loading}>
        {loading
          ? <Loader2 size={14} strokeWidth={2} className="spin"/>
          : isRunning
            ? <><Square size={12} strokeWidth={2}/> Stop Work</>
            : <><Play  size={12} strokeWidth={2}/> Start Work</>}
      </button>
      {isRunning && (
        <div className="work-status-row">
          <span className="live-dot"/>
          <span className="live-label">{project.status==='starting'?'Starting…':'Running'}</span>
          {liveSecs!=null && <span className="live-timer">{fmt(liveSecs)}</span>}
          {project.pid && <span className="live-pid">PID {project.pid}</span>}
        </div>
      )}
      {!isRunning && project.todaySecs>0 && (
        <div className="work-today">Today: <strong>{fmt(project.todaySecs)}</strong></div>
      )}
    </div>
  );
}
