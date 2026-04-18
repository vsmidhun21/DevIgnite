import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft, FolderOpen, Check } from 'lucide-react';

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
                  { label:'Start server', cmd:'uvicorn main:app --reload',        wait:false }],
  'Flask':       [{ label:'Install deps', cmd:'pip install -r requirements.txt', wait:true  },
                  { label:'Start server', cmd:'flask run',                        wait:false }],
  'React':       [{ label:'Install',      cmd:'npm install',  wait:true  },
                  { label:'Start',        cmd:'npm start',    wait:false }],
  'Next.js':     [{ label:'Install',      cmd:'npm install',  wait:true  },
                  { label:'Start',        cmd:'npm run dev',  wait:false }],
  'Angular':     [{ label:'Install',      cmd:'npm install',  wait:true  },
                  { label:'Start',        cmd:'ng serve',     wait:false }],
  'Vue':         [{ label:'Install',      cmd:'npm install',  wait:true  },
                  { label:'Start',        cmd:'npm run dev',  wait:false }],
  'Spring Boot': [{ label:'Start', cmd:'mvn spring-boot:run', wait:false }],
  'Laravel':     [{ label:'Install', cmd:'composer install',  wait:true  },
                  { label:'Start',   cmd:'php artisan serve', wait:false }],
  'Node.js':     [{ label:'Install', cmd:'npm install',   wait:true  },
                  { label:'Start',   cmd:'node index.js', wait:false }],
};

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

const STEPS_CONFIG = [
  { id:'project',  label:'Project',      icon:'1' },
  { id:'command',  label:'Command',      icon:'2' },
  { id:'ide',      label:'IDE',          icon:'3' },
  { id:'options',  label:'Options',      icon:'4' },
];

const emptyStep = () => ({ label:'', cmd:'', wait:false });

