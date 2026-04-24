import { useState, useEffect } from 'react';
import { 
  X, GitBranch, History, ListTodo, Play, Code2, 
  ChevronRight, Calendar, User, MessageSquare, 
  ExternalLink, CheckCircle2, Clock, FileText,
  AlertCircle, ArrowRight
} from 'lucide-react';

const api = window.devignite;

export default function DailyBriefingModal({ project, onClose, onResumeWork, onOpenIDE }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const result = await api.projects.getBriefing(project.id, project.path);
        if (result.shouldShow) {
          setData(result.data);
        } else {
          onClose(); // Should not happen if triggered correctly, but safe fallback
        }
      } catch (e) {
        console.error('Failed to load briefing:', e);
        onClose();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [project.id, project.path, onClose]);

  const handleDismiss = async () => {
    setClosing(true);
    await api.projects.markBriefingShown(project.id);
    setTimeout(onClose, 300);
  };

  const handleResume = () => {
    onResumeWork();
    handleDismiss();
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  if (loading) return null; // Or a themed loader
  if (!data) return null;

  const { git, todos, resume } = data;
  const lastCommit = git.lastCommit;

  return (
    <div className={`modal-overlay briefing-overlay ${closing ? 'fade-out' : ''}`}>
      <div className={`briefing-modal ${closing ? 'slide-down' : 'slide-up'}`}>
        <div className="briefing-header">
          <div className="header-content">
            <div className="project-badge">
              <div className="badge-dot" style={{ background: 'var(--ignite)' }} />
              <span>Project Briefing</span>
            </div>
            <h1>{project.name}</h1>
            <p className="welcome-text">Here's what happened since you were last here.</p>
          </div>
          <button className="close-briefing" onClick={handleDismiss}>
            <X size={20} />
          </button>
        </div>

        <div className="briefing-body">
          {/* Section 1: Resume - Only show if there are files */}
          {resume.lastFiles.length > 0 && (
            <div className="briefing-section">
              <div className="section-title">
                <History size={16} className="title-icon" />
                <h2>Resume Where You Left Off</h2>
              </div>
              <div className="resume-grid">
                <div className="file-list">
                  {resume.lastFiles.slice(0, 5).map((file, i) => (
                    <div key={i} className="file-item">
                      <FileText size={14} className="file-icon" />
                      <span className="file-name">{file.split('/').pop()}</span>
                      <span className="file-path">{file.split('/').slice(0, -1).join('/')}</span>
                    </div>
                  ))}
                  {resume.lastFiles.length > 5 && (
                    <div className="file-more">and {resume.lastFiles.length - 5} more files...</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="briefing-grid">
            {/* Section 2: Git Summary */}
            <div className="briefing-section">
              <div className="section-title">
                <GitBranch size={16} className="title-icon" />
                <h2>Git Summary</h2>
              </div>
              <div className="git-summary-card">
                <div className="branch-info">
                  <span className="branch-label">Current Branch</span>
                  <div className="branch-name">
                    <GitBranch size={14} />
                    {git.branch || 'main'}
                  </div>
                </div>
                {lastCommit ? (
                  <div className="commit-info">
                    <div className="commit-msg">
                      <MessageSquare size={14} className="msg-icon" />
                      <span>{lastCommit.message}</span>
                    </div>
                    <div className="commit-meta">
                      <div className="meta-item">
                        <User size={12} />
                        <span>{lastCommit.author}</span>
                      </div>
                      <div className="meta-item">
                        <Clock size={12} />
                        <span>{formatTime(lastCommit.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-commit">No recent commits found.</div>
                )}
              </div>
            </div>

            {/* Section 3: Pending Tasks */}
            <div className="briefing-section">
              <div className="section-title">
                <ListTodo size={16} className="title-icon" />
                <h2>Pending Tasks</h2>
              </div>
              <div className="todo-container">
                <div className="todo-list">
                  {todos.length > 0 ? (
                    todos.slice(0, 8).map((todo, i) => (
                      <div key={i} className={`todo-item type-${todo.type.toLowerCase()}`}>
                        <div className="todo-content">
                          <span className={`todo-type ${todo.source === 'app' ? 'type-app' : ''}`}>{todo.type}</span>
                          <span className="todo-text">{todo.text}</span>
                        </div>
                        {todo.source === 'file' && (
                          <div className="todo-loc">
                            {todo.file}:{todo.line}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="empty-todos">
                      <CheckCircle2 size={24} className="empty-icon" />
                      <p>No pending tasks found for this project.</p>
                    </div>
                  )}
                  {todos.length > 8 && (
                    <div className="todo-more">+{todos.length - 8} more tasks</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="briefing-footer">
          <div className="quick-actions">
            <button className="action-btn primary" onClick={handleResume}>
              <Play size={16} />
              <span>Resume Work</span>
              <ArrowRight size={14} className="hover-arrow" />
            </button>
            <button className="action-btn" onClick={() => { onOpenIDE(); handleDismiss(); }}>
              <Code2 size={16} />
              <span>Open in IDE</span>
            </button>
          </div>
          <button className="dismiss-link" onClick={handleDismiss}>
            Maybe later
          </button>
        </div>
      </div>

      <style>{`
        .briefing-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
          animation: fadeIn 0.3s ease-out;
        }

        .briefing-modal {
          width: 860px;
          max-width: 90vw;
          max-height: 85vh;
          background: var(--bg1);
          border: 1px solid var(--b1);
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
          overflow: hidden;
          position: relative;
        }

        .briefing-header {
          padding: 48px 48px 32px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: linear-gradient(to bottom, var(--bg2), var(--bg1));
        }

        .project-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg0);
          border: 1px solid var(--b1);
          padding: 5px 14px;
          border-radius: 100px;
          width: fit-content;
          margin-bottom: 16px;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--ignite);
          box-shadow: 0 0 10px var(--ignite);
        }

        .project-badge span {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 800;
          color: var(--t2);
        }

        .briefing-header h1 {
          font-size: 36px;
          font-weight: 800;
          margin: 0;
          color: var(--t0);
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .welcome-text {
          color: var(--t2);
          margin: 12px 0 0;
          font-size: 15px;
          opacity: 0.8;
        }

        .close-briefing {
          background: var(--bg2);
          border: 1px solid var(--b1);
          color: var(--t2);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .close-briefing:hover {
          background: var(--bg3);
          color: var(--t0);
          transform: rotate(90deg) scale(1.1);
        }

        .briefing-body {
          padding: 0 48px 48px;
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }

        .briefing-section {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--t1);
        }

        .title-icon {
          color: var(--ignite);
        }

        .section-title h2 {
          font-size: 14px;
          font-weight: 800;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.7;
        }

        .resume-grid, .todo-container {
          background: var(--bg0);
          border: 1px solid var(--b0);
          border-radius: 16px;
          padding: 20px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        .file-list, .todo-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .file-item, .todo-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: var(--bg1);
          border: 1px solid var(--b1);
          border-radius: 10px;
          transition: all 0.2s;
        }

        .file-item:hover, .todo-item:hover {
          transform: translateX(6px);
          border-color: var(--ignite-50);
          background: var(--bg2);
        }

        .file-icon {
          color: var(--accent);
          opacity: 0.8;
        }

        .file-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--t1);
        }

        .file-path {
          font-size: 11px;
          color: var(--t3);
          font-family: var(--font-mono);
          opacity: 0.5;
        }

        .file-more, .todo-more {
          font-size: 12px;
          color: var(--t3);
          padding: 4px 14px;
          font-style: italic;
          opacity: 0.7;
        }

        .briefing-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }

        .git-summary-card {
          background: var(--bg0);
          border: 1px solid var(--b0);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        .branch-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .branch-label {
          font-size: 10px;
          color: var(--t3);
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .branch-name {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--ignite);
          font-weight: 800;
          font-size: 18px;
        }

        .commit-info {
          background: var(--bg1);
          border: 1px solid var(--b1);
          border-radius: 12px;
          padding: 16px;
        }

        .commit-msg {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 16px;
          color: var(--t1);
          font-size: 14px;
          line-height: 1.5;
          font-weight: 500;
        }

        .msg-icon {
          margin-top: 3px;
          opacity: 0.4;
        }

        .commit-meta {
          display: flex;
          gap: 20px;
          border-top: 1px solid var(--b1);
          padding-top: 12px;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--t3);
          font-size: 12px;
        }

        .todo-item {
          justify-content: space-between;
        }

        .todo-content {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }

        .todo-type {
          font-size: 9px;
          font-weight: 900;
          padding: 2px 8px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .type-todo .todo-type { background: #3b82f620; color: #3b82f6; }
        .type-fixme .todo-type { background: #ef444420; color: #ef4444; }
        .todo-type.type-app { background: var(--ignite-bg); color: var(--ignite); border: 1px solid var(--ignite-20); }

        .todo-text {
          font-size: 13px;
          color: var(--t1);
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 200px;
        }

        .todo-loc {
          font-size: 10px;
          color: var(--t3);
          font-family: var(--font-mono);
          opacity: 0.5;
          margin-left: 12px;
        }

        .briefing-footer {
          padding: 32px 48px;
          background: var(--bg2);
          border-top: 1px solid var(--b1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .quick-actions {
          display: flex;
          gap: 16px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid var(--b1);
          background: var(--bg1);
          color: var(--t1);
        }

        .action-btn.primary {
          background: var(--ignite);
          border-color: var(--ignite);
          color: white;
          box-shadow: 0 8px 24px rgba(234, 88, 12, 0.3);
        }

        .action-btn.primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(234, 88, 12, 0.4);
          background: var(--ignite-hover, #f97316);
        }

        .action-btn:not(.primary):hover {
          background: var(--bg3);
          transform: translateY(-2px);
          border-color: var(--b0);
        }

        .hover-arrow {
          opacity: 0;
          transform: translateX(-8px);
          transition: all 0.3s;
        }

        .action-btn.primary:hover .hover-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        .dismiss-link {
          background: none;
          border: none;
          color: var(--t2);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          padding: 10px 20px;
          border-radius: 8px;
        }

        .dismiss-link:hover {
          color: var(--t0);
          background: var(--bg3);
          text-decoration: none;
        }

        .fade-out { animation: fadeOut 0.3s ease-in forwards; }
        .slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-down { animation: slideDown 0.3s cubic-bezier(0.7, 0, 0.84, 0) forwards; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideUp { from { transform: translateY(40px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(40px) scale(0.95); opacity: 0; } }

        .empty-todos {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          color: var(--t3);
          gap: 16px;
          opacity: 0.7;
        }

        .empty-icon { opacity: 0.4; }
        .empty-todos p { margin: 0; font-size: 14px; text-align: center; font-weight: 500; }
      `}</style>
    </div>
  );
}
