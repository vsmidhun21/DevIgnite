// desktop/renderer/src/components/AddProjectModal.jsx
// Features: folder browse button, startup steps editor, auto-fill by type
import { useState, useEffect } from 'react';
import { DEFAULT_COMMANDS, DEFAULT_PORTS, DEFAULT_IDES, TYPE_OPTIONS, IDE_OPTIONS } from '../constants';

const STEP_TEMPLATES = {
  'Django': [
    { label: 'Install dependencies', cmd: 'pip install -r requirements.txt', wait: true },
    { label: 'Run migrations', cmd: 'python manage.py migrate', wait: true },
    { label: 'Start server', cmd: 'python manage.py runserver', wait: false },
  ],
  'FastAPI': [
    { label: 'Install dependencies', cmd: 'pip install -r requirements.txt', wait: true },
    { label: 'Start server', cmd: 'uvicorn main:app --reload', wait: false },
  ],
  'Flask': [
    { label: 'Install dependencies', cmd: 'pip install -r requirements.txt', wait: true },
    { label: 'Start server', cmd: 'flask run', wait: false },
  ],
  'React': [
    { label: 'Install packages', cmd: 'npm install', wait: true },
    { label: 'Start dev server', cmd: 'npm start', wait: false },
  ],
  'Next.js': [
    { label: 'Install packages', cmd: 'npm install', wait: true },
    { label: 'Start dev server', cmd: 'npm run dev', wait: false },
  ],
  'Spring Boot': [
    { label: 'Build & start', cmd: 'mvn spring-boot:run', wait: false },
  ],
  'Laravel': [
    { label: 'Install composer packages', cmd: 'composer install', wait: true },
    { label: 'Start server', cmd: 'php artisan serve', wait: false },
  ],
  'Node.js': [
    { label: 'Install packages', cmd: 'npm install', wait: true },
    { label: 'Start server', cmd: 'node index.js', wait: false },
  ],
};

const emptyStep = () => ({ label: '', cmd: '', wait: false });

