// src/components/LogViewer.jsx
// Real-time log display with current/previous session toggle.

import { useState, useEffect, useRef } from 'react';

const api = window.devignite;

const LEVEL_CLASS = { info: '', warn: 'warn', error: 'error', success: 'success' };

export default function LogViewer({ projectId, streamedLogs }) {
  const [which,      setWhich]      = useState('current');
  const [savedLogs,  setSavedLogs]  = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [meta,       setMeta]       = useState(null);
  const panelRef = useRef(null);

  // Load saved log file when switching between current/previous
  useEffect(() => {
    if (!projectId) return;
    api.logs.read(projectId, which).then(setSavedLogs);
    api.logs.meta(projectId).then(setMeta);
  }, [projectId, which]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [streamedLogs, savedLogs, autoScroll]);

  const handleScroll = () => {
    const el = panelRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  const handleClear = async () => {
    await api.logs.clear(projectId);
    setSavedLogs([]);
  };

  // In "current" mode, show streamed lines; in "previous", show saved file
  const displayLines = which === 'current' ? streamedLogs : savedLogs;

  return (
    <div className="log-viewer">
      <div className="log-toolbar">
        <div className="log-tabs">
          <button
            className={`log-tab ${which === 'current' ? 'active' : ''}`}
            onClick={() => setWhich('current')}
          >
            Current
            {streamedLogs.length > 0 && (
              <span className="log-count">{streamedLogs.length}</span>
            )}
          </button>
          <button
            className={`log-tab ${which === 'previous' ? 'active' : ''}`}
            onClick={() => setWhich('previous')}
            disabled={!meta?.previous}
          >
            Previous
          </button>
        </div>
        <div className="log-actions">
          <button
            className={`icon-btn ${autoScroll ? 'active' : ''}`}
            title="Auto-scroll"
            onClick={() => setAutoScroll(v => !v)}
          >↓</button>
          <button
            className="icon-btn danger"
            title="Clear logs"
            onClick={handleClear}
          >✕</button>
        </div>
      </div>

      <div className="log-panel" ref={panelRef} onScroll={handleScroll}>
        {displayLines.length === 0 ? (
          <div className="log-empty">
            {which === 'current' ? 'No output yet. Click Start Work to begin.' : 'No previous session found.'}
          </div>
        ) : (
          displayLines.map((line, i) => (
            <div key={i} className={`log-line ${LEVEL_CLASS[line.level] || ''}`}>
              <span className="log-ts">
                {line.ts ? new Date(line.ts).toTimeString().slice(0, 8) : ''}
              </span>
              <span className="log-msg">{line.message}</span>
            </div>
          ))
        )}
      </div>

      {meta?.current && (
        <div className="log-footer">
          {meta.current.size > 0 && `${(meta.current.size / 1024).toFixed(1)} KB`}
        </div>
      )}
    </div>
  );
}
