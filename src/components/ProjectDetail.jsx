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
  const [leftTab,  setLeftTab]  = useState('info');
  const [actions, setActions] = useState([]);
  const [newActionName, setNewActionName] = useState('');
  const [newActionCmd, setNewActionCmd] = useState('');
  const isRunning = project.status==='running'||project.status==='starting';

  const steps = (() => { try { return JSON.parse(project.startup_steps||'[]'); } catch { return []; } })();
  const git = project.git||{};

  useEffect(() => {
    if (!project.path) return;
    api.env.detect(project.path).then(setEnvData).catch(()=>{});
    api.actions.get(project.id).then(setActions).catch(()=>{});
  }, [project.path, project.id]);

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
        <div className="detail-left">
          <div className="left-tabs">
            <button className={`left-tab ${leftTab==='info'?'active':''}`} onClick={()=>setLeftTab('info')}>Info</button>
            <button className={`left-tab ${leftTab==='notes'?'active':''}`} onClick={()=>setLeftTab('notes')}>Notes</button>
            <button className={`left-tab ${leftTab==='productivity'?'active':''}`} onClick={()=>setLeftTab('productivity')}>Stats</button>
          </div>

          {leftTab==='info' && <>
            <section>
              <div className="section-label"><Activity size={12}/> Overview</div>
              <div className="meta-grid">
                <MetaCard icon={<Boxes size={12}/>} label="Type"   value={project.type} />
                <MetaCard icon={<Activity size={12}/>} label="Status" value={project.status||'stopped'} accent={isRunning?'running':''} />
                <MetaCard icon={<Hash size={12}/>} label="Port"   value={project.port?`:${project.port}`:'—'} />
                <MetaCard icon={<Code2 size={12}/>} label="IDE"    value={project.ide} />
                {project.url && <MetaCard icon={<Globe size={12}/>} label="URL" value={project.url} />}
                <MetaCard icon={<Cpu size={12}/>} label="PID"    value={project.pid??'—'} />
              </div>
            </section>

            {git.hasGit && (
              <section>
                <div className="section-label"><GitBranch size={12}/> Source Control</div>
                <div className="git-info-block" style={{ background: 'var(--bg1)', border: '1px solid var(--b0)', borderRadius: '8px', padding: '10px' }}>
                  <div className="git-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span className="git-key" style={{ color: 'var(--t2)', fontSize: '11px' }}>Branch</span><span className="git-val" style={{ fontWeight: 600 }}>{git.branch}{git.isDirty?' *':''}</span></div>
                  {git.shortHash&&<div className="git-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span className="git-key" style={{ color: 'var(--t2)', fontSize: '11px' }}>Commit</span><span className="git-val mono" style={{ fontSize: '10px', background: 'var(--bg3)', padding: '1px 4px', borderRadius: '3px' }}>{git.shortHash}</span></div>}
                  {git.changedFiles>0&&<div className="git-row" style={{ display: 'flex', justifyContent: 'space-between' }}><span className="git-key" style={{ color: 'var(--t2)', fontSize: '11px' }}>Changes</span><span className="git-val" style={{ color: 'var(--ignite)' }}>{git.changedFiles} files pending</span></div>}
                </div>
              </section>
            )}

            <section>
              <div className="section-label"><Layers size={12}/> Environments</div>
              <div className="env-row" style={{ padding: '4px 0' }}>
                {['dev','test','staging','prod'].map(env => {
                  const ok = envData.available.includes(env);
                  return (
                    <button key={env}
                      className={`env-pill ${project.active_env===env?'active':''} ${!ok?'inactive':''}`}
                      onClick={()=>ok&&onSetEnv(env)} disabled={!ok}
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '100px',
                        border: project.active_env===env ? '1px solid var(--accent)' : '1px solid var(--b1)',
                        background: project.active_env===env ? 'var(--accent-bg)' : 'transparent',
                        color: project.active_env===env ? 'var(--accent)' : 'var(--t2)',
                        fontSize: '11px',
                        fontWeight: project.active_env===env ? 600 : 400,
                        cursor: ok ? 'pointer' : 'not-allowed',
                        opacity: ok ? 1 : 0.4
                      }}
                      title={ok?`Switch to ${env}`:`No .env.${env}`}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: project.active_env===env ? 'var(--accent)' : 'var(--b2)' }} />
                      {env}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="section-label"><Braces size={12}/> Configuration</div>
              <EnvSelector project={project} envFiles={envData.files} onChange={changeEnvFile}/>
            </section>

            <section>
              <div className="section-label"><Command size={12}/> Execution Template</div>
              {steps.length>0 ? (
                <div className="steps-display" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {steps.map((s,i)=>(
                    <div key={i} className="step-badge" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      background: 'var(--bg1)', 
                      border: '1px solid var(--b0)', 
                      padding: '6px 10px', 
                      borderRadius: '6px' 
                    }}>
                      <span className="step-badge-num" style={{ width: '18px', height: '18px', background: 'var(--bg3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>{i+1}</span>
                      <span className="step-badge-label" style={{ flex: 1, fontSize: '11px', fontWeight: 600 }}>{s.label||'Step'}</span>
                      <span className="step-badge-cmd" style={{ color: 'var(--t2)', fontSize: '10px', fontFamily: 'var(--font)' }}>$ {s.cmd}</span>
                      {s.wait&&<span className="step-badge-wait" style={{ fontSize: '9px', background: 'var(--amber-bg)', color: 'var(--amber)', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>wait</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cmd-display" style={{ background: 'var(--bg1)', padding: '10px', borderRadius: '8px', border: '1px solid var(--b0)', fontFamily: 'var(--font)', fontSize: '11px', color: 'var(--t1)' }}>
                   <span style={{ color: 'var(--ignite)', marginRight: '6px', fontWeight: 700 }}>$</span> {project.command}
                </div>
              )}
            </section>

            <section>
              <div className="section-label"><Settings size={12}/> Custom Toolbox</div>
              <div className="actions-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {actions.length > 0 ? (
                  actions.map(a => (
                    <div key={a.id} className="action-row" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      background: 'var(--bg1)', 
                      border: '1px solid var(--b0)', 
                      borderRadius: '8px', 
                      padding: '8px 12px',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease'
                    }}>
                      <div className="action-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                        <span className="action-name" style={{ fontWeight: 600, fontSize: '12px' }}>{a.name}</span>
                        <span className="action-cmd" style={{ fontSize: '10px', color: 'var(--t2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font)' }}>$ {a.command}</span>
                      </div>
                      <div className="action-buttons" style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
                        <button 
                          onClick={() => api.actions.run(a.id)} 
                          className="action-run-btn"
                          title="Run action"
                          style={{ 
                            background: 'var(--ignite)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            padding: '6px 10px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                        >
                          <Play size={12} fill="currentColor"/> Run
                        </button>
                        <button 
                          onClick={() => deleteAction(a.id)} 
                          className="action-del-btn"
                          title="Delete action"
                          style={{ 
                            background: 'transparent', 
                            color: 'var(--t2)', 
                            border: '1px solid var(--b1)', 
                            borderRadius: '4px', 
                            padding: '6px 8px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--t2)', fontStyle: 'italic', padding: '4px 0' }}>No custom actions defined.</div>
                )}
              </div>
              
              <div className="add-action-form" style={{ 
                background: 'var(--bg2)', 
                padding: '12px', 
                borderRadius: '8px',
                border: '1px dashed var(--b1)'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add New Action</div>
                <form onSubmit={e => { e.preventDefault(); addAction(); }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Name (e.g. Build)" 
                      value={newActionName} 
                      onChange={e => setNewActionName(e.target.value)} 
                      required 
                      style={{ flex: 1, padding: '8px 10px', background: 'var(--bg0)', border: '1px solid var(--b1)', color: 'var(--t0)', borderRadius: '6px', fontSize: '12px' }} 
                    />
                    <input 
                      type="text" 
                      placeholder="Command (e.g. npm run build)" 
                      value={newActionCmd} 
                      onChange={e => setNewActionCmd(e.target.value)} 
                      required 
                      style={{ flex: 2, padding: '8px 10px', background: 'var(--bg0)', border: '1px solid var(--b1)', color: 'var(--t0)', borderRadius: '6px', fontSize: '12px' }} 
                    />
                  </div>
                  <button type="submit" className="start-work-btn" style={{ 
                    padding: '8px 12px', 
                    fontSize: '12px', 
                    justifyContent: 'center',
                    width: '100%' 
                  }}>
                    <Plus size={14} /> Create Action
                  </button>
                </form>
              </div>
            </section>
          </>}

          {leftTab==='notes' && (
            <NotesTodosPanel type="project" refId={project.id}/>
          )}

          {leftTab==='productivity' && (
            <section><ProductivityPanel projectId={project.id}/></section>
          )}
        </div>

        <div className="detail-right">
          <div className="section-label">Logs</div>
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
