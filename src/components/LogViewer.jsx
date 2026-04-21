import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { ChevronsDown, Trash2 } from 'lucide-react';

const api = window.devignite;
const LEVEL_CLASS = { info:'', warn:'warn', error:'error', success:'success' };

const LogLine = memo(({ line }) => (
  <div className={`log-line ${LEVEL_CLASS[line.level]||''}`}>
    <span className="log-ts">
      {line.ts ? new Date(line.ts).toTimeString().slice(0,8) : ''}
    </span>
    <span className="log-msg">{line.message}</span>
  </div>
));

export default memo(function LogViewer({ projectId, onClearLogs }) {
  const [which,      setWhich]      = useState('current');
  const [savedLogs,  setSavedLogs]  = useState([]);
  const [localLogs,  setLocalLogs]  = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [meta,       setMeta]       = useState(null);
  const panelRef = useRef(null);
  const scrollTid = useRef(null);

  // Initial load and stream subscription
  useEffect(() => {
    if (!projectId) return;

    // Load history if current or previous is selected
    const loadLogs = async () => {
      const logs = await api.logs.read(projectId, which);
      if (which === 'current') setLocalLogs(logs);
      else setSavedLogs(logs);
      
      const m = await api.logs.meta(projectId);
      setMeta(m);
    };

    loadLogs();

    if (which === 'current') {
      const unsub = api.on.logStream(data => {
        if (data.projectId === projectId) {
          setLocalLogs(prev => [...prev.slice(-999), data]);
        }
      });
      return () => unsub?.();
    }
  }, [projectId, which]);

  // Optimized Scroll handling
  useEffect(() => {
    if (autoScroll && panelRef.current) {
      if (scrollTid.current) cancelAnimationFrame(scrollTid.current);
      scrollTid.current = requestAnimationFrame(() => {
        if (panelRef.current) {
          panelRef.current.scrollTop = panelRef.current.scrollHeight;
        }
      });
    }
    return () => { if (scrollTid.current) cancelAnimationFrame(scrollTid.current); };
  }, [localLogs, savedLogs, autoScroll]);

  const onScroll = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (isAtBottom !== autoScroll) setAutoScroll(isAtBottom);
  }, [autoScroll]);

  const clear = async () => {
    if (onClearLogs) await onClearLogs();
    else await api.logs.clear(projectId);
    setSavedLogs([]);
    setLocalLogs([]);
  };

  const lines = which === 'current' ? localLogs : savedLogs;

  return (
    <div className="log-viewer">
      <div className="log-toolbar">
        <div className="log-tabs">
          <button className={`log-tab ${which==='current'?'active':''}`} onClick={() => setWhich('current')}>
            Current
            {localLogs.length > 0 && <span className="log-count">{localLogs.length}</span>}
          </button>
          <button className={`log-tab ${which==='previous'?'active':''}`}
            onClick={() => setWhich('previous')} disabled={!meta?.previous}>
            Previous
          </button>
        </div>
        <div className="log-actions">
          <button className={`icon-btn ${autoScroll?'active':''}`} title="Auto-scroll"
            onClick={() => setAutoScroll(v => !v)}>
            <ChevronsDown size={12} strokeWidth={2}/>
          </button>
          <button className="icon-btn danger" title="Clear" onClick={clear}>
            <Trash2 size={11} strokeWidth={2}/>
          </button>
        </div>
      </div>

      <div className="log-panel" ref={panelRef} onScroll={onScroll}>
        {lines.length === 0 ? (
          <div className="log-empty">
            {which==='current' ? 'No output. Start Work to begin.' : 'No previous session.'}
          </div>
        ) : (
          lines.map((line, i) => <LogLine key={i} line={line} />)
        )}
      </div>

      {meta?.current && meta.current.size > 0 && (
        <div className="log-footer">{(meta.current.size/1024).toFixed(1)} KB</div>
      )}
    </div>
  );
});

