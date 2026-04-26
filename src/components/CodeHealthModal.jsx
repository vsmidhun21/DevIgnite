import React, { useState, useEffect, useRef } from 'react';
import { Activity, X, Search, Check, FolderOpen, Code2, AlertTriangle, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react';

const api = window.devignite;

function Field({ label, children, error, hint }) {
  return (
    <div className="field">
      <label>{label}</label>
      {hint && <div style={{ fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}>{hint}</div>}
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export default function CodeHealthModal({ project, onClose }) {
  const [step, setStep] = useState('config'); // 'config', 'scanning', 'results'
  const [scope, setScope] = useState('full');
  const [entryFiles, setEntryFiles] = useState('src/index.js, src/main.js, src/App.jsx');
  const [progressData, setProgressData] = useState({ stage: '', progress: 0, message: '' });
  const [results, setResults] = useState(null);
  const [selectedTab, setSelectedTab] = useState('files');
  const [ignoredItems, setIgnoredItems] = useState(new Set());

  useEffect(() => {
    const unsub = api.on?.codeHealthProgress?.((data) => {
      if (data.projectId === project.id) {
        setProgressData(data);
        if (data.stage === 'DONE') {
          // It will get the actual results from the analyze call
        }
      }
    });
    return () => unsub && unsub();
  }, [project.id]);

  const startAnalysis = async () => {
    setStep('scanning');
    setProgressData({ stage: 'SCANNING', progress: 0, message: 'Starting analysis...' });
    
    try {
      const entries = entryFiles.split(',').map(s => s.trim()).filter(Boolean);
      const data = await api.codeHealth.analyze(project.id, { scope, entryFiles: entries });
      setResults(data);
      setStep('results');
    } catch (e) {
      setProgressData({ stage: 'ERROR', progress: 100, message: 'Error: ' + e.message });
    }
  };

  const getIssuesForTab = () => {
    if (!results) return [];
    if (selectedTab === 'files') return results.issues.unusedFiles;
    if (selectedTab === 'functions') return results.issues.unusedFunctions;
    if (selectedTab === 'variables') return results.issues.unusedVariables;
    if (selectedTab === 'imports') return results.issues.unusedImports;
    return [];
  };

  const issues = getIssuesForTab();
  const visibleIssues = issues.filter(issue => !ignoredItems.has(issue.name || issue.file));

  const toggleIgnore = (identifier) => {
    const newIgnored = new Set(ignoredItems);
    if (newIgnored.has(identifier)) newIgnored.delete(identifier);
    else newIgnored.add(identifier);
    setIgnoredItems(newIgnored);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ height: '80vh', padding: 0, overflow: 'hidden' }}>
        <div className="modal-header" style={{ padding: '16px 20px', marginBottom: 0, borderBottom: '1px solid var(--b0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={18} color="var(--ignite)" />
            <h3 style={{ margin: 0 }}>Code Health Analyzer</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ margin: 0, overflow: 'hidden' }}>
          
          {step === 'config' && (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'var(--bg2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--b0)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} color="var(--amber)" /> About this tool
                </div>
                <p style={{ fontSize: '12px', color: 'var(--t1)', lineHeight: 1.5, margin: 0 }}>
                  This tool uses AST (Abstract Syntax Tree) parsing to find dead code in your project. It detects files that are never imported, and variables/functions/imports that are declared but never used. 
                </p>
              </div>

              <Field label="Scan Scope">
                <select value={scope} onChange={e => setScope(e.target.value)}>
                  <option value="full">Full Project (exclude node_modules, dist, etc.)</option>
                  <option value="src">Only 'src' Directory</option>
                </select>
              </Field>

              <Field 
                label="Entry Files" 
                hint="Files that are executed directly and don't need to be imported (e.g. index.js)."
              >
                <input type="text" value={entryFiles} onChange={e => setEntryFiles(e.target.value)} placeholder="src/index.js, src/main.js" />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button className="btn primary" onClick={startAnalysis}><Search size={14} /> Start Analysis</button>
              </div>
            </div>
          )}

          {step === 'scanning' && (
            <div style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px', flex: 1 }}>
              <div className="spinner-ignite" style={{ width: 44, height: 44, border: '3px solid var(--b0)', borderTopColor: 'var(--ignite)', borderRadius: '50%', animation: 'spin-ignite 0.8s linear infinite' }} />
              
              <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ color: 'var(--t2)' }}>{progressData.stage}</span>
                  <span style={{ color: 'var(--ignite)' }}>{progressData.progress}%</span>
                </div>
                <div className="update-progress-bar-track" style={{ height: '6px' }}>
                  <div className="update-progress-bar-fill" style={{ width: `${progressData.progress}%` }} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--t1)', textAlign: 'center', marginTop: '4px' }}>
                  {progressData.message}
                </div>
              </div>
              <style>{`
                @keyframes spin-ignite { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .spinner-ignite { border-top-color: var(--ignite) !important; }
              `}</style>
            </div>
          )}

          {step === 'results' && results && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: '24px', padding: '16px 24px', background: 'var(--bg1)', borderBottom: '1px solid var(--b0)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Files Scanned</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--t0)' }}>{results.summary.totalScanned}</span>
                </div>
                <div style={{ width: '1px', background: 'var(--b0)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Issues Found</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: results.summary.totalIssues > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {results.summary.totalIssues}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', borderBottom: '1px solid var(--b0)', background: 'var(--bg2)', padding: '0 12px' }}>
                {[
                  { id: 'files', label: 'Files', count: results.issues.unusedFiles.length },
                  { id: 'functions', label: 'Funcs', count: results.issues.unusedFunctions.length },
                  { id: 'variables', label: 'Vars', count: results.issues.unusedVariables.length },
                  { id: 'imports', label: 'Imports', count: results.issues.unusedImports.length },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTab(tab.id)}
                    style={{
                      padding: '12px 16px', background: 'transparent', border: 'none',
                      borderBottom: selectedTab === tab.id ? '2px solid var(--ignite)' : '2px solid transparent',
                      color: selectedTab === tab.id ? 'var(--t0)' : 'var(--t2)',
                      fontWeight: selectedTab === tab.id ? 600 : 500,
                      cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab.label} <span style={{ background: selectedTab === tab.id ? 'var(--ignite-bg)' : 'var(--b0)', color: selectedTab === tab.id ? 'var(--ignite)' : 'var(--t2)', padding: '1px 6px', borderRadius: '10px', fontSize: '10px' }}>{tab.count}</span>
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'var(--bg0)' }}>
                {visibleIssues.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--t2)', gap: '12px', opacity: 0.7 }}>
                    <Check size={40} strokeWidth={1.5} />
                    <p style={{ fontSize: '13px' }}>Clean health! No unused {selectedTab} detected.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {visibleIssues.map((issue, idx) => {
                      const identifier = issue.name || issue.file;
                      return (
                        <div key={idx} style={{ background: 'var(--bg1)', border: '1px solid var(--b0)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--b0)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {selectedTab === 'files' ? <FolderOpen size={14} color="var(--t2)" /> : <Code2 size={14} color="var(--t2)" />}
                              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--t0)' }}>
                                {selectedTab === 'files' ? issue.file.split(/[\\/]/).pop() : issue.name}
                              </span>
                              {issue.confidence === 'High' && (
                                <span style={{ fontSize: '9px', background: 'var(--green-bg)', color: 'var(--green)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.02em' }}>Safe to remove</span>
                              )}
                            </div>
                            <button 
                              className="btn small" 
                              onClick={() => toggleIgnore(identifier)}
                              style={{ height: '24px', padding: '0 10px', fontSize: '11px' }}
                            >
                              Ignore
                            </button>
                          </div>
                          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--t2)', fontFamily: 'var(--font)', opacity: 0.8 }}>{issue.file} {issue.loc ? `(Line ${issue.loc.start.line})` : ''}</div>
                            {issue.codeSnippet && (
                              <pre style={{ margin: 0, padding: '10px 14px', background: 'var(--bg0)', border: '1px solid var(--b0)', borderRadius: '6px', fontSize: '11.5px', color: 'var(--t1)', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                {issue.codeSnippet.length > 300 ? issue.codeSnippet.substring(0, 300) + '...' : issue.codeSnippet}
                              </pre>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {step === 'results' && (
          <div className="modal-actions" style={{ padding: '12px 20px', background: 'var(--bg1)', borderTop: '1px solid var(--b0)', marginTop: 0 }}>
             <button className="btn" onClick={() => setStep('config')}>Back to Config</button>
             <button className="btn primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
