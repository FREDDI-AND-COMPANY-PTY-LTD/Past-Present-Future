import React, { useState } from 'react';
import { Loader2, Newspaper } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Per-branch newsletter cadence toggle for the branch admin.
// Checked = weekly, unchecked = monthly. Persists to the Branch record.
export default function BranchNewsletterFrequency({ branch, onUpdate }) {
  const [freq, setFreq] = useState(branch?.newsletter_frequency || 'monthly');
  const [saving, setSaving] = useState(false);
  const isWeekly = freq === 'weekly';

  const toggle = async () => {
    const next = isWeekly ? 'monthly' : 'weekly';
    setSaving(true);
    try {
      const updated = await base44.entities.Branch.update(branch.id, { newsletter_frequency: next });
      setFreq(next);
      if (onUpdate) onUpdate(updated);
    } catch (e) {}
    setSaving(false);
  };

  return (
    <div className="aged-card rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.15)] flex items-center justify-center flex-shrink-0">
        <Newspaper size={18} className="text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-parchment font-medium">{branch.name} Chronicle</p>
        <p className="text-xs text-parchment/50">How often this branch's newsletter is generated.</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-parchment/70 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isWeekly}
          onChange={toggle}
          disabled={saving}
          className="accent-[#C9913A]"
        />
        {saving ? <Loader2 size={14} className="animate-spin" /> : <span className={isWeekly ? 'text-amber-light font-medium' : ''}>{isWeekly ? 'Weekly' : 'Monthly'}</span>}
      </label>
    </div>
  );
}