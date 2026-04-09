// src/components/EnvSelector.jsx
// Detects .env files in the project folder and lets the user pick one.

import { useState, useEffect } from 'react';

const api = window.devignite;

export default function EnvSelector({ project, onChange }) {
  const [files,    setFiles]    = useState([]);
  const [selected, setSelected] = useState(project.env_file || '');
  const [preview,  setPreview]  = useState(null);

  useEffect(() => {
    if (!project.path) return;
    api.env.detect(project.path).then(setFiles);
  }, [project.path]);

  const handleChange = async (filename) => {
    setSelected(filename);
    setPreview(null);
    onChange?.(filename || null);

    if (filename) {
      const parsed = await api.env.parse(project.path, filename);
      setPreview(parsed);
    }
  };

  if (files.length === 0) {
    return (
      <div className="env-selector empty">
        <span className="env-none-icon">⚠</span>
        <span>No .env files found in project folder</span>
      </div>
    );
  }

  return (
    <div className="env-selector">
      <div className="env-files">
        <button
          className={`env-pill ${!selected ? 'active' : ''}`}
          onClick={() => handleChange('')}
        >
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
          {Object.entries(preview).slice(0, 8).map(([k, v]) => (
            <div key={k} className="env-kv">
              <span className="env-key">{k}</span>
              <span className="env-val">{v.length > 30 ? v.slice(0, 30) + '…' : v}</span>
            </div>
          ))}
          {Object.keys(preview).length > 8 && (
            <div className="env-more">+{Object.keys(preview).length - 8} more vars</div>
          )}
        </div>
      )}
    </div>
  );
}
