import { useEffect, useState } from 'react';
import StartWork         from './StartWork';
import LogViewer         from './LogViewer';
import ProductivityPanel from './ProductivityPanel';
import EnvSelector       from './EnvSelector';
import NotesTodosPanel   from './NotesTodosPanel';
import { GitBranch, Terminal, Globe, Code2, Play, Square, FolderOpen, Trash2, Plus, Info, Cpu, Hash, Activity, Command, Boxes, Layers, Settings, Braces, TerminalSquare } from 'lucide-react';

const api = window.devignite;

export default function ProjectDetail({
  project, logs, liveSecs,
  onStartWork, onStopWork, onEdit, onDelete, onSetEnv, onReload, onClearLogs
}) {
  const [envData,  setEnvData]  = useState({ available:['dev'], files:[] });
  const [actions, setActions] = useState([]);
  const [newActionName, setNewActionName] = useState('');
  const [newActionCmd, setNewActionCmd] = useState('');
  const isRunning = project.status==='running'||project.status==='starting';
  const [terminalHeight, setTerminalHeight] = useState(() => {
    return parseInt(localStorage.getItem('terminalHeight')) || 280;
  });
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);

  const steps = (() => { try { return JSON.parse(project.startup_steps||'[]'); } catch { return []; } })();
  const git = project.git||{};

  useEffect(() => {
    if (!project.path) return;
    api.env.detect(project.path).then(setEnvData).catch(()=>{});
    api.actions.get(project.id).then(setActions).catch(()=>{});
  }, [project.path, project.id]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingTerminal) return;
      // Subtract status bar (24px) from the bottom calculation
      let newHeight = window.innerHeight - e.clientY - 24;
      if (newHeight < 120) newHeight = 120;
      if (newHeight > 600) newHeight = 600;
      setTerminalHeight(newHeight);
      localStorage.setItem('terminalHeight', newHeight);
    };
    const handleMouseUp = () => setIsResizingTerminal(false);

    if (isResizingTerminal) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTerminal]);

  const changeEnvFile = async (f) => {
    await api.projects.update(project.id, {env_file:f||null});
    onReload?.();
  };

  const addAction = async () => {
     if(!newActionName || !newActionCmd) return;
     const newObj = await api.actions.add(project.id, newActionName, newActionCmd);
     setActions([...actions, newObj]);
     setNewActionName('');
     setNewActionCmd('');
  };

  const deleteAction = async (id) => {
     await api.actions.delete(id);
     setActions(actions.filter(a => a.id !== id));
  };

  return (
    <div className="project-detail">
      <div className="detail-header">
        <div className="detail-title-block">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <h2 className="detail-title">{project.name}</h2>
            {git.hasGit && git.branch && (
              <span className="git-branch-badge">
                <GitBranch size={10} strokeWidth={2}/>
                {git.branch}{git.isDirty?'*':''}
                {git.ahead>0&&<span className="git-ahead"> +{git.ahead}</span>}
                {git.behind>0&&<span className="git-behind"> -{git.behind}</span>}
              </span>
            )}
          </div>
          <div className="detail-path">{project.path}</div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={onEdit}>Edit</button>
          <button className="btn danger small" onClick={onDelete}>Delete</button>
        </div>
      </div>

      <div className="action-bar">
        <StartWork project={project} liveSecs={liveSecs} onStartWork={onStartWork} onStopWork={onStopWork} />
        <div className="action-sep" />
        <button className="action-btn" onClick={()=>api.work.run(project.id)} disabled={isRunning} title="Run only">
          <Play size={11} strokeWidth={2}/> Run
        </button>
        {isRunning && (
          <button className="action-btn danger" onClick={()=>api.work.stop(project.id)} title="Stop">
            <Square size={11} strokeWidth={2}/> Stop
          </button>
        )}
        <button className="action-btn" onClick={()=>api.work.openIDE(project.id)} title="Open IDE">
          <Code2 size={11} strokeWidth={2}/> IDE
        </button>
        <button className="action-btn" onClick={()=>api.work.openTerminal(project.id)} title="Terminal">
          <Terminal size={11} strokeWidth={2}/> Terminal
        </button>
        {project.url && (
          <button className="action-btn" onClick={()=>api.work.openBrowser(project.id)} title={project.url}>
            <Globe size={11} strokeWidth={2}/> Browser
          </button>
        )}
        <button className="action-btn" onClick={()=>api.work.openFolder(project.path)} title="Open Folder">
          <FolderOpen size={11} strokeWidth={2}/> Folder
        </button>
      </div>

      <div className="detail-body">
        <div className="detail-dashboard">
          <div className="dashboard-left">
            <div className="dashboard-section">
              <div className="section-title"><Activity size={12}/> Overview</div>
              <div className="meta-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                <MetaCard icon={<Boxes size={12}/>} label="Type"   value={project.type} />
                <MetaCard icon={<Activity size={12}/>} label="Status" value={project.status||'stopped'} accent={isRunning?'running':''} />
                <MetaCard icon={<Hash size={12}/>} label="Port"   value={project.port?`:${project.port}`:'—'} />
                <MetaCard icon={<Code2 size={12}/>} label="IDE"    value={project.ide} />
                <MetaCard icon={<Cpu size={12}/>} label="PID"    value={project.pid??'—'} />
              </div>
              {project.url && (
                <a className="meta-url-card" onClick={() => api.work.openBrowser(project.id)} title="Open in Browser">
                  <Globe size={14} style={{ color: 'var(--ignite)' }} />
                  <span className="meta-url-text">{project.url}</span>
                  <div style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--t2)', opacity: 0.6 }}>Click to open</div>
                </a>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {git.hasGit && (
                  <div className="dashboard-section">
                    <div className="section-title"><GitBranch size={12}/> Source Control</div>
                    <div className="git-info-block">
                      <div className="git-row" style={{ display: 'flex', justifyContent: 'space-between' }}><span className="git-key">Branch</span><span className="git-val" style={{ fontWeight: 600 }}>{git.branch}{git.isDirty?' *':''}</span></div>
                      {git.shortHash&&<div className="git-row" style={{ display: 'flex', justifyContent: 'space-between' }}><span className="git-key">Commit</span><span className="git-val mono" style={{ fontSize: '10px' }}>{git.shortHash}</span></div>}
                      {git.changedFiles>0&&<div className="git-row" style={{ display: 'flex', justifyContent: 'space-between' }}><span className="git-key">Changes</span><span className="git-val" style={{ color: 'var(--ignite)', fontWeight: 600 }}>{git.changedFiles} files</span></div>}
                    </div>
                  </div>
                )}

                <div className="dashboard-section">
                  <div className="section-title"><Layers size={12}/> Environments</div>
                  <div className="env-row">
                    {['dev','test','staging','prod'].map(env => {
                      const ok = envData.available.includes(env);
                      return (
                        <button key={env}
                          className={`env-pill ${project.active_env===env?'active':''} ${!ok?'inactive':''}`}
                          onClick={()=>ok&&onSetEnv(env)} disabled={!ok}
                          style={{ 
                            padding: '4px 10px',
                            borderRadius: '100px',
                            border: project.active_env===env ? '1px solid var(--accent)' : '1px solid var(--b1)',
                            background: project.active_env===env ? 'var(--accent-bg)' : 'transparent',
                            color: project.active_env===env ? 'var(--accent)' : 'var(--t2)',
                            fontSize: '11px',
                            fontWeight: project.active_env===env ? 600 : 400,
                            cursor: ok ? 'pointer' : 'not-allowed',
                            opacity: ok ? 1 : 0.4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: project.active_env===env ? 'var(--accent)' : 'var(--b2)' }} />
                          {env}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="dashboard-section">
                  <div className="section-title"><Braces size={12}/> Configuration</div>
                  <EnvSelector project={project} envFiles={envData.files} onChange={changeEnvFile}/>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="dashboard-section">
                  <div className="section-title"><Command size={12}/> Startup Template</div>
                  {steps.length>0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {steps.map((s,i)=>(
                        <div key={i} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          background: 'var(--bg0)', 
                          border: '1px solid var(--b0)', 
                          padding: '5px 8px', 
                          borderRadius: '6px' 
                        }}>
                          <span style={{ fontSize: '10px', color: 'var(--t2)', fontWeight: 700 }}>{i+1}</span>
                          <span style={{ flex: 1, fontSize: '11px', fontWeight: 600 }}>{s.label||'Step'}</span>
                          <span style={{ color: 'var(--t2)', fontSize: '10px', fontFamily: 'var(--font)' }}>$ {s.cmd}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--bg0)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--b0)', fontFamily: 'var(--font)', fontSize: '11px', color: 'var(--t1)' }}>
                       <span style={{ color: 'var(--ignite)', marginRight: '4px', fontWeight: 700 }}>$</span> {project.command}
                    </div>
                  )}
                </div>

                <div className="dashboard-section">
                  <div className="section-title"><Settings size={12}/> Custom Toolbox</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {actions.map(a => (
                      <div key={a.id} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        background: 'var(--bg2)', 
                        border: '1px solid var(--b0)', 
                        borderRadius: '6px', 
                        padding: '8px 12px',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <span style={{ fontWeight: 600, fontSize: '12px' }}>{a.name}</span>
                          <span style={{ fontSize: '9px', color: 'var(--t2)', fontFamily: 'var(--font)' }}>$ {a.command}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => api.actions.run(a.id)} style={{ background: 'transparent', border: '1px solid var(--ignite)', color: 'var(--ignite)', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Run</button>
                          <button onClick={() => deleteAction(a.id)} style={{ background: 'transparent', color: 'var(--t2)', border: 'none', cursor: 'pointer', opacity: 0.6 }}><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                    {actions.length === 0 && <div style={{ fontSize: '11px', color: 'var(--t2)', fontStyle: 'italic', padding: '4px 0' }}>No actions defined.</div>}
                    
                    <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--b0)' }}>
                      <form onSubmit={e => { e.preventDefault(); addAction(); }} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input type="text" placeholder="Name" value={newActionName} onChange={e=>setNewActionName(e.target.value)} required 
                            style={{ flex: 1, background: 'var(--bg0)', border: '1px solid var(--b1)', color: 'var(--t0)', borderRadius: '4px', fontSize: '11px', padding: '4px 8px' }} />
                          <input type="text" placeholder="Cmd" title="Command" value={newActionCmd} onChange={e=>setNewActionCmd(e.target.value)} required 
                            style={{ flex: 2, background: 'var(--bg0)', border: '1px solid var(--b1)', color: 'var(--t0)', borderRadius: '4px', fontSize: '11px', padding: '4px 8px' }} />
                        </div>
                        <button type="submit" className="btn small primary" style={{ width: '100%', fontSize: '11px' }}><Plus size={12}/> Create Action</button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-title"><Activity size={12}/> Performance History</div>
              <ProductivityPanel projectId={project.id}/>
            </div>
          </div>

          <div className="dashboard-right">
            <div className="dashboard-section" style={{ height: '100%', gap: 0 }}>
               <NotesTodosPanel type="project" refId={project.id}/>
            </div>
          </div>
        </div>

        <div className={`resizer-h ${isResizingTerminal ? 'active' : ''}`} onMouseDown={() => setIsResizingTerminal(true)} />
        <div className="detail-terminal" style={{ '--terminal-h': `${terminalHeight}px` }}>
          <div className="log-toolbar" style={{ padding: '6px 16px', background: 'var(--bg1)', borderBottom: '1px solid var(--b0)' }}>
            <div className="section-title"><TerminalSquare size={12}/> Console Output</div>
          </div>
          <LogViewer projectId={project.id} streamedLogs={logs} onClearLogs={onClearLogs}/>
        </div>
      </div>
    </div>
  );
}

function MetaCard({ icon, label, value, accent }) {
  return (
    <div className="meta-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.7 }}>
        {icon}
        <div className="meta-label" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      </div>
      <div className={`meta-value ${accent||''}`} style={{ fontSize: '12px', fontWeight: 600 }}>{value??'—'}</div>
    </div>
  );
}