function Field({ label, children, cls, error }) {
  return (
    <div className={`field ${cls||''}`}>
      <label>{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export default function AddProjectModal({ project, onSave, onClose }) {
  const isEdit = Boolean(project);
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    name:'', path:'', type:'Custom',
    command:'', ide:'VS Code', ide_id:'vscode', ide_path:'',
    port:'', url:'', env_file:'', active_env:'dev',
    open_terminal:true, open_browser:true, install_deps:false,
  });
  const [steps,        setSteps]        = useState([]);
  const [useSteps,     setUseSteps]     = useState(false);
  const [envFiles,     setEnvFiles]     = useState([]);
  const [availIDEs,    setAvailIDEs]    = useState([]);
  const [detecting,    setDetecting]    = useState(false);
  const [errs,         setErrs]         = useState({});

  useEffect(() => {
    api.ide.list().then(setAvailIDEs).catch(() => {});
  }, []);

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

  const detectProject = useCallback(async (p) => {
    if (!p || p.length < 3) return;
    setDetecting(true);
    try {
      const d = await api.projects.detect(p);
      if (d.detected) {
        setForm(prev => ({
          ...prev,
          type:    prev.type==='Custom' ? d.type    : prev.type,
          command: !prev.command        ? d.command  : prev.command,
          port:    !prev.port           ? (d.port||'') : prev.port,
          ide:     prev.ide==='VS Code' ? (d.ide||prev.ide) : prev.ide,
        }));
        if (!useSteps && d.steps?.length) setSteps(d.steps.map(s=>({...s})));
      }
      const { available, files } = await api.env.detect(p);
      setEnvFiles(files||[]);
    } catch {}
    setDetecting(false);
  }, [useSteps]);

  useEffect(() => {
    const t = setTimeout(() => { if (form.path) detectProject(form.path); }, 600);
    return () => clearTimeout(t);
  }, [form.path, detectProject]);

  const set = (k) => (e) => {
    const v = e.target.type==='checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({...prev,[k]:v}));
    if (errs[k]) setErrs(prev => ({...prev,[k]:null}));
  };

  const changeType = (type) => {
    const def = DEFAULTS[type]||DEFAULTS['Custom'];
    setForm(prev => ({
      ...prev, type,
      command: !prev.command||prev.command===DEFAULTS[prev.type]?.command ? def.command : prev.command,
      port:    !prev.port||prev.port===DEFAULTS[prev.type]?.port ? (def.port||'') : prev.port,
      ide: def.ide,
    }));
    if (STEP_TEMPLATES[type]) setSteps(STEP_TEMPLATES[type].map(s=>({...s})));
  };

  const browse    = async () => { const p = await api.pickFolder(); if (p) { setForm(prev=>({...prev,path:p})); } };
  const browseIDE = async () => { const p = await api.ide.browse();  if (p) setForm(prev=>({...prev,ide_path:p})); };

  const addStep    = ()        => setSteps(prev=>[...prev, emptyStep()]);
  const remStep    = (i)       => setSteps(prev=>prev.filter((_,x)=>x!==i));
  const mvUp       = (i)       => { if(!i) return; const s=[...steps]; [s[i-1],s[i]]=[s[i],s[i-1]]; setSteps(s); };
  const mvDn       = (i)       => { if(i===steps.length-1) return; const s=[...steps]; [s[i+1],s[i]]=[s[i],s[i+1]]; setSteps(s); };
  const setStep2   = (i,k,v)   => setSteps(prev=>prev.map((s,x)=>x===i?{...s,[k]:v}:s));

  const validateStep = (idx) => {
    const e = {};
    if (idx===0) {
      if (!form.name.trim()) e.name = 'Required';
      if (!form.path.trim()) e.path = 'Required';
    }
    if (idx===1) {
      if (!useSteps && !form.command.trim()) e.command = 'Required';
      if (form.url) { try { new URL(form.url); } catch { e.url='Invalid URL'; } }
    }
    setErrs(e);
    return Object.keys(e).length===0;
  };

  const next = () => { if (validateStep(step)) setStep(s=>s+1); };
  const back = () => setStep(s=>s-1);

  const submit = () => {
    if (!validateStep(step)) return;
    onSave({
      ...form,
      port:          Number(form.port)||null,
      startup_steps: useSteps ? steps.filter(s=>s.cmd.trim()) : [],
      open_terminal: form.open_terminal ? 1 : 0,
      open_browser:  form.open_browser  ? 1 : 0,
      install_deps:  form.install_deps  ? 1 : 0,
      ide_path:      form.ide_path||null,
    });
  };

  const isLast = step===STEPS_CONFIG.length-1;
  const totalSteps = STEPS_CONFIG.length;

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">

        <div className="modal-header">
          <h3>{isEdit ? 'Edit project' : 'Add project'}</h3>
          <div className="step-indicator">
            {STEPS_CONFIG.map((s,i) => (
              <div key={s.id} className={`step-pip ${i===step?'active':i<step?'done':''}`}>
                {i<step ? <Check size={9} strokeWidth={3}/> : s.icon}
              </div>
            ))}
          </div>
          <div className="step-label-text">{STEPS_CONFIG[step].label}</div>
        </div>

        <div className="modal-body">

          {step===0 && (
            <>
              <Field label="Project name" error={errs.name}>
                <input value={form.name} onChange={set('name')} placeholder="my-app" autoFocus />
              </Field>
              <Field label="Path" error={errs.path}>
                <div className="path-row">
                  <input value={form.path} onChange={set('path')} placeholder="C:\projects\my-app" className="path-input" />
                  <button className="btn browse-btn" onClick={browse}>
                    <FolderOpen size={13} strokeWidth={2} /> Browse
                  </button>
                </div>
                {detecting && <span className="detect-hint">Detecting…</span>}
              </Field>
              <div className="field-row">
                <Field label="Type" cls="flex1">
                  <select value={form.type} onChange={e=>changeType(e.target.value)}>
                    {TYPE_OPTIONS.map(t=><option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Port" cls="w100">
                  <input value={form.port} onChange={set('port')} placeholder="8000" />
                </Field>
              </div>
            </>
          )}

          {step===1 && (
            <>
              <Field label="Run command" error={errs.command}>
                <input value={form.command} onChange={set('command')} placeholder="python manage.py runserver" />
              </Field>
              <Field label="Browser URL" error={errs.url}>
                <input value={form.url} onChange={set('url')} placeholder="http://localhost:8000" />
              </Field>
              {envFiles.length>0 && (
                <Field label=".env file">
                  <select value={form.env_file} onChange={set('env_file')}>
                    <option value="">Auto-detect</option>
                    {envFiles.map(f=><option key={f.filename} value={f.filename}>{f.filename}</option>)}
                  </select>
                </Field>
              )}
              <div className="toggle-row">
                <label className="toggle-label">
                  <input type="checkbox" checked={useSteps} onChange={e=>setUseSteps(e.target.checked)} />
                  Use startup steps
                </label>
              </div>
              {useSteps && (
                <div style={{marginTop:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <span className="section-label" style={{marginBottom:0}}>Steps</span>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn small" onClick={()=>{
                        const t=STEP_TEMPLATES[form.type];
                        if(t){setSteps(t.map(s=>({...s})));setUseSteps(true);}
                      }}>Load template</button>
                      <button className="btn small" onClick={addStep}>+ Add</button>
                    </div>
                  </div>
                  {steps.length===0&&<div className="steps-empty">No steps.</div>}
                  {steps.map((s,i)=>(
                    <div key={i} className="step-row">
                      <div className="step-num">{i+1}</div>
                      <div className="step-fields">
                        <input className="step-label-input" value={s.label} onChange={e=>setStep2(i,'label',e.target.value)} placeholder="Label" />
                        <input className="step-cmd-input" value={s.cmd} onChange={e=>setStep2(i,'cmd',e.target.value)} placeholder="Command" />
                        <label className="step-wait-toggle">
                          <input type="checkbox" checked={s.wait} onChange={e=>setStep2(i,'wait',e.target.checked)} /> Wait
                        </label>
                      </div>
                      <div className="step-actions">
                        <button className="icon-btn" onClick={()=>mvUp(i)}>↑</button>
                        <button className="icon-btn" onClick={()=>mvDn(i)}>↓</button>
                        <button className="icon-btn danger" onClick={()=>remStep(i)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step===2 && (
            <>
              <div className="section-label" style={{marginBottom:8}}>Detected IDEs</div>
              {availIDEs.length===0 ? (
                <div className="steps-empty">No IDEs detected. Use custom path.</div>
              ) : (
                <div className="ide-list-container">
                  {availIDEs.map(ide=>(
                    <div key={ide.id}
                      className={`ide-item ${form.ide===ide.name?'selected':''}`}
                      onClick={()=>setForm(prev=>({...prev,ide:ide.name,ide_id:ide.id,ide_path:''}))}>
                      <div className="ide-item-info">
                        <div className="ide-item-name">{ide.name}</div>
                        <div className="ide-item-path">{ide.execPath}</div>
                      </div>
                      <div className="ide-item-check">
                        {form.ide===ide.name && <Check size={11} strokeWidth={3} />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="ide-divider">— custom —</div>
              <Field label="Custom path">
                <div className="path-row">
                  <input value={form.ide_path} onChange={set('ide_path')} placeholder="C:\editor.exe" className="path-input" />
                  <button className="btn browse-btn" onClick={browseIDE}>Browse</button>
                </div>
              </Field>
            </>
          )}

          {step===3 && (
            <>
              <div className="options-list">
                <label className="option-row">
                  <input type="checkbox" checked={!!form.open_terminal} onChange={set('open_terminal')} />
                  <div>
                    <div className="option-title">Open terminal</div>
                    <div className="option-desc">Launch terminal at project folder on start</div>
                  </div>
                </label>
                <label className="option-row">
                  <input type="checkbox" checked={!!form.open_browser} onChange={set('open_browser')} />
                  <div>
                    <div className="option-title">Open browser</div>
                    <div className="option-desc">Open URL after server starts</div>
                  </div>
                </label>
                <label className="option-row">
                  <input type="checkbox" checked={!!form.install_deps} onChange={set('install_deps')} />
                  <div>
                    <div className="option-title">Install dependencies</div>
                    <div className="option-desc">Run pip/npm/composer before each start</div>
                  </div>
                </label>
              </div>
            </>
          )}

        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
            {step>0 && (
              <button className="btn" onClick={back}>
                <ChevronLeft size={13}/> Back
              </button>
            )}
            {!isLast ? (
              <button className="btn primary" onClick={next}>
                Next <ChevronRight size={13}/>
              </button>
            ) : (
              <button className="btn primary" onClick={submit}>
                {isEdit ? 'Save changes' : 'Add project'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
