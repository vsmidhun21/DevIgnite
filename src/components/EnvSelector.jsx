import { useState, useEffect } from 'react';

const api = window.devignite;

export default function EnvSelector({ project, envFiles, onChange }) {
  const [selected, setSelected] = useState(project.env_file || '');
  const [preview,  setPreview]  = useState(null);

  useEffect(() => {
    setSelected(project.env_file || '');
    setPreview(null);
  }, [project.env_file]);

  const handleChange = async (filename) => {
    setSelected(filename);
    setPreview(null);
    onChange?.(filename || null);
    if (filename) {
      try {
        const parsed = await api.env.parse(project.path, filename);
        setPreview(parsed);
      } catch {}
    }
  };

  const files = envFiles || [];

  if (files.length === 0) {
    return (
      <div className="env-selector empty">
        <span className="env-none-icon">○</span>
        <span>No .env files found — commands run without environment file</span>
      </div>
    );
  }

  return (
    <div className="env-selector">
      <div className="env-files">
        <button className={`env-pill ${!selected ? 'active' : ''}`} onClick={() => handleChange('')}>
          auto
        </button>
        {files.map(f => (
          <button
            key={f.filename}
            className={`env-pill ${selected === f.filename ? 'active' : ''}`}
            onClick={() => handleChange(f.filename)}
          >
            {f.filename}
          </button>
        ))}
      </div>
      {preview && (
        <div className="env-preview">
          {Object.entries(preview).slice(0, 6).map(([k, v]) => (
            <div key={k} className="env-kv">
              <span className="env-key">{k}</span>
              <span className="env-val">{String(v).length > 28 ? String(v).slice(0, 28)+'…' : String(v)}</span>
            </div>
          ))}
          {Object.keys(preview).length > 6 && (
            <div className="env-more">+{Object.keys(preview).length - 6} more</div>
          )}
        </div>
      )}
    </div>
  );
}
