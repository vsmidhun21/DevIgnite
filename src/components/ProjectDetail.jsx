import { useEffect, useState } from 'react';
import StartWork         from './StartWork';
import LogViewer         from './LogViewer';
import ProductivityPanel from './ProductivityPanel';
import EnvSelector       from './EnvSelector';

const api = window.devignite;

export default function ProjectDetail({
  project, logs, liveSecs,
  onStartWork, onStopWork, onEdit, onDelete, onSetEnv, onReload,
}) {
  const [envData, setEnvData] = useState({ available: ['dev'], files: [] });
  const [leftTab, setLeftTab] = useState('info'); // 'info' | 'productivity'
  const isRunning = project.status === 'running' || project.status === 'starting';

  const steps = (() => {
    try { return JSON.parse(project.startup_steps || '[]'); } catch { return []; }
  })();

  const git = project.git || {};

  useEffect(() => {
    if (!project.path) return;
    api.env.detect(project.path).then(setEnvData).catch(() => {});
  }, [project.path]);

  const handleEnvFileChange = async (filename) => {
    await api.projects.update(project.id, { env_file: filename || null });
    onReload?.();
  };

  return (
    <div className="project-detail">
      {/* Header */}
      <div className="detail-header">
        <div className="detail-title-block">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <h2 className="detail-title">{project.name}</h2>
            {git.hasGit && (
              <span className="git-branch-badge" title={`${git.branch}${git.isDirty ? ' (uncommitted changes)' : ''}`}>
                ⎇ {git.branch}{git.isDirty ? '*' : ''}
                {git.ahead > 0 && <span className="git-ahead"> ↑{git.ahead}</span>}
                {git.behind > 0 && <span className="git-behind"> ↓{git.behind}</span>}
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

      {/* Action bar */}
      <div className="action-bar">
        <StartWork project={project} liveSecs={liveSecs} onStartWork={onStartWork} onStopWork={onStopWork} />
        <div className="action-sep" />
        <button className="action-btn" title="Run only" onClick={() => api.work.run(project.id)} disabled={isRunning}>
          <span className="action-btn-icon run-icon" /> Run
        </button>
        {isRunning && (
          <button className="action-btn danger" title="Stop" onClick={() => api.work.stop(project.id)}>
            <span className="action-btn-icon stop-sq-icon" /> Stop
          </button>
        )}
        <button className="action-btn" title="Open IDE" onClick={() => api.work.openIDE(project.id)}>
          <span className="action-btn-icon ide-icon" /> IDE
        </button>
        <button className="action-btn" title="Open terminal" onClick={() => api.work.openTerminal(project.id)}>
          <span className="action-btn-icon term-icon" /> Terminal
        </button>
        {project.url && (
          <button className="action-btn" title={project.url} onClick={() => api.work.openBrowser(project.id)}>
            <span className="action-btn-icon browser-icon" /> Browser
          </button>
        )}
      </div>

      {/* Body */}
      <div className="detail-body">
        <div className="detail-left">
          {/* Left tab switcher */}
          <div className="left-tabs">
            <button className={`left-tab ${leftTab==='info'?'active':''}`} onClick={() => setLeftTab('info')}>Info</button>
            <button className={`left-tab ${leftTab==='productivity'?'active':''}`} onClick={() => setLeftTab('productivity')}>Productivity</button>
          </div>

          {leftTab === 'info' && <>
            <section>
              <div className="section-label">Overview</div>
              <div className="meta-grid">
                <MetaCard label="Type"   value={project.type} />
                <MetaCard label="Status" value={project.status || 'stopped'} accent={isRunning ? 'running' : ''} />
                <MetaCard label="Port"   value={project.port ? `:${project.port}` : '—'} />
                <MetaCard label="IDE"    value={project.ide} />
                {project.url && <MetaCard label="URL" value={project.url} />}
                <MetaCard label="PID"    value={project.pid ?? '—'} />
              </div>
            </section>

            {git.hasGit && (
              <section>
                <div className="section-label">Git</div>
                <div className="git-info-block">
                  <div className="git-row"><span className="git-key">Branch</span><span className="git-val">{git.branch}{git.isDirty ? ' *' : ''}</span></div>
                  {git.shortHash && <div className="git-row"><span className="git-key">Commit</span><span className="git-val mono">{git.shortHash}</span></div>}
                  {git.changedFiles > 0 && <div className="git-row"><span className="git-key">Changed</span><span className="git-val">{git.changedFiles} files</span></div>}
                  {(git.ahead > 0 || git.behind > 0) && (
                    <div className="git-row">
                      <span className="git-key">Remote</span>
                      <span className="git-val">
                        {git.ahead > 0 && `↑${git.ahead} ahead`}
                        {git.ahead > 0 && git.behind > 0 && ' · '}
                        {git.behind > 0 && `↓${git.behind} behind`}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section>
              <div className="section-label">Environment</div>
              <div className="env-row">
                {['dev','test','staging','prod'].map(env => {
                  const available = envData.available.includes(env);
                  return (
                    <button
                      key={env}
                      className={`env-pill ${project.active_env===env?'active':''} ${!available?'inactive':''}`}
                      onClick={() => available && onSetEnv(env)}
                      disabled={!available}
                      title={available ? `Switch to ${env}` : `No .env.${env} file`}
                    >
                      {env}{!available && <span className="env-no-file" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="section-label">Env file</div>
              <EnvSelector project={project} envFiles={envData.files} onChange={handleEnvFileChange} />
            </section>

            <section>
              {steps.length > 0 ? (
                <>
                  <div className="section-label">Startup steps</div>
                  <div className="steps-display">
                    {steps.map((s, i) => (
                      <div key={i} className="step-badge">
                        <span className="step-badge-num">{i + 1}</span>
                        <span className="step-badge-label">{s.label || 'Step'}</span>
                        <span className="step-badge-cmd">$ {s.cmd}</span>
                        {s.wait && <span className="step-badge-wait">wait</span>}
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

          {leftTab === 'productivity' && (
            <section>
              <ProductivityPanel projectId={project.id} />
            </section>
          )}
        </div>

        <div className="detail-right">
          <div className="section-label">Logs</div>
          <LogViewer projectId={project.id} streamedLogs={logs} />
        </div>
      </div>
    </div>
  );
}

function MetaCard({ label, value, accent }) {
  return (
    <div className="meta-card">
      <div className="meta-label">{label}</div>
      <div className={`meta-value ${accent||''}`}>{value ?? '—'}</div>
    </div>
  );
}
