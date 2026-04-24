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
          {/* Section 1: Resume */}
          <div className="briefing-section">
            <div className="section-title">
              <History size={16} className="title-icon" />
              <h2>Resume Where You Left Off</h2>
            </div>
            <div className="resume-grid">
              {resume.lastFiles.length > 0 ? (
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
              ) : (
                <div className="empty-section">
                  <CheckCircle2 size={24} className="empty-icon" />
                  <p>All clear! No recent changes detected.</p>
                </div>
              )}
            </div>
          </div>

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
              <div className="todo-list">
                {todos.length > 0 ? (
                  todos.slice(0, 6).map((todo, i) => (
                    <div key={i} className={`todo-item type-${todo.type.toLowerCase()}`}>
                      <div className="todo-content">
                        <span className="todo-type">{todo.type}</span>
                        <span className="todo-text">{todo.text}</span>
                      </div>
                      <div className="todo-loc">
                        {todo.file}:{todo.line}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-todos">
                    <CheckCircle2 size={24} />
                    <p>No TODOs or FIXMEs found in the codebase.</p>
                  </div>
                )}
                {todos.length > 6 && (
                  <div className="todo-more">+{todos.length - 6} more tasks</div>
                )}
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
            <button className="action-btn" onClick={handleDismiss}>
              <ExternalLink size={16} />
              <span>View Changes</span>
            </button>
          </div>
          <button className="dismiss-link" onClick={handleDismiss}>
            Maybe later
          </button>
        </div>
      </div>

      <style>{`
        .briefing-overlay {
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          animation: fadeIn 0.3s ease-out;
        }

        .briefing-modal {
          width: 800px;
          max-width: 90vw;
          max-height: 85vh;
          background: var(--bg1);
          border: 1px solid var(--b1);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
          overflow: hidden;
          position: relative;
        }

        .briefing-header {
          padding: 40px 40px 24px;
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
          padding: 4px 12px;
          border-radius: 100px;
          width: fit-content;
          margin-bottom: 12px;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          box-shadow: 0 0 8px var(--ignite);
        }

        .project-badge span {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 700;
          color: var(--t2);
        }

        .briefing-header h1 {
          font-size: 32px;
          font-weight: 800;
          margin: 0;
          color: var(--t0);
          letter-spacing: -0.02em;
        }

        .welcome-text {
          color: var(--t2);
          margin: 8px 0 0;
          font-size: 14px;
        }

        .close-briefing {
          background: var(--bg2);
          border: 1px solid var(--b1);
          color: var(--t2);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-briefing:hover {
          background: var(--bg3);
          color: var(--t0);
          transform: rotate(90deg);
        }

        .briefing-body {
          padding: 0 40px 40px;
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .briefing-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--t1);
        }

        .title-icon {
          color: var(--ignite);
        }

        .section-title h2 {
          font-size: 14px;
          font-weight: 700;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .resume-grid {
          background: var(--bg0);
          border: 1px solid var(--b0);
          border-radius: 12px;
          padding: 20px;
        }

        .file-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: var(--bg1);
          border: 1px solid var(--b1);
          border-radius: 8px;
        }

        .file-icon {
          color: var(--accent);
          opacity: 0.7;
        }

        .file-name {
          font-weight: 600;
          font-size: 13px;
          color: var(--t1);
        }

        .file-path {
          font-size: 11px;
          color: var(--t3);
          font-family: var(--font-mono);
          opacity: 0.6;
        }

        .file-more {
          font-size: 12px;
          color: var(--t3);
          padding-left: 12px;
          font-style: italic;
        }

        .briefing-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .git-summary-card {
          background: var(--bg0);
          border: 1px solid var(--b0);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .branch-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .branch-label {
          font-size: 10px;
          color: var(--t3);
          text-transform: uppercase;
          font-weight: 700;
        }

        .branch-name {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--ignite);
          font-weight: 700;
          font-size: 16px;
        }

        .commit-info {
          background: var(--bg1);
          border: 1px solid var(--b1);
          border-radius: 8px;
          padding: 12px;
        }

        .commit-msg {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 12px;
          color: var(--t1);
          font-size: 13px;
          line-height: 1.4;
        }

        .msg-icon {
          margin-top: 2px;
          opacity: 0.5;
        }

        .commit-meta {
          display: flex;
          gap: 16px;
          border-top: 1px solid var(--b1);
          padding-top: 10px;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--t3);
          font-size: 11px;
        }

        .todo-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .todo-item {
          background: var(--bg0);
          border: 1px solid var(--b0);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: transform 0.2s;
        }

        .todo-item:hover {
          transform: translateX(4px);
          border-color: var(--b1);
        }

        .todo-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .todo-type {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .type-todo .todo-type { background: #3b82f620; color: #3b82f6; }
        .type-fixme .todo-type { background: #ef444420; color: #ef4444; }

        .todo-text {
          font-size: 12px;
          color: var(--t1);
          font-weight: 500;
        }

        .todo-loc {
          font-size: 10px;
          color: var(--t3);
          font-family: var(--font-mono);
          opacity: 0.6;
        }

        .briefing-footer {
          padding: 24px 40px;
          background: var(--bg2);
          border-top: 1px solid var(--b1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .quick-actions {
          display: flex;
          gap: 12px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid var(--b1);
          background: var(--bg1);
          color: var(--t1);
        }

        .action-btn.primary {
          background: var(--ignite);
          border-color: var(--ignite);
          color: white;
          box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);
        }

        .action-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(234, 88, 12, 0.4);
        }

        .hover-arrow {
          opacity: 0;
          transform: translateX(-5px);
          transition: all 0.2s;
        }

        .action-btn.primary:hover .hover-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        .dismiss-link {
          background: none;
          border: none;
          color: var(--t3);
          font-size: 13px;
          cursor: pointer;
          transition: color 0.2s;
        }

        .dismiss-link:hover {
          color: var(--t1);
          text-decoration: underline;
        }

        .fade-out { animation: fadeOut 0.3s ease-in forwards; }
        .slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-down { animation: slideDown 0.3s cubic-bezier(0.7, 0, 0.84, 0) forwards; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(30px); opacity: 0; } }

        .empty-section, .empty-todos {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: var(--t3);
          gap: 12px;
        }

        .empty-icon { opacity: 0.3; }
        .empty-section p, .empty-todos p { margin: 0; font-size: 12px; text-align: center; }
      `}</style>
    </div>
  );
}
