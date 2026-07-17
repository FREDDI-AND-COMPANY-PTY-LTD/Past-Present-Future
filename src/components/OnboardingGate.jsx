import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import OnboardingPage from '@/pages/OnboardingPage';

export default function OnboardingGate({ user, children }) {
  const [status, setStatus] = useState('checking'); // checking | onboard | ok

  useEffect(() => {
    let cancelled = false;
    if (!user) { setStatus('ok'); return; }
    (async () => {
      try {
        const all = await base44.entities.Ancestor.list();
        const mine = (all || []).find(a => a.user_account_id === user.id);
        if (cancelled) return;
        setStatus(mine ? 'ok' : 'onboard');
      } catch {
        if (!cancelled) setStatus('onboard');
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (user && status === 'checking') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0D0B0A]">
        <div className="w-8 h-8 border-4 border-[rgba(201,145,58,0.2)] border-t-[#C9913A] rounded-full animate-spin" />
      </div>
    );
  }

  if (user && status === 'onboard') {
    return <OnboardingPage user={user} onCompleted={() => { setStatus('ok'); window.location.href = '/'; }} />;
  }

  return children;
}