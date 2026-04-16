import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

const api = window.devignite;

export default function PortConflictModal({ conflict, onResolved, onCancel }) {
  const [loading, setLoading] = useState(false);
  const { port, pid } = conflict;

  const kill = async () => {
    setLoading(true);
    await api.ports.kill(port);
    await new Promise(r => setTimeout(r, 800));
    onResolved('killed');
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 420 }}>
        <div className="modal-header">
          <h3 className="port-conflict-title">
            <AlertTriangle size={15} strokeWidth={2} style={{ color: 'var(--amber)', flexShrink: 0 }}/>
            Port conflict
          </h3>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.7 }}>
            Port <strong style={{ color: 'var(--t0)', fontFamily: 'var(--font)' }}>:{port}</strong> is already in use
            {pid ? <> by <strong style={{ color: 'var(--t0)' }}>PID {pid}</strong></> : ''}.
          </p>
          <p style={{ fontSize: 11, color: 'var(--t2)', marginTop: 6 }}>
            Choose how to proceed:
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={() => onResolved('increment')}>Use next free port</button>
          <button className="btn danger" onClick={kill} disabled={loading || !pid}>
            {loading
              ? <Loader2 size={12} strokeWidth={2} className="spin"/>
              : `Kill PID ${pid}`}
          </button>
        </div>
      </div>
    </div>
  );
}
