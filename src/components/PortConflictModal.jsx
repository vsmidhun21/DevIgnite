// src/components/PortConflictModal.jsx
import { useState } from 'react';
const api = window.devignite;

export default function PortConflictModal({ conflict, onResolved, onCancel }) {
  const [loading, setLoading] = useState(false);
  const { projectId, port, pid } = conflict;

  const kill = async () => {
    setLoading(true);
    await api.ports.kill(port);
    await new Promise(r => setTimeout(r, 800));
    onResolved('killed');
  };

  const increment = () => onResolved('increment');

  return (
    <div className="modal-overlay">
      <div className="modal" style={{width:420}}>
        <div className="modal-header">
          <h3 style={{color:'var(--amber)'}}>⚠ Port conflict</h3>
        </div>
        <div className="modal-body">
          <p style={{fontSize:13,color:'var(--t1)',lineHeight:1.7}}>
            Port <strong style={{color:'var(--t0)'}}>:{port}</strong> is already in use
            {pid ? <> by process <strong style={{color:'var(--t0)'}}>PID {pid}</strong></> : ''}.
          </p>
          <p style={{fontSize:11,color:'var(--t2)',marginTop:8}}>
            How would you like to proceed?
          </p>
        </div>
        <div className="modal-actions" style={{gap:8}}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={increment}>Use next free port</button>
          <button className="btn danger" onClick={kill} disabled={loading || !pid}>
            {loading ? <span className="btn-spinner" style={{width:12,height:12,borderColor:'var(--red)',borderTopColor:'transparent'}} /> : `Kill PID ${pid}`}
          </button>
        </div>
      </div>
    </div>
  );
}
