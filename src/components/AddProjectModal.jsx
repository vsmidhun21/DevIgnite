import { useState, useEffect } from 'react';
import { DEFAULT_COMMANDS, DEFAULT_PORTS, DEFAULT_IDES, TYPE_OPTIONS, IDE_OPTIONS } from '../constants';

const api = window.devignite;

const STEP_TEMPLATES = {
  'Django':      [
    { label: 'Install deps',   cmd: 'pip install -r requirements.txt', wait: true  },
    { label: 'Run migrations', cmd: 'python manage.py migrate',        wait: true  },
    { label: 'Start server',   cmd: 'python manage.py runserver',      wait: false },
  ],
  'FastAPI':     [
    { label: 'Install deps',  cmd: 'pip install -r requirements.txt', wait: true  },
    { label: 'Start server',  cmd: 'uvicorn main:app --reload',       wait: false },
  ],
  'Flask':       [
    { label: 'Install deps',  cmd: 'pip install -r requirements.txt', wait: true  },
    { label: 'Start server',  cmd: 'flask run',                       wait: false },
  ],
  'React':       [
    { label: 'Install packages', cmd: 'npm install', wait: true  },
    { label: 'Start dev server', cmd: 'npm start',   wait: false },
  ],
  'Next.js':     [
    { label: 'Install packages', cmd: 'npm install',   wait: true  },
    { label: 'Start dev server', cmd: 'npm run dev',   wait: false },
  ],
  'Spring Boot': [
    { label: 'Build & start', cmd: 'mvn spring-boot:run', wait: false },
  ],
  'Laravel':     [
    { label: 'Install composer', cmd: 'composer install',  wait: true  },
    { label: 'Start server',     cmd: 'php artisan serve', wait: false },
  ],
  'Node.js':     [
    { label: 'Install packages', cmd: 'npm install',  wait: true  },
    { label: 'Start server',     cmd: 'node index.js', wait: false },
  ],
};

const emptyStep = () => ({ label: '', cmd: '', wait: false });

