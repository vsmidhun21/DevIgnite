import React, { useState, useEffect, useRef } from 'react';
import { Download, X, RefreshCw, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

const api = window.devignite;

// Phases: idle | available | downloading | downloaded | error
export default function UpdateModal() {
  const [phase, setPhase]           = useState('idle');
  const [updateInfo, setUpdateInfo] = useState(null);  // { currentVersion, latestVersion, downloadUrl }
  const [progress, setProgress]     = useState({ percent: 0, downloaded: 0, total: 0 });
  const [errorMsg, setErrorMsg]     = useState('');
  const filePathRef                 = useRef(null);

  useEffect(() => {
    const u1 = api.on.updateAvailable((info) => {
      setUpdateInfo(info);
      setPhase('available');
    });
    const u2 = api.on.updateProgress((data) => {
      if (data.status === 'downloading') {
        setPhase('downloading');
        setProgress({ percent: data.percent ?? 0, downloaded: data.downloaded ?? 0, total: data.total ?? 0 });
      } else if (data.status === 'downloaded') {
        setProgress(p => ({ ...p, percent: 100 }));
        setPhase('downloaded');
      } else if (data.status === 'error') {
        setErrorMsg(data.message || 'Download failed');
        setPhase('error');
      }
    });
    return () => { u1?.(); u2?.(); };
  }, []);

  const handleLater = () => {
    api.updater.later({ version: updateInfo?.latestVersion });
    setPhase('idle');
  };

  const handleUpdateNow = async () => {
    setPhase('downloading');
    setProgress({ percent: 0, downloaded: 0, total: 0 });
    const result = await api.updater.download({
      downloadUrl: updateInfo.downloadUrl,
      version: updateInfo.latestVersion,
    });
    if (result.ok) {
      filePathRef.current = result.filePath;
      setPhase('downloaded');
    } else {
      setErrorMsg(result.error || 'Download failed');
      setPhase('error');
    }
  };

  const handleInstall = () => {
    api.updater.install({ filePath: filePathRef.current });
  };

  const handleDismiss = () => setPhase('idle');

  if (phase === 'idle') return null;

  return (
    <div className="update-overlay" role="dialog" aria-modal="true" aria-label="Update Available">
      <div className="update-modal">
        {/* Header */}
        <div className="update-modal-header">
          <div className="update-modal-icon">
            {phase === 'error' ? (
              <AlertTriangle size={18} color="var(--red)" />
            ) : phase === 'downloaded' ? (
              <CheckCircle2 size={18} color="var(--green)" />
            ) : (
              <Zap size={18} color="var(--ignite)" />
            )}
          </div>
          <span className="update-modal-title">
            {phase === 'available'   && 'Update Available'}
            {phase === 'downloading' && 'Downloading Update…'}
            {phase === 'downloaded'  && 'Download Complete'}
            {phase === 'error'       && 'Update Failed'}
          </span>
          {(phase === 'available' || phase === 'error') && (
            <button className="update-close-btn" onClick={handleDismiss} title="Dismiss">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="update-modal-body">
          {phase === 'available' && (
            <>
              <div className="update-version-row">
                <div className="update-version-chip current">
                  <span className="update-version-label">Current</span>
                  <span className="update-version-value">{updateInfo?.currentVersion}</span>
                </div>
                <div className="update-arrow">→</div>
                <div className="update-version-chip latest">
                  <span className="update-version-label">Latest</span>
                  <span className="update-version-value">{updateInfo?.latestVersion}</span>
                </div>
              </div>
              <p className="update-message">
                A new version of <strong>DevIgnite</strong> is ready. Update now to get the latest improvements.
              </p>
            </>
          )}

          {phase === 'downloading' && (
            <>
              <p className="update-status-text">Downloading update…</p>
              <div className="update-progress-bar-track">
                <div
                  className="update-progress-bar-fill"
                  style={{ width: progress.percent >= 0 ? `${progress.percent}%` : '0%' }}
                />
              </div>
              <div className="update-progress-meta">
                {progress.percent >= 0 ? (
                  <span>{progress.percent}%</span>
                ) : (
                  <span>Calculating…</span>
                )}
                {progress.total > 0 && (
                  <span>{(progress.downloaded / 1048576).toFixed(1)} / {(progress.total / 1048576).toFixed(1)} MB</span>
                )}
              </div>
            </>
          )}

          {phase === 'downloaded' && (
            <>
              <p className="update-status-text success">Download completed.</p>
              <p className="update-message">
                The installer is ready. Click <strong>Install &amp; Restart</strong> to apply the update. The app will close and reopen automatically.
              </p>
            </>
          )}

          {phase === 'error' && (
            <>
              <p className="update-status-text error">Update failed.</p>
              <p className="update-message error-detail">{errorMsg}</p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="update-modal-footer">
          {phase === 'available' && (
            <>
              <button id="update-later-btn" className="btn update-btn-later" onClick={handleLater}>
                Later
              </button>
              <button id="update-now-btn" className="btn primary update-btn-now" onClick={handleUpdateNow}>
                <Download size={13} />
                Update Now
              </button>
            </>
          )}
          {phase === 'downloading' && (
            <button className="btn update-btn-later" disabled>
              <RefreshCw size={13} className="update-spin" />
              Downloading…
            </button>
          )}
          {phase === 'downloaded' && (
            <button id="install-restart-btn" className="btn primary update-btn-now" onClick={handleInstall}>
              <RefreshCw size={13} />
              Install &amp; Restart
            </button>
          )}
          {phase === 'error' && (
            <>
              <button className="btn update-btn-later" onClick={handleDismiss}>
                Dismiss
              </button>
              <button className="btn primary update-btn-now" onClick={handleUpdateNow}>
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
