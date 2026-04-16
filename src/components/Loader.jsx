import { useEffect, useState } from 'react';

export default function Loader({ visible }) {
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => setOut(true), 400);
      return () => clearTimeout(t);
    }
    setOut(false);
  }, [visible]);

  if (out) return null;

  return (
    <div className={`loader-overlay ${!visible ? 'loader-fade' : ''}`}>
      <div className="loader-content">
        <div className="loader-logo">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
              fill="var(--ignite)" stroke="var(--ignite)" strokeWidth="1.5"
              strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="loader-name">DevIgnite</div>
        <div className="loader-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}
