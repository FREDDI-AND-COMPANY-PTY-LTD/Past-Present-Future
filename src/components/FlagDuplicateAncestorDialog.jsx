import React, { useState, useEffect } from 'react';
import { GitMerge, X, Loader2, Check, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Lets a family member formally request consolidation of two ancestor profiles.
 * Creates a ConflictFlag with flag_type 'duplicate_ancestor', which surfaces in
 * the Admin Ancestor Merge Review queue for the admin to approve & merge.
 */
export default function FlagDuplicateAncestorDialog({ ancestor, allAncestors, onClose, onSubmitted }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const candidates = (allAncestors || [])
    .filter(a => a.id !== ancestor.id)
    .filter(a => !query.trim() || (a.full_name || '').toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 12);

  const handleSubmit = async () => {
    if (!selected || !reason.trim()) return;
    setSubmitting(true);
    try {
      await base44.entities.ConflictFlag.create({
        dispute_description: reason.trim(),
        status: 'open',
        flag_type: 'duplicate_ancestor',
        field_name: 'duplicate_profile',
        ancestor_id: ancestor.id,
        duplicate_of_ancestor_id: selected.id,
        duplicate_of_ancestor_name: selected.full_name,
        raised_by_id: currentUser?.id || null,
        raised_by_name: currentUser?.full_name || currentUser?.email || 'Family Member',
        bloodline: ancestor.bloodline || '',
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch (e) {}
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
          <div className="flex items-center gap-2">
            <GitMerge size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Flag as Duplicate</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors"><X size={20} /></button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-gold" />
            </div>
            <p className="text-parchment text-sm mb-1">Duplicate request submitted for review.</p>
            <p className="text-parchment/40 text-xs">The Admin will review both profiles and consolidate them into one.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-xs text-parchment/50">
              You believe <span className="text-amber-light">{ancestor.full_name}</span> is the same person as another profile in the archive. Select the duplicate below and explain — an admin will merge the two profiles into one.
            </p>

            <div>
              <label className="text-sm text-parchment/60 mb-2 block">Search for the duplicate profile</label>
              <div className="relative mb-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/30" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                  placeholder="Type a name..." />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A]">
                {candidates.length === 0 ? (
                  <p className="text-xs text-parchment/40 px-4 py-3">No matching profiles.</p>
                ) : candidates.map(a => (
                  <button key={a.id} onClick={() => setSelected(a)}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${selected?.id === a.id ? 'bg-[rgba(201,145,58,0.12)]' : 'hover:bg-[rgba(201,145,58,0.05)]'}`}>
                    <div className="w-6 h-6 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-xs text-gold flex-shrink-0">{(a.full_name || '?').charAt(0)}</div>
                    <span className="text-sm text-parchment truncate">{a.full_name || 'Unnamed'}</span>
                    {a.birth_date && <span className="text-xs text-parchment/40 flex-shrink-0">b. {new Date(a.birth_date).getFullYear()}</span>}
                    {selected?.id === a.id && <span className="ml-auto text-gold text-xs">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-parchment/60 mb-2 block">Why are these the same person?</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-parchment text-sm focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                placeholder="e.g. Both profiles have the same birth date and parents, just a different spelling of the surname..." />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-[rgba(245,236,215,0.15)] text-parchment/60 text-sm hover:bg-[rgba(245,236,215,0.05)] transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={!selected || !reason.trim() || submitting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <GitMerge size={16} />}
                Submit Duplicate Request
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}