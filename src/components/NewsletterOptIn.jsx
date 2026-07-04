import React, { useState } from 'react';
import { Mail, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function NewsletterOptIn({ user, onUpdate }) {
  const [optedIn, setOptedIn] = useState(user?.newsletter_opt_in === true);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    const newVal = !optedIn;
    try {
      await base44.auth.updateMe({ newsletter_opt_in: newVal });
      setOptedIn(newVal);
      if (onUpdate) onUpdate({ ...user, newsletter_opt_in: newVal });
    } catch (e) {
      // error
    }
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs transition-all ${
        optedIn
          ? 'bg-[rgba(201,145,58,0.08)] text-amber-light border border-[rgba(201,145,58,0.2)]'
          : 'text-parchment/50 hover:text-parchment border border-transparent'
      }`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : optedIn ? <Check size={14} className="text-gold" /> : <Mail size={14} />}
      <span>{optedIn ? 'Newsletter subscribed' : 'Subscribe to monthly newsletter'}</span>
    </button>
  );
}