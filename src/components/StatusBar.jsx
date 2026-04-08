import { useState, useEffect } from 'react';
export default function StatusBar({ message, runningCount }) {
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 8));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toTimeString().slice(0, 8)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="status-bar">
      {runningCount > 0 && <div className="status-running-dot" />}
      <span>{message}</span>
      {runningCount > 0 && <span style={{marginLeft:'auto'}}>{runningCount} running</span>}
      <span style={{marginLeft: runningCount > 0 ? 0 : 'auto'}}>{time}</span>
    </div>
  );
}
