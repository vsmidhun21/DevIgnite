import { useEffect, useState } from 'react';
import StartWork         from './StartWork';
import LogViewer         from './LogViewer';
import ProductivityPanel from './ProductivityPanel';
import EnvSelector       from './EnvSelector';
import NotesTodosPanel   from './NotesTodosPanel';
import { GitBranch, Terminal, Globe, Code2, Play, Square } from 'lucide-react';

const api = window.devignite;

export default function ProjectDetail({
  project, logs, liveSecs,
  onStartWork, onStopWork, onEdit, onDelete, onSetEnv, onReload, onClearLogs
}) {
  const [envData,  setEnvData]  = useState({ available:['dev'], files:[] });
  const [leftTab,  setLeftTab]  = useState('info');
  const isRunning = project.status==='running'||project.status==='starting';

  const steps = (() => { try { return JSON.parse(project.startup_steps||'[]'); } catch { return []; } })();
  const git = project.git||{};

  useEffect(() => {
    if (!project.path) return;
    api.env.detect(project.path).then(setEnvData).catch(()=>{});
  }, [project.path]);

  const changeEnvFile = async (f) => {
    await api.projects.update(project.id, {env_file:f||null});
    onReload?.();
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
              <div className="section-label">Overview</div>
              <div className="meta-grid">
                <MetaCard label="Type"   value={project.type} />
                <MetaCard label="Status" value={project.status||'stopped'} accent={isRunning?'running':''} />
                <MetaCard label="Port"   value={project.port?`:${project.port}`:'—'} />
                <MetaCard label="IDE"    value={project.ide} />
                {project.url && <MetaCard label="URL" value={project.url} />}
                <MetaCard label="PID"    value={project.pid??'—'} />
              </div>
            </section>

            {git.hasGit && (
              <section>
                <div className="section-label">Git</div>
                <div className="git-info-block">
                  <div className="git-row"><span className="git-key">Branch</span><span className="git-val">{git.branch}{git.isDirty?' *':''}</span></div>
                  {git.shortHash&&<div className="git-row"><span className="git-key">Commit</span><span className="git-val mono">{git.shortHash}</span></div>}
                  {git.changedFiles>0&&<div className="git-row"><span className="git-key">Changed</span><span className="git-val">{git.changedFiles} files</span></div>}
                </div>
              </section>
            )}

            <section>
              <div className="section-label">Environment</div>
              <div className="env-row">
                {['dev','test','staging','prod'].map(env => {
                  const ok = envData.available.includes(env);
                  return (
                    <button key={env}
                      className={`env-pill ${project.active_env===env?'active':''} ${!ok?'inactive':''}`}
                      onClick={()=>ok&&onSetEnv(env)} disabled={!ok}
                      title={ok?`Switch to ${env}`:`No .env.${env}`}>
                      {env}{!ok&&<span className="env-no-file"/>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="section-label">Env file</div>
              <EnvSelector project={project} envFiles={envData.files} onChange={changeEnvFile}/>
            </section>

            <section>
              {steps.length>0 ? (
                <>
                  <div className="section-label">Startup steps</div>
                  <div className="steps-display">
                    {steps.map((s,i)=>(
                      <div key={i} className="step-badge">
                        <span className="step-badge-num">{i+1}</span>
                        <span className="step-badge-label">{s.label||'Step'}</span>
                        <span className="step-badge-cmd">$ {s.cmd}</span>
                        {s.wait&&<span className="step-badge-wait">wait</span>}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="section-label">Command</div>
                  <div className="cmd-display">$ {project.command}</div>
                </>
              )}
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

function MetaCard({ label, value, accent }) {
  return (
    <div className="meta-card">
      <div className="meta-label">{label}</div>
      <div className={`meta-value ${accent||''}`}>{value??'—'}</div>
    </div>
  );
}
