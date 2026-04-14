import { useState, useEffect, useCallback } from 'react';

const api = window.devignite;

const TYPE_OPTIONS = [
  'Django','Flask','FastAPI','React','Next.js','Angular','Vue','Nuxt',
  'Laravel','Spring Boot','Node.js','Python','Custom',
];
const STEP_TEMPLATES = {
  'Django':      [{ label:'Install deps',   cmd:'pip install -r requirements.txt', wait:true  },
                  { label:'Run migrations', cmd:'python manage.py migrate',        wait:true  },
                  { label:'Start server',   cmd:'python manage.py runserver',      wait:false }],
  'FastAPI':     [{ label:'Install deps', cmd:'pip install -r requirements.txt', wait:true  },
                  { label:'Start server', cmd:'uvicorn main:app --reload',       wait:false }],
  'Flask':       [{ label:'Install deps', cmd:'pip install -r requirements.txt', wait:true  },
                  { label:'Start server', cmd:'flask run',                       wait:false }],
  'React':       [{ label:'Install packages', cmd:'npm install', wait:true  },
                  { label:'Start dev server', cmd:'npm start',   wait:false }],
  'Next.js':     [{ label:'Install packages', cmd:'npm install',   wait:true  },
                  { label:'Start dev server', cmd:'npm run dev',   wait:false }],
  'Angular':     [{ label:'Install packages', cmd:'npm install', wait:true  },
                  { label:'Start dev server', cmd:'ng serve',    wait:false }],
  'Vue':         [{ label:'Install packages', cmd:'npm install',   wait:true  },
                  { label:'Start dev server', cmd:'npm run dev',   wait:false }],
  'Spring Boot': [{ label:'Start Spring Boot', cmd:'mvn spring-boot:run', wait:false }],
  'Laravel':     [{ label:'Install composer', cmd:'composer install',  wait:true  },
                  { label:'Start server',     cmd:'php artisan serve', wait:false }],
  'Node.js':     [{ label:'Install packages', cmd:'npm install',  wait:true  },
                  { label:'Start server',     cmd:'node index.js', wait:false }],
};

const emptyStep = () => ({ label:'', cmd:'', wait:false });

const DEFAULTS = {
  'Django':      { command:'python manage.py runserver', port:8000, ide:'PyCharm' },
  'Flask':       { command:'flask run',                  port:5000, ide:'VS Code' },
  'FastAPI':     { command:'uvicorn main:app --reload',  port:8001, ide:'VS Code' },
  'React':       { command:'npm start',                  port:3000, ide:'VS Code' },
  'Next.js':     { command:'npm run dev',                port:3000, ide:'VS Code' },
  'Angular':     { command:'ng serve',                   port:4200, ide:'VS Code' },
  'Vue':         { command:'npm run dev',                port:5173, ide:'VS Code' },
  'Spring Boot': { command:'mvn spring-boot:run',        port:8080, ide:'IntelliJ IDEA' },
  'Laravel':     { command:'php artisan serve',          port:8080, ide:'VS Code' },
  'Node.js':     { command:'node index.js',              port:3001, ide:'VS Code' },
  'Python':      { command:'python main.py',             port:null, ide:'VS Code' },
  'Custom':      { command:'',                           port:null, ide:'VS Code' },
};

