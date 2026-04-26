import { useState, useEffect } from 'react';
import { X, RotateCcw, Keyboard, Settings, Moon, Sun, Monitor, Bell, Download, Clock } from 'lucide-react';

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
      <div className="modal modal-wide settings-v2" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="title-with-icon">
            <Settings size={16} className="title-icon" />
            <h3>Settings</h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body settings-container">
          <div className="settings-nav">
            <button 
              className={`nav-item ${activeTab === 'shortcuts' ? 'active' : ''}`} 
              onClick={() => setActiveTab('shortcuts')}
            >
              <Keyboard size={14} />
              <span>Shortcuts</span>
            </button>
            <button 
              className={`nav-item ${activeTab === 'general' ? 'active' : ''}`} 
              onClick={() => setActiveTab('general')}
            >
              <Settings size={14} />
              <span>General</span>
            </button>
          </div>

          <div className="settings-content">
            {activeTab === 'shortcuts' && (
              <div className="settings-pane">
                <div className="pane-header">
                  <span className="pane-title">Keyboard Shortcuts</span>
                  <button className="btn small" onClick={resetAllShortcuts}>
                    <RotateCcw size={11} /> Reset Defaults
                  </button>
                </div>
                
                <div className="shortcuts-grid">
                  {ACTIONS.map(action => (
                    <div key={action.id} className="shortcut-row">
                      <div className="shortcut-label">
                        <span className="action-name">{action.name}</span>
                        {conflicts[action.id] && (
                          <span className="conflict-warn">
                            Conflict: {ACTIONS.find(a => a.id === conflicts[action.id])?.name}
                          </span>
                        )}
                      </div>
                      <div className="shortcut-input-group">
                        <button 
                          className={`shortcut-trigger ${recording?.id === action.id ? 'recording' : ''}`}
                          onClick={() => handleRecord(action.id)}
                        >
                          {recording?.id === action.id ? 'Press keys...' : (localSettings.shortcuts?.[action.id] || 'None')}
                        </button>
                        <button className="icon-btn sm" onClick={() => resetShortcut(action.id)} title="Reset">
                          <RotateCcw size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="settings-pane">
                <span className="pane-title">General Preferences</span>
                
                <div className="options-group">
                  <div className="option-tile">
                    <div className="option-icon"><Bell size={14} /></div>
                    <div className="option-info">
                      <span className="option-name">Notifications</span>
                      <span className="option-desc">Show desktop alerts for project status changes</span>
                    </div>
                    <label className="switch-toggle">
                      <input 
                        type="checkbox" 
                        checked={localSettings.notifications_enabled !== 0} 
                        onChange={e => setLocalSettings(prev => ({ ...prev, notifications_enabled: e.target.checked ? 1 : 0 }))} 
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>

                  <div className="option-tile">
                    <div className="option-icon"><Download size={14} /></div>
                    <div className="option-info">
                      <span className="option-name">Auto Updates</span>
                      <span className="option-desc">Automatically check for app updates on startup</span>
                    </div>
                    <label className="switch-toggle">
                      <input 
                        type="checkbox" 
                        checked={localSettings.auto_update_enabled !== 0} 
                        onChange={e => setLocalSettings(prev => ({ ...prev, auto_update_enabled: e.target.checked ? 1 : 0 }))} 
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>

                  <div className="option-tile">
                    <div className="option-icon"><Clock size={14} /></div>
                    <div className="option-info">
                      <span className="option-name">Daily Project Briefing</span>
                      <span className="option-desc">Show an intelligent summary when you first open a project each day</span>
                    </div>
                    <label className="switch-toggle">
                      <input 
                        type="checkbox" 
                        checked={localSettings.daily_briefing_enabled !== 0} 
                        onChange={e => setLocalSettings(prev => ({ ...prev, daily_briefing_enabled: e.target.checked ? 1 : 0 }))} 
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>

                  <div className="option-tile">
                    <div className="option-icon"><Monitor size={14} /></div>
                    <div className="option-info">
                      <span className="option-name">Theme Appearance</span>
                      <span className="option-desc">Customize the visual style of the application</span>
                    </div>
                    <div className="theme-selector">
                      <button 
                        className={`theme-opt ${localSettings.theme === 'system' ? 'active' : ''}`}
                        onClick={() => setLocalSettings(prev => ({ ...prev, theme: 'system' }))}
                        title="System"
                      >
                        <Monitor size={14} />
                      </button>
                      <button 
                        className={`theme-opt ${localSettings.theme === 'light' ? 'active' : ''}`}
                        onClick={() => setLocalSettings(prev => ({ ...prev, theme: 'light' }))}
                        title="Light"
                      >
                        <Sun size={14} />
                      </button>
                      <button 
                        className={`theme-opt ${localSettings.theme === 'dark' ? 'active' : ''}`}
                        onClick={() => setLocalSettings(prev => ({ ...prev, theme: 'dark' }))}
                        title="Dark"
                      >
                        <Moon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save Changes</button>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          .settings-v2 {
            height: 520px;
            padding: 0;
            overflow: hidden;
          }
          .settings-v2 .modal-header {
            padding: 14px 20px;
            border-bottom: 1px solid var(--b0);
            margin-bottom: 0;
          }
          .settings-v2 .modal-actions {
            padding: 14px 20px;
            margin-top: 0;
          }
          .title-with-icon {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .title-icon { color: var(--accent); }
          
          .settings-container {
            display: flex;
            flex-direction: row !important;
            padding: 0 !important;
            margin-bottom: 0 !important;
            overflow: hidden !important;
          }
          
          .settings-nav {
            width: 160px;
            background: var(--bg1);
            border-right: 1px solid var(--b0);
            display: flex;
            flex-direction: column;
            padding: 12px 8px;
            gap: 4px;
          }
          
          .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            border: none;
            background: none;
            color: var(--t2);
            font-size: 13px;
            font-family: inherit;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s;
            text-align: left;
          }
          
          .nav-item:hover { background: var(--b0); color: var(--t1); }
          .nav-item.active {
            background: var(--accent-bg);
            color: var(--accent);
            font-weight: 500;
          }
          
          .settings-content {
            flex: 1;
            padding: 24px;
            overflow-y: auto;
            background: var(--bg0);
          }
          
          .settings-pane {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          
          .pane-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
          }
          
          .pane-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--t2);
          }
          
          .shortcuts-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .shortcut-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            background: var(--bg1);
            border: 1px solid var(--b0);
            border-radius: 8px;
          }
          
          .shortcut-label {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          
          .action-name { font-size: 13px; color: var(--t0); }
          .conflict-warn { font-size: 10px; color: var(--red); font-weight: 500; }
          
          .shortcut-input-group {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .shortcut-trigger {
            min-width: 120px;
            padding: 6px 12px;
            background: var(--bg0);
            border: 1px solid var(--b1);
            border-radius: 6px;
            color: var(--accent);
            font-family: var(--font);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
          }
          
          .shortcut-trigger:hover { border-color: var(--accent); background: var(--accent-bg); }
          .shortcut-trigger.recording {
            border-color: var(--ignite);
            background: var(--ignite-bg);
            color: var(--ignite);
            box-shadow: 0 0 0 2px rgba(245, 93, 30, 0.15);
          }
          
          .options-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          
          .option-tile {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 14px;
            background: var(--bg1);
            border: 1px solid var(--b0);
            border-radius: 10px;
          }
          
          .option-icon {
            width: 32px;
            height: 32px;
            background: var(--bg2);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--t1);
          }
          
          .option-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
          .option-name { font-size: 13px; font-weight: 600; color: var(--t0); }
          .option-desc { font-size: 11px; color: var(--t2); line-height: 1.4; }
          
          .switch-toggle {
            position: relative;
            display: inline-block;
            width: 34px;
            height: 18px;
            flex-shrink: 0;
          }
          .switch-toggle input { opacity: 0; width: 0; height: 0; }
          .switch-slider {
            position: absolute;
            cursor: pointer;
            inset: 0;
            background-color: var(--b2);
            transition: .2s;
            border-radius: 20px;
          }
          .switch-slider:before {
            position: absolute;
            content: "";
            height: 12px;
            width: 12px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .2s;
            border-radius: 50%;
          }
          input:checked + .switch-slider { background-color: var(--accent); }
          input:checked + .switch-slider:before { transform: translateX(16px); }
          
          .theme-selector {
            display: flex;
            background: var(--bg2);
            padding: 3px;
            border-radius: 8px;
            border: 1px solid var(--b0);
          }
          
          .theme-opt {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            background: none;
            color: var(--t2);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.1s;
          }
          
          .theme-opt:hover { color: var(--t0); }
          .theme-opt.active {
            background: var(--bg0);
            color: var(--accent);
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          }
        `}} />
      </div>
    </div>
  );
}
