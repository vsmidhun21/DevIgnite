import { useEffect, useRef } from 'react';
import StartWork   from './StartWork';
import LogViewer   from './LogViewer';
import TimeDisplay from './TimeDisplay';
import EnvSelector from './EnvSelector';

const ENVS = ['dev', 'test', 'staging', 'prod'];
const api  = window.devignite;

export default function ProjectDetail({
  project, logs, liveSecs,
  onStartWork, onStopWork, onEdit, onDelete, onSetEnv, onReload,
}) {
  const steps = (() => {
    try { return JSON.parse(project.startup_steps || '[]'); } catch { return []; }
  })();

  const handleEnvFileChange = async (filename) => {
    await api.projects.update(project.id, { env_file: filename });
    onReload?.();
  };

  return (
    <div className="project-detail">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="detail-header">
        <div className="detail-title-block">
          <h2 className="detail-title">{project.name}</h2>
          <div className="detail-path">{project.path}</div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={onEdit}>Edit</button>
          <button className="btn danger small" onClick={onDelete}>Delete</button>
        </div>
      </div>

      {/* ── START WORK ─────────────────────────────────────────────────── */}
      <StartWork
        project={project}
        liveSecs={liveSecs}
        onStartWork={onStartWork}
        onStopWork={onStopWork}
      />

      {/* ── Two-column body ────────────────────────────────────────────── */}
      <div className="detail-body">

        {/* Left column */}
        <div className="detail-left">

          {/* Meta */}
          <section>
            <div className="section-label">Overview</div>
            <div className="meta-grid">
              <MetaCard label="Type"   value={project.type} />
              <MetaCard label="Status" value={project.status || 'stopped'} accent={project.status === 'running' ? 'running' : ''} />
              <MetaCard label="Port"   value={project.port ? `:${project.port}` : '—'} />
              <MetaCard label="IDE"    value={project.ide} />
              {project.url && <MetaCard label="URL" value={project.url} />}
              <MetaCard label="PID"    value={project.pid ?? '—'} />
            </div>
          </section>

          {/* Environment */}
          <section>
            <div className="section-label">Environment</div>
            <div className="env-row">
              {ENVS.map(env => (
                <button
                  key={env}
                  className={`env-pill ${project.active_env === env ? 'active' : ''}`}
                  onClick={() => onSetEnv(env)}
                >
                  {env}
                </button>
              ))}
            </div>
          </section>

          {/* .env file selector */}
          <section>
            <div className="section-label">Env file</div>
            <EnvSelector project={project} onChange={handleEnvFileChange} />
          </section>

          {/* Command / Steps */}
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

          {/* Time tracking */}
          <section>
            <div className="section-label">Time tracking</div>
            <TimeDisplay projectId={project.id} />
          </section>

        </div>

        {/* Right column — Logs */}
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
      <div className={`meta-value ${accent || ''}`}>{value ?? '—'}</div>
    </div>
  );
}