export default function AddProjectModal({ project, onSave, onClose }) {
  const isEdit = Boolean(project);
  const [tab, setTab] = useState('basic');

  const [form, setForm] = useState({
    name: '', path: '', type: 'Django', command: DEFAULT_COMMANDS['Django'],
    ide: 'VS Code', port: DEFAULT_PORTS['Django'],
    url: '', env_file: '', open_terminal: true, open_browser: true,
  });
  const [steps,    setSteps]    = useState([]);
  const [useSteps, setUseSteps] = useState(false);
  const [envFiles, setEnvFiles] = useState([]);

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || '', path: project.path || '',
        type: project.type || 'Django', command: project.command || '',
        ide: project.ide || 'VS Code', port: project.port || '',
        url: project.url || '', env_file: project.env_file || '',
        open_terminal: project.open_terminal !== 0,
        open_browser:  project.open_browser  !== 0,
      });
      const s = (() => { try { return JSON.parse(project.startup_steps || '[]'); } catch { return []; } })();
      if (s.length > 0) { setSteps(s); setUseSteps(true); }
    }
  }, [project]);

  // Detect env files when path changes
  useEffect(() => {
    if (form.path) {
      api.env.detect(form.path).then(setEnvFiles).catch(() => setEnvFiles([]));
    }
  }, [form.path]);

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleTypeChange = (type) => {
    setForm(prev => ({
      ...prev, type,
      command: prev.command === DEFAULT_COMMANDS[prev.type] ? (DEFAULT_COMMANDS[type] || '') : prev.command,
      port:    prev.port    === DEFAULT_PORTS[prev.type]    ? (DEFAULT_PORTS[type]    || '') : prev.port,
      ide:     DEFAULT_IDES[type] || 'VS Code',
    }));
    if (STEP_TEMPLATES[type]) setSteps(STEP_TEMPLATES[type].map(s => ({ ...s })));
  };

  const browse = async () => {
    const picked = await api.pickFolder();
    if (picked) setForm(prev => ({ ...prev, path: picked }));
  };

  const addStep    = ()          => setSteps(prev => [...prev, emptyStep()]);
  const removeStep = (i)         => setSteps(prev => prev.filter((_, x) => x !== i));
  const moveUp     = (i)         => { if (i === 0) return; const s=[...steps]; [s[i-1],s[i]]=[s[i],s[i-1]]; setSteps(s); };
  const moveDown   = (i)         => { if (i===steps.length-1) return; const s=[...steps]; [s[i+1],s[i]]=[s[i],s[i+1]]; setSteps(s); };
  const setStep    = (i, k, v)   => setSteps(prev => prev.map((s, x) => x===i ? {...s,[k]:v} : s));

  const handleSubmit = () => {
    if (!form.name.trim()) { alert('Project name is required'); return; }
    if (!form.path.trim()) { alert('Project path is required'); return; }
    if (!useSteps && !form.command.trim()) { alert('Run command is required'); return; }
    onSave({
      ...form,
      port:          Number(form.port) || null,
      startup_steps: useSteps ? steps.filter(s => s.cmd.trim()) : [],
      open_terminal: form.open_terminal ? 1 : 0,
      open_browser:  form.open_browser  ? 1 : 0,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{isEdit ? 'Edit project' : 'Add project'}</h3>
          <div className="modal-tabs">
            {['basic','steps','options'].map(t => (
              <button key={t} className={`modal-tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
                {t === 'steps' && steps.length > 0
                  ? `Steps (${steps.length})`
                  : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* BASIC TAB */}
        {tab === 'basic' && (
          <div className="modal-body">
            <Field label="Project name">
              <input value={form.name} onChange={set('name')} placeholder="my-project" />
            </Field>
            <Field label="Path">
              <div className="path-row">
                <input value={form.path} onChange={set('path')} placeholder="C:\projects\my-project" className="path-input" />
                <button className="btn browse-btn" onClick={browse}>Browse…</button>
              </div>
            </Field>
            <div className="field-row">
              <Field label="Type" cls="flex1">
                <select value={form.type} onChange={e => handleTypeChange(e.target.value)}>
                  {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="IDE" cls="flex1">
                <select value={form.ide} onChange={set('ide')}>
                  {IDE_OPTIONS.map(i => <option key={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Port" cls="w100">
                <input value={form.port} onChange={set('port')} placeholder="8000" />
              </Field>
            </div>
            <Field label="Run command">
              <input value={form.command} onChange={set('command')} placeholder="python manage.py runserver" />
            </Field>
            <Field label="Browser URL (optional)">
              <input value={form.url} onChange={set('url')} placeholder="http://localhost:8000" />
            </Field>
            {envFiles.length > 0 && (
              <Field label="Default .env file">
                <select value={form.env_file} onChange={set('env_file')}>
                  <option value="">Auto-detect</option>
                  {envFiles.map(f => (
                    <option key={f.filename} value={f.filename}>{f.filename}</option>
                  ))}
                </select>
              </Field>
            )}
            <div className="toggle-row">
              <label className="toggle-label">
                <input type="checkbox" checked={useSteps} onChange={e => setUseSteps(e.target.checked)} />
                Use startup steps instead of single command
              </label>
            </div>
          </div>
        )}

        {/* STEPS TAB */}
        {tab === 'steps' && (
          <div className="modal-body">
            <div className="steps-header">
              <p className="steps-help">
                Steps run in order. <em>Wait</em> = must exit before next step starts.
                The last step (server) should have wait <strong>off</strong>.
              </p>
              <button className="btn small" onClick={() => {
                const tpl = STEP_TEMPLATES[form.type];
                if (tpl) { setSteps(tpl.map(s => ({...s}))); setUseSteps(true); }
              }}>
                Load {form.type} template
              </button>
            </div>
            {steps.length === 0 && <div className="steps-empty">No steps yet.</div>}
            {steps.map((step, i) => (
              <div key={i} className="step-row">
                <div className="step-num">{i + 1}</div>
                <div className="step-fields">
                  <input className="step-label-input" value={step.label}
                    onChange={e => setStep(i,'label',e.target.value)} placeholder="Step name" />
                  <input className="step-cmd-input" value={step.cmd}
                    onChange={e => setStep(i,'cmd',e.target.value)} placeholder="Command" />
                  <label className="step-wait-toggle">
                    <input type="checkbox" checked={step.wait}
                      onChange={e => setStep(i,'wait',e.target.checked)} />
                    Wait for exit
                  </label>
                </div>
                <div className="step-actions">
                  <button className="icon-btn" onClick={() => moveUp(i)}>↑</button>
                  <button className="icon-btn" onClick={() => moveDown(i)}>↓</button>
                  <button className="icon-btn danger" onClick={() => removeStep(i)}>×</button>
                </div>
              </div>
            ))}
            <button className="btn small" style={{marginTop:10}} onClick={addStep}>+ Add step</button>
          </div>
        )}

        {/* OPTIONS TAB */}
        {tab === 'options' && (
          <div className="modal-body">
            <div className="section-label">On Start Work</div>
            <div className="options-list">
              <label className="option-row">
                <input type="checkbox" checked={form.open_terminal} onChange={set('open_terminal')} />
                <div>
                  <div className="option-title">Open terminal</div>
                  <div className="option-desc">Launch a new terminal window at the project folder</div>
                </div>
              </label>
              <label className="option-row">
                <input type="checkbox" checked={form.open_browser} onChange={set('open_browser')} />
                <div>
                  <div className="option-title">Open browser</div>
                  <div className="option-desc">Open the project URL after startup (requires URL to be set)</div>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSubmit}>
            {isEdit ? 'Save changes' : 'Add project'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, cls }) {
  return (
    <div className={`field ${cls || ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
