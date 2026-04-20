import React, { useState, useEffect } from 'react';
import { Heart, Star, Coffee, X } from 'lucide-react';

const api = window.devignite;

export default function SponsorshipPopup() {
  const [settings, setSettings] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.settings.get();
      setSettings(data);
      
      // Eligibility check
      // 1. Not already dismissed or supported
      if (data.sponsorship_status === 'dismissed' || data.sponsorship_status === 'supported') {
        return;
      }

      // 2. Thresholds: 3rd app launch AND 3rd project launch
      if (data.launch_count >= 3 && data.project_launch_count >= 3) {
        // 3. If "later", wait for 5 sessions
        if (data.sponsorship_status === 'later' && data.session_count_since_later < 5) {
          return;
        }
        setVisible(true);
      }
    } catch (err) {
      console.error('Failed to load app settings', err);
    }
  };

  const handleAction = async (status, url = null) => {
    setVisible(false);
    await api.settings.update(status);
    if (url) window.open(url, '_blank');
  };

  if (!visible) return null;

  return (
    <div className="sponsorship-toast">
      <div className="sponsorship-content">
        <div className="sponsorship-icon">
          <Heart size={18} fill="var(--ignite)" stroke="var(--ignite)" />
        </div>
        <div className="sponsorship-text">
          <p>Enjoying <strong>DevIgnite</strong>? Support the project (optional)</p>
        </div>
        <div className="sponsorship-actions">
          <button className="btn-support" onClick={() => handleAction('supported', 'https://buymeacoffee.com/midhun.v.s')}>
            <Coffee size={14} /> Support
          </button>
          <button className="btn-star" onClick={() => handleAction('supported', 'https://github.com/vsmidhun21/DevIgnite')}>
            <Star size={14} /> Star on GitHub
          </button>
          <button className="btn-later" onClick={() => handleAction('later')}>
            Later
          </button>
          <button className="btn-dismiss" onClick={() => handleAction('dismissed')} title="Don't show again">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
