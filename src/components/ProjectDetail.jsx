// desktop/renderer/src/components/ProjectDetail.jsx
import { useEffect, useRef } from 'react';

const ENVS = ['dev', 'staging', 'prod'];

function fmtUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
}

export default function ProjectDetail({ project, logs, onRun, onStop, onOpenIDE, onEdit, onDelete, onSetEnv }) {
  const isRunning = project.status === 'running';
  const logRef = useRef(null);

  // Auto-scroll log panel to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const steps = (() => {
    try { return JSON.parse(project.startup_steps || '[]'); } catch { return []; }
  })();

  return (
    <div className="project-detail">
      {/* Header */}
      <div className="detail-header">
        <div>
          <h2 className="detail-title">{project.name}</h2>
          <div className="detail-path">{project.path}</div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={onOpenIDE}>Open {project.ide || 'IDE'}</button>
          <button className="btn" onClick={onEdit}>Edit</button>
          {isRunning
            ? <button className="btn danger" onClick={onStop}>■ Stop</button>
            : <button className="btn primary" onClick={onRun}>▶ Run</button>
          }
        </div>
      </div>

      {/* Meta grid */}
      <section>
        <div className="section-label">Overview</div>
        <div className="meta-grid">
          <MetaCard label="Type"   value={project.type} />
          <MetaCard label="Status" value={project.status || 'stopped'} accent={isRunning ? 'running' : ''} />
          <MetaCard label="Port"   value={project.port ? `:${project.port}` : '—'} />
          <MetaCard label="IDE"    value={project.ide} />
          <MetaCard label="Uptime" value={fmtUptime(project.uptimeMs)} />
          <MetaCard label="PID"    value={project.pid ?? '—'} />
        </div>
      </section>

      {/* Environment */}
      <section>
        <div className="section-label">Environment</div>
        <div className="env-row">
          {ENVS.map(env => (
            <button key={env}
              className={`env-pill ${project.active_env === env ? 'active' : ''}`}
              onClick={() => onSetEnv(env)}>
              {env}
            </button>
          ))}
        </div>
      </section>

      {/* Startup steps or single command */}
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

      {/* Logs */}
      <section className="log-section">
        <div className="section-label">Logs</div>
        <div className="log-panel" ref={logRef}>
          {logs.length === 0
            ? <div className="log-empty">No output yet. Run the project to see logs.</div>
            : logs.map((line, i) => (
              <div key={i} className={`log-line ${line.level}`}>
                <span className="log-ts">{new Date(line.ts).toTimeString().slice(0, 8)}</span>
                {line.message}
              </div>
            ))
          }
        </div>
      </section>

      {/* Danger zone */}
      <section className="danger-zone">
        <button className="btn small danger" onClick={onDelete}>Delete project</button>
      </section>
    </div>
  );
}

function MetaCard({ label, value, accent }) {
  return (
    <div className="meta-card">
      <div className="meta-label">{label}</div>
      <div className={`meta-value ${accent || ''}`}>{value ?? '—'}</div>
    </div>
  );
}
