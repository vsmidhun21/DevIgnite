import { useState, useEffect, memo } from 'react';
import { Play, Square, Loader2, GitBranch } from 'lucide-react';
import NotesTodosPanel from './NotesTodosPanel';

const api = window.devignite;
const fmt = (s) => {
  if (!s) return null;
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return [h>0&&`${h}h`,m>0&&`${m}m`,`${sec}s`].filter(Boolean).join(' ');
};

const GroupMemberCard = memo(({ p, onSelect, result }) => {
  const [live, setLive] = useState(null);

  useEffect(() => {
    if (p.status !== 'running') {
      setLive(null);
      return;
    }
    const unsub = api.on.tick(({ projectId, liveSecs }) => {
      if (projectId === p.id) setLive(liveSecs);
    });
    return () => unsub?.();
  }, [p.id, p.status]);

  return (
    <div className={`group-member-card ${p.status==='running'?'running':''}`}
      onClick={()=>onSelect(p.id)}>
      <div className="gmc-left">
        <span className={`status-dot ${p.status||'stopped'}`} style={{flexShrink:0}}/>
        <div>
          <div className="gmc-name">{p.name}</div>
          <div className="gmc-meta">
            <span className="type-badge-sm">{p.type?.split(' ')[0]}</span>
            {p.port&&<span className="gmc-port">:{p.port}</span>}
            {p.git?.hasGit&&p.git.branch&&(
              <span className="proj-branch">
                <GitBranch size={8} strokeWidth={2}/> {p.git.branch}{p.git.isDirty?'*':''}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="gmc-right">
        {live!=null&&p.status==='running'&&<span className="live-timer">{fmt(live)}</span>}
        {result&&!result.ok&&<span className="gmc-error" title={result.error}>✗</span>}
        {result?.ok&&<span className="gmc-ok">✓</span>}
      </div>
    </div>
  );
});

export default memo(function GroupPanel({ group, projects, onEdit, onDelete, onProjectSelect }) {
  const [loading,  setLoading]  = useState(false);
  const [results,  setResults]  = useState([]);

  const members    = projects.filter(p=>group.projectIds.includes(p.id));
  const allRunning = members.length>0&&members.every(p=>p.status==='running');
  const anyRunning = members.some(p=>p.status==='running');

  const startAll = async () => {
    setLoading(true); setResults([]);
    const r = await api.groups.start(group.id);
    setResults(r.results||[]);
    setLoading(false);
  };

  const stopAll = async () => {
    setLoading(true);
    await api.groups.stop(group.id);
    setResults([]);
    setLoading(false);
  };

  return (
    <div className="project-detail">
      <div className="detail-header">
        <div className="detail-title-block">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span className="group-color-dot" style={{background:group.color}}/>
            <h2 className="detail-title">{group.name}</h2>
          </div>
          <div className="detail-path">{members.length} projects</div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={onEdit}>Edit</button>
          <button className="btn danger small" onClick={onDelete}>Delete</button>
        </div>
      </div>

      <div className="action-bar">
        <button
          className={`start-work-btn ${allRunning?'running':''} ${loading?'loading':''}`}
          onClick={allRunning?stopAll:startAll}
          disabled={loading||members.length===0}>
          {loading
            ? <Loader2 size={14} strokeWidth={2} className="spin"/>
            : allRunning
              ? <><Square size={12} strokeWidth={2}/> Stop All</>
              : <><Play  size={12} strokeWidth={2}/> Start All</>}
        </button>
        {anyRunning&&!allRunning&&(
          <button className="action-btn danger" onClick={stopAll} disabled={loading}>Stop running</button>
        )}
        {members.length>0&&(
          <span className="work-today" style={{marginLeft:8}}>
            {members.filter(p=>p.status==='running').length}/{members.length} running
          </span>
        )}
      </div>

      <div className="group-content" style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
        <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:150}}>
          <div className="section-label" style={{padding:'10px 20px 0'}}>Projects</div>
          <div className="group-members" style={{flex:1, overflowY:'auto', padding:'10px 20px'}}>
            {members.length===0&&(
              <div className="steps-empty">
                No projects. Edit to add projects.
              </div>
            )}
            {members.map(p => (
              <GroupMemberCard 
                key={p.id} 
                p={p} 
                onSelect={onProjectSelect} 
                result={results.find(r=>r.projectId===p.id)} 
              />
            ))}
          </div>
        </div>

        <div style={{height:1, background:'var(--b0)', margin:'0 20px'}} />

        <div style={{height:'360px', overflow:'hidden', display:'flex', flexDirection:'column'}}>
          <div className="section-label" style={{padding:'10px 20px 0'}}>Notes & Tasks</div>
          <div style={{flex:1, overflowY:'auto', padding:'0 20px 20px'}}>
            <NotesTodosPanel type="workspace" refId={group.id} />
          </div>
        </div>
      </div>
    </div>
  );
});

