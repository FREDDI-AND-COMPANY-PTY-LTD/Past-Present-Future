import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, HelpCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function UploadHelperBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!user || cancelled) return;

        const sessionKey = `login_count_session_${user.id}`;
        const alreadyCounted = sessionStorage.getItem(sessionKey) === 'true';

        // Increment persisted login_count once per browser session
        let loginCount = user.login_count ?? 0;
        if (!alreadyCounted) {
          loginCount = loginCount + 1;
          sessionStorage.setItem(sessionKey, 'true');
          await base44.auth.updateMe({ login_count: loginCount }).catch(() => {});
        }

        const dismissedKey = `upload_helper_dismissed_${user.id}`;
        const wasDismissed = localStorage.getItem(dismissedKey) === 'true';

        if (!cancelled && loginCount <= 3 && !wasDismissed) {
          setVisible(true);
        }
      } catch {
        // not logged in — don't show
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDismiss = async () => {
    setDismissed(true);
    setVisible(false);
    try {
      const user = await base44.auth.me();
      if (user) {
        localStorage.setItem(`upload_helper_dismissed_${user.id}`, 'true');
      }
    } catch {}
  };

  if (!visible || dismissed) return null;

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal flash-pulse">
      <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-center gap-3 relative">
        <HelpCircle size={18} className="flex-shrink-0" />
        <button
          onClick={() => navigate('/upload')}
          className="flex items-center gap-2 text-sm font-semibold hover:underline"
        >
          <Upload size={16} />
          How to Upload Your History
        </button>
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal/60 hover:text-charcoal transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}