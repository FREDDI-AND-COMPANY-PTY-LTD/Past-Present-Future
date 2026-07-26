import React, { useState, useEffect } from 'react';
import { GitBranch, X, Loader2, Check, Search, Link2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Lets a family member propose linking a relative (mother / father / partner) to
// the selected ancestor directly from the Family Tree. Existing relatives link
// via a field_change proposal (mother_id/father_id/partner_id); a new person
// becomes a relationship proposal (new_mother/new_father/new_partner) that the
// admin can approve & apply in one click via applyRelationshipProposal.
const RELATIONS = [
  { key: 'mother', label: 'Mother', field: 'mother_id', newKey: 'new_mother' },
  { key: 'father', label: 'Father', field: 'father_id', newKey: 'new_father' },
  { key: 'partner', label: 'Partner / Spouse', field: 'partner_id', newKey: 'new_partner' },
];

export default function LinkRelativeDialog({ ancestor, allAncestors, onClose, onSubmitted }) {
  const [relation, setRelation] = useState('mother');
  const [mode, setMode] = useState('existing');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState('');
  const [newBirthPlace, setNewBirthPlace] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const candidates = (allAncestors || [])
    .filter(a => a.id !== ancestor.id)
    .filter(a => !query.trim() || (a.full_name || '').toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 12);

  const rel = RELATIONS.find(r => r.key === relation);

  const handleSubmit = async () => {
    if (mode === 'existing' && !selected) return;
    if (mode === 'new' && !newName.trim()) return;
    setSubmitting(true);
    try {
      const isExisting = mode === 'existing';
      const proposed_changes = isExisting
        ? { [rel.field]: selected.id }
        : { [rel.newKey]: { full_name: newName.trim(), birth_place: newBirthPlace.trim() || undefined } };
      const target_label = isExisting ? selected.full_name : newName.trim();
      await base44.entities.Proposal.create({
        summary: `Link ${target_label} as ${rel.label.toLowerCase()} of ${ancestor.full_name}`,
        source: 'user',
        target_type: 'ancestor',
        target_id: ancestor.id,
        target_label: ancestor.full_name,
        proposal_type: isExisting ? 'field_change' : 'relationship',
        proposed_changes,
        reason: reason.trim() || 'Requested from the Family Tree.',
        status: 'pending',
        proposed_by_id: currentUser?.id || null,
        proposed_by_name: currentUser?.full_name || currentUser?.email || 'Family Member',
        action_path: `/ancestor/${ancestor.id}`,
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
            <Link2 size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Link a Relative</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors"><X size={20} /></button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-gold" />
            </div>
            <p className="text-parchment text-sm mb-1">Link request sent for approval.</p>
            <p className="text-parchment/40 text-xs">Once the admin approves it, {ancestor.full_name}'s tree will update.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-xs text-parchment/50">
              Add a relative to <span className="text-amber-light">{ancestor.full_name}</span>. This is sent to the admin for approval — the archive only changes once they confirm.
            </p>

            <div>
              <label className="text-sm text-parchment/60 mb-2 block">Relationship</label>
              <div className="grid grid-cols-3 gap-2">
                {RELATIONS.map(r => (
                  <button key={r.key} onClick={() => { setRelation(r.key); setSelected(null); }}
                    className={`px-3 py-2 rounded-lg text-sm border transition-all ${relation === r.key ? 'border-[#C9913A] bg-[rgba(201,145,58,0.1)] text-gold' : 'border-[rgba(201,145,58,0.15)] text-parchment/50 hover:border-[rgba(201,145,58,0.3)]'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-parchment/60 mb-2 block">This person is…</label>
              <div className="flex gap-2">
                <button onClick={() => setMode('existing')} className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${mode === 'existing' ? 'border-[#C9913A] bg-[rgba(201,145,58,0.1)] text-gold' : 'border-[rgba(201,145,58,0.15)] text-parchment/50 hover:border-[rgba(201,145,58,0.3)]'}`}>Already in the archive</button>
                <button onClick={() => setMode('new')} className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${mode === 'new' ? 'border-[#C9913A] bg-[rgba(201,145,58,0.1)] text-gold' : 'border-[rgba(201,145,58,0.15)] text-parchment/50 hover:border-[rgba(201,145,58,0.3)]'}`}>New to add</button>
              </div>
            </div>

            {mode === 'existing' ? (
              <div>
                <label className="text-sm text-parchment/60 mb-2 block">Select the {rel.label.toLowerCase()}</label>
                <div className="relative mb-2">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/30" />
                  <input value={query} onChange={e => setQuery(e.target.value)}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                    placeholder="Type a name..." />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A]">
                  {candidates.length === 0 ? (
                    <p className="text-xs text-parchment/40 px-4 py-3">No matching profiles.</p>
                  ) : candidates.map(a => (
                    <button key={a.id} onClick={() => setSelected(a)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${selected?.id === a.id ? 'bg-[rgba(201,145,58,0.12)]' : 'hover:bg-[rgba(201,145,58,0.05)]'}`}>
                      <div className="w-6 h-6 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-xs text-gold flex-shrink-0">{(a.full_name || '?').charAt(0)}</div>
                      <span className="text-sm text-parchment truncate">{a.full_name || 'Unnamed'}</span>
                      {selected?.id === a.id && <span className="ml-auto text-gold text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">{rel.label} — full name</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                    placeholder="e.g. Lucia Rossi" autoFocus />
                </div>
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">Birth place <span className="text-parchment/30">(optional)</span></label>
                  <input value={newBirthPlace} onChange={e => setNewBirthPlace(e.target.value)}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                    placeholder="e.g. Venice, Italy" />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm text-parchment/60 mb-2 block">Note for the admin <span className="text-parchment/30">(optional)</span></label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-parchment text-sm focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                placeholder="e.g. Confirmed by the birth certificate I hold..." />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-[rgba(245,236,215,0.15)] text-parchment/60 text-sm hover:bg-[rgba(245,236,215,0.05)] transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting || (mode === 'existing' ? !selected : !newName.trim())}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                Send Link Request
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}