import { useState, useEffect, useRef } from 'react';

const ACTIONS = [
  { id: 'openSearch',     name: 'Open Global Search' },
  { id: 'startProject',    name: 'Start Project' },
  { id: 'stopProject',     name: 'Stop Project' },
  { id: 'restartProject',  name: 'Restart Project' },
  { id: 'toggleSidebar',   name: 'Toggle Sidebar' },
  { id: 'focusLogs',       name: 'Focus Logs' },
  { id: 'focusSearch',     name: 'Focus Search' },
];

const DEFAULT_SHORTCUTS = {
  openSearch: 'Control+k',
  startProject: 'Control+Enter',
  stopProject: 'Control+Shift+Enter',
  restartProject: 'Control+r',
  toggleSidebar: 'Control+b',
  focusLogs: 'Control+l',
  focusSearch: 'Control+f',
};

export default function SettingsModal({ settings, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState('shortcuts');
  const [localSettings, setLocalSettings] = useState(settings);
  const [recording, setRecording] = useState(null); // { id }
  const [conflicts, setConflicts] = useState({}); // { id: conflictId }

  useEffect(() => {
    // Validate for conflicts
    const newConflicts = {};
    const shortcuts = localSettings.shortcuts || {};
    const entries = Object.entries(shortcuts);
    
    entries.forEach(([id, combo]) => {
      if (!combo) return;
      const duplicate = entries.find(([otherId, otherCombo]) => otherId !== id && otherCombo?.toLowerCase() === combo?.toLowerCase());
      if (duplicate) {
        newConflicts[id] = duplicate[0];
      }
    });
    setConflicts(newConflicts);
  }, [localSettings.shortcuts]);

  const handleRecord = (id) => {
    setRecording({ id });
  };

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecording(null);
        return;
      }

      const modifiers = [];
      if (e.ctrlKey || e.metaKey) modifiers.push('Control');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');

      let key = e.key;
      if (key === ' ') key = 'Space';
      // Only capture if it's not JUST a modifier
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return;
      
      if (key.length === 1) key = key.toLowerCase();

      const newCombo = [...modifiers, key].join('+');
      
      setLocalSettings(prev => ({
        ...prev,
        shortcuts: {
          ...prev.shortcuts,
          [recording.id]: newCombo
        }
      }));
      setRecording(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recording]);

  const resetShortcut = (id) => {
    setLocalSettings(prev => ({
      ...prev,
      shortcuts: {
        ...prev.shortcuts,
        [id]: DEFAULT_SHORTCUTS[id]
      }
    }));
  };

  const resetAllShortcuts = () => {
    if (!confirm('Reset all shortcuts to defaults?')) return;
    setLocalSettings(prev => ({
      ...prev,
      shortcuts: { ...DEFAULT_SHORTCUTS }
    }));
  };

  const save = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-layout">
          <div className="settings-sidebar">
            <button className={`settings-tab ${activeTab === 'shortcuts' ? 'active' : ''}`} onClick={() => setActiveTab('shortcuts')}>
              Keyboard Shortcuts
            </button>
            <button className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>
              General
            </button>
          </div>

          <div className="settings-body">
            {activeTab === 'shortcuts' && (
              <div className="settings-section">
                <div className="section-header">
                  <h3>Keyboard Shortcuts</h3>
                  <button className="btn sm" onClick={resetAllShortcuts}>Reset All</button>
                </div>
                <div className="shortcut-list">
                  {ACTIONS.map(action => (
                    <div key={action.id} className="shortcut-item">
                      <div className="shortcut-info">
                        <span className="shortcut-name">{action.name}</span>
                        {conflicts[action.id] && (
                          <span className="shortcut-conflict">Conflict with {ACTIONS.find(a => a.id === conflicts[action.id])?.name}</span>
                        )}
                      </div>
                      <div className="shortcut-actions">
                        <button 
                          className={`shortcut-key ${recording?.id === action.id ? 'recording' : ''}`}
                          onClick={() => handleRecord(action.id)}
                        >
                          {recording?.id === action.id ? 'Recording...' : (localSettings.shortcuts?.[action.id] || 'None')}
                        </button>
                        <button className="shortcut-reset" onClick={() => resetShortcut(action.id)} title="Reset to default">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="settings-section">
                <h3>General Settings</h3>
                <div className="general-settings">
                  <div className="setting-item">
                    <div className="setting-label">
                      <span>System Notifications</span>
                      <small>Show notifications when projects start or stop</small>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!localSettings.notifications_enabled} 
                        onChange={e => setLocalSettings(prev => ({ ...prev, notifications_enabled: e.target.checked }))} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="setting-item">
                    <div className="setting-label">
                      <span>Auto-update Check</span>
                      <small>Automatically check for updates on startup</small>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!localSettings.auto_update_enabled} 
                        onChange={e => setLocalSettings(prev => ({ ...prev, auto_update_enabled: e.target.checked }))} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="setting-item">
                    <div className="setting-label">
                      <span>Appearance</span>
                      <small>Choose your preferred theme</small>
                    </div>
                    <select 
                      className="form-control"
                      value={localSettings.theme || 'system'}
                      onChange={e => setLocalSettings(prev => ({ ...prev, theme: e.target.value }))}
                    >
                      <option value="system">System Default</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save Changes</button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .settings-modal {
          width: 680px;
          max-width: 90vw;
          padding: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .settings-layout {
          display: flex;
          height: 480px;
        }
        .settings-sidebar {
          width: 180px;
          background: var(--bg1);
          border-right: 1px solid var(--b0);
          padding: 12px 0;
          display: flex;
          flex-direction: column;
        }
        .settings-tab {
          padding: 10px 16px;
          text-align: left;
          background: none;
          border: none;
          color: var(--t1);
          font-family: var(--font);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.1s;
        }
        .settings-tab:hover {
          background: var(--b0);
          color: var(--t0);
        }
        .settings-tab.active {
          background: var(--bg0);
          color: var(--accent);
          font-weight: 600;
          border-left: 3px solid var(--accent);
        }
        .settings-body {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          background: var(--bg0);
        }
        .settings-section h3 {
          margin-bottom: 20px;
          font-size: 16px;
          color: var(--t0);
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .section-header h3 { margin-bottom: 0; }
        
        .shortcut-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .shortcut-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: var(--bg1);
          border-radius: 6px;
          border: 1px solid var(--b0);
        }
        .shortcut-info {
          display: flex;
          flex-direction: column;
        }
        .shortcut-name {
          font-size: 13px;
          color: var(--t0);
        }
        .shortcut-conflict {
          font-size: 10px;
          color: var(--red);
          margin-top: 2px;
        }
        .shortcut-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .shortcut-key {
          min-width: 100px;
          padding: 6px 12px;
          background: var(--bg0);
          border: 1px solid var(--b1);
          border-radius: 4px;
          color: var(--accent);
          font-family: var(--font);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        .shortcut-key:hover {
          border-color: var(--accent);
          background: var(--accent-bg);
        }
        .shortcut-key.recording {
          background: var(--ignite-bg);
          border-color: var(--ignite);
          color: var(--ignite);
          animation: pulse-recording 1.5s infinite;
        }
        @keyframes pulse-recording {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
        .shortcut-reset {
          background: none;
          border: none;
          color: var(--t2);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .shortcut-reset:hover {
          background: var(--b0);
          color: var(--t0);
        }

        .general-settings {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .setting-label {
          display: flex;
          flex-direction: column;
        }
        .setting-label span {
          font-size: 13px;
          font-weight: 500;
          color: var(--t0);
        }
        .setting-label small {
          font-size: 11px;
          color: var(--t2);
          margin-top: 2px;
        }

        /* Switch toggle */
        .switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background-color: var(--b2);
          transition: .3s;
          border-radius: 20px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }
        input:checked + .slider { background-color: var(--accent); }
        input:checked + .slider:before { transform: translateX(16px); }

        .form-control {
          background: var(--bg1);
          border: 1px solid var(--b1);
          color: var(--t0);
          padding: 6px 10px;
          border-radius: 4px;
          font-family: inherit;
          font-size: 13px;
          outline: none;
        }
        .form-control:focus { border-color: var(--accent); }
      `}} />
    </div>
  );
}