export default function AddProjectModal({ project, onSave, onClose }) {
  const isEdit = Boolean(project);
  const [tab, setTab] = useState('basic'); // 'basic' | 'steps'

  const [form, setForm] = useState({
    name: '', path: '', type: 'Django',
    command: DEFAULT_COMMANDS['Django'],
    ide: 'VS Code',
    port: DEFAULT_PORTS['Django'],
  });

  const [steps, setSteps] = useState([]);
  const [useSteps, setUseSteps] = useState(false);

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || '',
        path: project.path || '',
        type: project.type || 'Django',
        command: project.command || '',
        ide: project.ide || 'VS Code',
        port: project.port || '',
      });
      const existingSteps = (() => {
        try { return JSON.parse(project.startup_steps || '[]'); } catch { return []; }
      })();
      if (existingSteps.length > 0) {
        setSteps(existingSteps);
        setUseSteps(true);
      }
    }
  }, [project]);

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleTypeChange = (type) => {
    setForm(prev => ({
      ...prev, type,
      command: prev.command === DEFAULT_COMMANDS[prev.type] ? (DEFAULT_COMMANDS[type] || '') : prev.command,
      port: prev.port === DEFAULT_PORTS[prev.type] ? (DEFAULT_PORTS[type] || '') : prev.port,
      ide: DEFAULT_IDES[type] || 'VS Code',
    }));
    // Load step template for this type
    if (STEP_TEMPLATES[type]) setSteps(STEP_TEMPLATES[type].map(s => ({ ...s })));
  };

  // ── Folder browse ──────────────────────────────────────────────────────────
  const browseFolder = async () => {
    const picked = await window.launcher.pickFolder();
    if (picked) setForm(prev => ({ ...prev, path: picked }));
  };

  // ── Step editor helpers ────────────────────────────────────────────────────
  const loadTemplate = () => {
    const tpl = STEP_TEMPLATES[form.type];
    if (tpl) setSteps(tpl.map(s => ({ ...s })));
    else setSteps([{ label: 'Start', cmd: form.command, wait: false }]);
  };

  const addStep = () => setSteps(prev => [...prev, emptyStep()]);
  const removeStep = (i) => setSteps(prev => prev.filter((_, idx) => idx !== i));
  const moveUp = (i) => { if (i === 0) return; const s = [...steps];[s[i - 1], s[i]] = [s[i], s[i - 1]]; setSteps(s); };
  const moveDown = (i) => { if (i === steps.length - 1) return; const s = [...steps];[s[i + 1], s[i]] = [s[i], s[i + 1]]; setSteps(s); };
  const setStep = (i, key, val) => setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: val } : s));

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!form.name.trim()) { alert('Project name is required'); return; }
    if (!form.path.trim()) { alert('Project path is required'); return; }

    const finalSteps = useSteps ? steps.filter(s => s.cmd.trim()) : [];
    // If not using steps, command is the single run command
    if (!useSteps && !form.command.trim()) { alert('Run command is required'); return; }

    onSave({
      ...form,
      port: Number(form.port) || null,
      startup_steps: finalSteps,
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{isEdit ? 'Edit project' : 'Add project'}</h3>
          <div className="modal-tabs">
            <button className={`modal-tab${tab === 'basic' ? ' active' : ''}`} onClick={() => setTab('basic')}>Basic</button>
            <button className={`modal-tab${tab === 'steps' ? ' active' : ''}`} onClick={() => setTab('steps')}>
              Startup steps {steps.length > 0 && <span className="step-count">{steps.length}</span>}
            </button>
          </div>
        </div>

        {/* ── BASIC TAB ─────────────────────────────────────────────── */}
        {tab === 'basic' && (
          <div className="modal-body">
            <div className="field">
              <label>Project name</label>
              <input value={form.name} onChange={set('name')} placeholder="my-django-app" />
            </div>

            <div className="field">
              <label>Path</label>
              <div className="path-row">
                <input value={form.path} onChange={set('path')} placeholder="C:\projects\my-django-app" className="path-input" />
                <button className="btn browse-btn" onClick={browseFolder} title="Browse for folder">
                  Browse…
                </button>
              </div>
            </div>

            <div className="field-row">
              <div className="field flex1">
                <label>Type</label>
                <select value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field flex1">
                <label>IDE</label>
                <select value={form.ide} onChange={set('ide')}>
                  {IDE_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="field" style={{ width: 100 }}>
                <label>Port</label>
                <input value={form.port} onChange={set('port')} placeholder="8000" />
              </div>
            </div>

            <div className="field">
              <label>Run command <span className="label-hint">(used when startup steps are off)</span></label>
              <input value={form.command} onChange={set('command')} placeholder="python manage.py runserver" />
            </div>

            <div className="toggle-row">
              <label className="toggle-label">
                <input type="checkbox" checked={useSteps} onChange={e => setUseSteps(e.target.checked)} />
                Use startup steps instead of single command
              </label>
              {useSteps && (
                <button className="btn small" onClick={() => setTab('steps')}>
                  Configure steps →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STEPS TAB ─────────────────────────────────────────────── */}
        {tab === 'steps' && (
          <div className="modal-body">
            <div className="steps-header">
              <p className="steps-help">
                Steps run <strong>in order</strong>. Steps with <em>wait</em> must exit before the next starts.
                The last step (usually the server) should have <em>wait</em> off — it stays running.
              </p>
              <button className="btn small" onClick={loadTemplate}>Load template for {form.type}</button>
            </div>

            {steps.length === 0 && (
              <div className="steps-empty">No steps yet. Click "Load template" or add manually.</div>
            )}

            {steps.map((step, i) => (
              <div key={i} className="step-row">
                <div className="step-num">{i + 1}</div>
                <div className="step-fields">
                  <input
                    className="step-label-input"
                    value={step.label}
                    onChange={e => setStep(i, 'label', e.target.value)}
                    placeholder="Step name (e.g. Install deps)"
                  />
                  <input
                    className="step-cmd-input"
                    value={step.cmd}
                    onChange={e => setStep(i, 'cmd', e.target.value)}
                    placeholder="Command (e.g. pip install -r requirements.txt)"
                  />
                  <label className="step-wait-toggle">
                    <input
                      type="checkbox"
                      checked={step.wait}
                      onChange={e => setStep(i, 'wait', e.target.checked)}
                    />
                    Wait for exit
                  </label>
                </div>
                <div className="step-actions">
                  <button className="icon-btn" onClick={() => moveUp(i)} title="Move up">↑</button>
                  <button className="icon-btn" onClick={() => moveDown(i)} title="Move down">↓</button>
                  <button className="icon-btn danger" onClick={() => removeStep(i)} title="Remove">×</button>
                </div>
              </div>
            ))}

            <button className="btn small" onClick={addStep} style={{ marginTop: 10 }}>+ Add step</button>
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