export default function AddProjectModal({ project, onSave, onClose }) {
  const isEdit = Boolean(project);
  const [tab, setTab] = useState('basic');

  const [form, setForm] = useState({
    name:'', path:'', type:'Custom',
    command:'', ide:'VS Code', ide_id:'vscode', ide_path:'',
    port:'', url:'',
    env_file:'', active_env:'dev',
    open_terminal:true, open_browser:true, install_deps:false,
  });
  const [steps,         setSteps]         = useState([]);
  const [useSteps,      setUseSteps]       = useState(false);
  const [envFiles,      setEnvFiles]       = useState([]);
  const [availableEnvs, setAvailableEnvs]  = useState(['dev']);
  const [availableIDEs, setAvailableIDEs]  = useState([]);
  const [detecting,     setDetecting]      = useState(false);
  const [validation,    setValidation]     = useState(null);

  // Load available IDEs on mount
  useEffect(() => {
    api.ide.list().then(setAvailableIDEs).catch(() => setAvailableIDEs([]));
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (!project) return;
    setForm({
      name:         project.name         || '',
      path:         project.path         || '',
      type:         project.type         || 'Custom',
      command:      project.command      || '',
      ide:          project.ide          || 'VS Code',
      ide_id:       project.ide_id       || 'vscode',
      ide_path:     project.ide_path     || '',
      port:         project.port         || '',
      url:          project.url          || '',
      env_file:     project.env_file     || '',
      active_env:   project.active_env   || 'dev',
      open_terminal: project.open_terminal !== 0,
      open_browser:  project.open_browser  !== 0,
      install_deps:  project.install_deps  === 1,
    });
    const s = (() => { try { return JSON.parse(project.startup_steps||'[]'); } catch { return []; } })();
    if (s.length > 0) { setSteps(s); setUseSteps(true); }
  }, [project]);

  // Detect project when path changes (debounced)
  const detectProject = useCallback(async (projectPath) => {
    if (!projectPath || projectPath.length < 3) return;
    setDetecting(true);
    try {
      const detected = await api.projects.detect(projectPath);
      if (detected.detected) {
        setForm(prev => ({
          ...prev,
          type:    prev.type === 'Custom' || !prev.type ? detected.type    : prev.type,
          command: !prev.command                        ? detected.command  : prev.command,
          port:    !prev.port                           ? (detected.port||'') : prev.port,
          ide:     prev.ide === 'VS Code'               ? (detected.ide || prev.ide) : prev.ide,
        }));
        if (!useSteps && detected.steps?.length > 0) {
          setSteps(detected.steps.map(s => ({...s})));
        }
      }
      // Detect env files
      const { available, files } = await api.env.detect(projectPath);
      setEnvFiles(files || []);
      setAvailableEnvs(available || ['dev']);
    } catch {}
    setDetecting(false);
  }, [useSteps]);

  useEffect(() => {
    const t = setTimeout(() => { if (form.path) detectProject(form.path); }, 600);
    return () => clearTimeout(t);
  }, [form.path, detectProject]);

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleTypeChange = (type) => {
    const def = DEFAULTS[type] || DEFAULTS['Custom'];
    setForm(prev => ({
      ...prev, type,
      command: !prev.command || prev.command === DEFAULTS[prev.type]?.command ? def.command : prev.command,
      port:    !prev.port    || prev.port    === DEFAULTS[prev.type]?.port    ? (def.port||'') : prev.port,
      ide:     def.ide,
    }));
    if (STEP_TEMPLATES[type]) setSteps(STEP_TEMPLATES[type].map(s => ({...s})));
  };

  const browse       = async () => { const p = await api.pickFolder(); if (p) setForm(prev => ({...prev, path:p})); };
  const browseIDE    = async () => { const p = await api.ide.browse(); if (p) setForm(prev => ({...prev, ide_path:p})); };

  const addStep    = ()        => setSteps(prev => [...prev, emptyStep()]);
  const removeStep = (i)       => setSteps(prev => prev.filter((_, x) => x !== i));
  const moveUp     = (i)       => { if (i===0) return; const s=[...steps]; [s[i-1],s[i]]=[s[i],s[i-1]]; setSteps(s); };
  const moveDown   = (i)       => { if (i===steps.length-1) return; const s=[...steps]; [s[i+1],s[i]]=[s[i],s[i+1]]; setSteps(s); };
  const setStep    = (i, k, v) => setSteps(prev => prev.map((s, x) => x===i ? {...s,[k]:v} : s));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setValidation([{ field:'name',    message:'Project name is required' }]); return; }
    if (!form.path.trim()) { setValidation([{ field:'path',    message:'Project path is required' }]); return; }
    if (!useSteps && !form.command.trim()) { setValidation([{ field:'command', message:'Run command is required' }]); return; }
    if (form.url) {
      try { new URL(form.url); } catch { setValidation([{ field:'url', message:'Invalid URL format' }]); return; }
    }
    setValidation(null);
    onSave({
      ...form,
      port:          Number(form.port) || null,
      startup_steps: useSteps ? steps.filter(s => s.cmd.trim()) : [],
      open_terminal: form.open_terminal ? 1 : 0,
      open_browser:  form.open_browser  ? 1 : 0,
      install_deps:  form.install_deps  ? 1 : 0,
      ide_path:      form.ide_path || null,
    });
  };

  const validationFor = (field) => validation?.find(e => e.field === field)?.message;
  const selectedIDE   = availableIDEs.find(i => i.name === form.ide);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{isEdit ? 'Edit project' : 'Add project'}</h3>
          <div className="modal-tabs">
            {['basic','steps','ide','options'].map(t => (
              <button key={t} className={`modal-tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
                {t === 'steps' && steps.length > 0 ? `Steps (${steps.length})` : t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── BASIC ──────────────────────────────────────────────────────── */}
        {tab === 'basic' && (
          <div className="modal-body">
            <Field label="Project name" error={validationFor('name')}>
              <input value={form.name} onChange={set('name')} placeholder="my-project" />
            </Field>

            <Field label="Path" error={validationFor('path')}>
              <div className="path-row">
                <input value={form.path} onChange={set('path')} placeholder="C:\projects\my-project" className="path-input" />
                <button className="btn browse-btn" onClick={browse}>Browse…</button>
              </div>
              {detecting && <span className="detect-hint">Detecting project type…</span>}
            </Field>

            <div className="field-row">
              <Field label="Type" cls="flex1">
                <select value={form.type} onChange={e => handleTypeChange(e.target.value)}>
                  {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Port" cls="w100">
                <input value={form.port} onChange={set('port')} placeholder="8000" />
              </Field>
            </div>

            <Field label="Run command" error={validationFor('command')}>
              <input value={form.command} onChange={set('command')} placeholder="python manage.py runserver" />
            </Field>

            <Field label="Browser URL (optional)" error={validationFor('url')}>
              <input value={form.url} onChange={set('url')} placeholder="http://localhost:8000" />
            </Field>

            {/* Env file */}
            {envFiles.length > 0 && (
              <Field label="Default .env file">
                <select value={form.env_file} onChange={set('env_file')}>
                  <option value="">Auto-detect for active env</option>
                  {envFiles.map(f => (
                    <option key={f.filename} value={f.filename}>{f.filename} ({f.env})</option>
                  ))}
                </select>
              </Field>
            )}

            {/* Install deps */}
            <div className="toggle-row">
              <label className="toggle-label">
                <input type="checkbox" checked={form.install_deps} onChange={set('install_deps')} />
                Install dependencies before first run
              </label>
            </div>

            <div className="toggle-row">
              <label className="toggle-label">
                <input type="checkbox" checked={useSteps} onChange={e => setUseSteps(e.target.checked)} />
                Use startup steps instead of single command
              </label>
            </div>

            {validation && (
              <div className="validation-errors">
                {validation.map((e, i) => <div key={i} className="validation-error">⚠ {e.message}</div>)}
              </div>
            )}
          </div>
        )}

        {/* ── STEPS ──────────────────────────────────────────────────────── */}
        {tab === 'steps' && (
          <div className="modal-body">
            <div className="steps-header">
              <p className="steps-help">
                Steps run in order. <em>Wait</em> = must exit before next step starts.
                Last step (server) should have wait <strong>off</strong>.
              </p>
              <button className="btn small" onClick={() => {
                const tpl = STEP_TEMPLATES[form.type];
                if (tpl) { setSteps(tpl.map(s=>({...s}))); setUseSteps(true); }
              }}>Load {form.type} template</button>
            </div>
            {steps.length === 0 && <div className="steps-empty">No steps yet. Load a template or add manually.</div>}
            {steps.map((step, i) => (
              <div key={i} className="step-row">
                <div className="step-num">{i + 1}</div>
                <div className="step-fields">
                  <input className="step-label-input" value={step.label} onChange={e => setStep(i,'label',e.target.value)} placeholder="Step name" />
                  <input className="step-cmd-input"   value={step.cmd}   onChange={e => setStep(i,'cmd',e.target.value)}   placeholder="Command" />
                  <label className="step-wait-toggle">
                    <input type="checkbox" checked={step.wait} onChange={e => setStep(i,'wait',e.target.checked)} />
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

        {/* ── IDE ────────────────────────────────────────────────────────── */}
        {tab === 'ide' && (
          <div className="modal-body">
            <div className="section-label" style={{marginBottom:8}}>Available IDEs on this system</div>

            {availableIDEs.length === 0 ? (
              <div className="steps-empty">No IDEs detected automatically. Use custom path below.</div>
            ) : (
              <div className="ide-grid">
                {availableIDEs.map(ide => (
                  <div
                    key={ide.id}
                    className={`ide-card ${form.ide === ide.name ? 'selected' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, ide: ide.name, ide_id: ide.id, ide_path: '' }))}
                  >
                    <div className="ide-card-name">{ide.name}</div>
                    <div className="ide-card-path">{ide.execPath}</div>
                    <div className="ide-card-tick">{form.ide === ide.name ? '✓' : ''}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="ide-divider">— or use custom path —</div>

            <Field label="Custom IDE executable path">
              <div className="path-row">
                <input value={form.ide_path} onChange={set('ide_path')} placeholder="C:\Path\To\editor.exe" className="path-input" />
                <button className="btn browse-btn" onClick={browseIDE}>Browse…</button>
              </div>
            </Field>
            {form.ide_path && (
              <Field label="IDE display name">
                <input value={form.ide} onChange={set('ide')} placeholder="My Editor" />
              </Field>
            )}
          </div>
        )}

        {/* ── OPTIONS ────────────────────────────────────────────────────── */}
        {tab === 'options' && (
          <div className="modal-body">
            <div className="section-label" style={{marginBottom:8}}>On Start Work</div>
            <div className="options-list">
              <label className="option-row">
                <input type="checkbox" checked={!!form.open_terminal} onChange={set('open_terminal')} />
                <div>
                  <div className="option-title">Open terminal</div>
                  <div className="option-desc">Launch a terminal at the project folder</div>
                </div>
              </label>
              <label className="option-row">
                <input type="checkbox" checked={!!form.open_browser} onChange={set('open_browser')} />
                <div>
                  <div className="option-title">Open browser</div>
                  <div className="option-desc">Open the URL after server starts (URL must be set in Basic tab)</div>
                </div>
              </label>
              <label className="option-row">
                <input type="checkbox" checked={!!form.install_deps} onChange={set('install_deps')} />
                <div>
                  <div className="option-title">Install dependencies</div>
                  <div className="option-desc">Run install command (pip/npm/composer) before each start</div>
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

function Field({ label, children, cls, error }) {
  return (
    <div className={`field ${cls||''}`}>
      <label>{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
