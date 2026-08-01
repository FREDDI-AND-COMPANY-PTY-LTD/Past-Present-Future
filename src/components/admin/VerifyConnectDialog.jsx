import React, { useState, useEffect } from 'react';
import { X, Loader2, Check, Search, GitBranch, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Lets an admin connect a staged ancestor to existing family members and a
// branch, then promote them to admin_verified in one action. Only ancestors
// already in the archive can be selected — brand-new relatives should be added
// via "Add Ancestor" (which stages them) and then connected here.
function ExistingPicker({ label, allAncestors, excludeId, selected, onSelect }) {
  const [query, setQuery] = useState('');
  const candidates = (allAncestors || [])
    .filter(a => a.id !== excludeId)
    .filter(a => !query.trim() || (a.full_name || '').toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);
  return (
    <div>
      <label className="text-xs text-parchment/50 mb-1 block">{label}</label>
      <div className="relative mb-1.5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/30" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg pl-9 pr-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
          placeholder="Search existing ancestors..." />
      </div>
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.25)]">
          <div className="w-5 h-5 rounded-full bg-[rgba(201,145,58,0.15)] flex items-center justify-center text-[10px] text-gold">{(selected.full_name || '?').charAt(0)}</div>
          <span className="text-sm text-parchment truncate">{selected.full_name}</span>
          <button onClick={() => onSelect(null)} className="ml-auto text-parchment/40 hover:text-parchment"><X size={12} /></button>
        </div>
      ) : (
        <div className="max-h-28 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.12)] bg-[#0D0B0A]">
          {candidates.length === 0 ? <p className="text-xs text-parchment/40 px-3 py-2">No matches.</p> :
            candidates.map(a => (
              <button key={a.id} onClick={() => onSelect(a)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[rgba(201,145,58,0.06)] transition-colors">
                <div className="w-5 h-5 rounded-full bg-[rgba(201,145,58,0.1)] flex items-center justify-center text-[10px] text-gold flex-shrink-0">{(a.full_name || '?').charAt(0)}</div>
                <span className="text-sm text-parchment truncate">{a.full_name}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default function VerifyConnectDialog({ ancestor, onClose, onVerified }) {
  const [allAncestors, setAllAncestors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [father, setFather] = useState(null);
  const [mother, setMother] = useState(null);
  const [partner, setPartner] = useState(null);
  const [branchId, setBranchId] = useState(ancestor?.branch_id || '');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Ancestor.list(),
      base44.entities.Branch.list(),
    ]).then(([a, b]) => {
      setAllAncestors(a || []);
      setBranches(b || []);
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await base44.entities.Ancestor.update(ancestor.id, {
        father_id: father?.id || null,
        mother_id: mother?.id || null,
        partner_id: partner?.id || null,
        branch_id: branchId || null,
        review_status: 'admin_verified',
      });
      setDone(true);
      onVerified?.(ancestor.id);
    } catch (e) {}
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Verify & Connect</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors"><X size={20} /></button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-gold" />
            </div>
            <p className="text-parchment text-sm mb-1">{ancestor.full_name} verified & connected.</p>
            <p className="text-parchment/40 text-xs">They now appear in the family tree at the right place.</p>
          </div>
        ) : (
          <div className="p-5 space-y-3.5">
            <p className="text-xs text-parchment/50">
              Connect <span className="text-amber-light">{ancestor.full_name}</span> to their family and assign a branch, then verify them into the archive.
            </p>
            <ExistingPicker label="Father" allAncestors={allAncestors} excludeId={ancestor.id} selected={father} onSelect={setFather} />
            <ExistingPicker label="Mother" allAncestors={allAncestors} excludeId={ancestor.id} selected={mother} onSelect={setMother} />
            <ExistingPicker label="Husband / Wife" allAncestors={allAncestors} excludeId={ancestor.id} selected={partner} onSelect={setPartner} />
            <div>
              <label className="text-xs text-parchment/50 mb-1 flex items-center gap-1"><GitBranch size={11} /> Branch</label>
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]">
                <option value="">— Not assigned —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <p className="text-[11px] text-parchment/40">Only ancestors already in the archive can be selected here. To add a brand-new relative, close this and use "Add Ancestor", then return to connect them.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-[rgba(245,236,215,0.15)] text-parchment/60 text-sm hover:bg-[rgba(245,236,215,0.05)] transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Verify & Connect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}