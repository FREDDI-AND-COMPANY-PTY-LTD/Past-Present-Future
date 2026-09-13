import React, { useState, useEffect } from 'react';
import { Loader2, GitBranch, Sparkles, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput';

function ParentSelector({ label, value, onChange, branchAncestors, excludeId }) {
  const setMode = (mode) => onChange({ mode, ...(mode === 'new' ? { full_name: '', birth_place: '' } : {}) });
  return (
    <div className="rounded-lg bg-[rgba(201,145,58,0.04)] border border-[rgba(201,145,58,0.12)] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-amber-light font-medium">{label}</span>
        <div className="flex gap-1">
          {['none', 'existing', 'new'].map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                value.mode === m
                  ? 'bg-[rgba(201,145,58,0.2)] text-gold border border-[rgba(201,145,58,0.4)]'
                  : 'text-parchment/50 border border-transparent hover:text-amber-light'
              }`}>
              {m === 'none' ? 'None' : m === 'existing' ? 'In tree' : 'Add new'}
            </button>
          ))}
        </div>
      </div>
      {value.mode === 'existing' && (
        <select
          value={value.ancestor_id || ''}
          onChange={e => onChange({ mode: 'existing', ancestor_id: e.target.value })}
          className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
        >
          <option value="">Select {label.toLowerCase()}...</option>
          {branchAncestors.filter(a => a.id !== excludeId).map(a => (
            <option key={a.id} value={a.id}>{a.full_name}</option>
          ))}
        </select>
      )}
      {value.mode === 'new' && (
        <div className="space-y-2">
          <input
            value={value.full_name || ''}
            onChange={e => onChange({ ...value, full_name: e.target.value })}
            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
            placeholder={`${label}'s full name`}
          />
          <LocationAutocompleteInput
            value={value.birth_place || ''}
            onChange={({ location_name }) => onChange({ ...value, birth_place: location_name })}
            placeholder={`${label}'s birth place (optional)`}
            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
          />
        </div>
      )}
      {value.mode === 'none' && <p className="text-[11px] text-parchment/40">No {label.toLowerCase()} link for this branch.</p>}
    </div>
  );
}

export default function BranchNominationStep({ user, myAncestorId, invite, onCompleted }) {
  const [branch, setBranch] = useState(null);
  const [branchAncestors, setBranchAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mother, setMother] = useState({ mode: 'none' });
  const [father, setFather] = useState({ mode: 'none' });
  const [sex, setSex] = useState(null);
  const [description, setDescription] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const brs = await base44.entities.Branch.filter({ id: invite.branch_id });
        const br = (brs || [])[0];
        setBranch(br);
        const all = await base44.entities.Ancestor.list();
        const rootId = br?.ancestor_id;
        // Branch ancestors = those tagged to this branch, plus all descendants of the branch root
        const descIds = new Set(rootId ? [rootId] : []);
        let changed = true;
        while (changed) {
          changed = false;
          for (const a of all) {
            if (descIds.has(a.id)) continue;
            if ((a.mother_id && descIds.has(a.mother_id)) || (a.father_id && descIds.has(a.father_id))) {
              descIds.add(a.id); changed = true;
            }
          }
        }
        const ba = (all || []).filter(a => (a.branch_id && a.branch_id === invite.branch_id) || descIds.has(a.id));
        setBranchAncestors(ba);
      } catch (e) {}
      setLoading(false);
    })();
  }, [invite.branch_id]);

  const canSubmit = (mother.mode !== 'none' || father.mode !== 'none') && sex;

  const handleSubmit = async () => {
    if (!sex) { setError('Select whether you are a son or daughter of this branch.'); return; }
    if (!canSubmit) { setError('Nominate at least one mother or father link to connect you to the branch.'); return; }
    setSubmitting(true); setError('');
    try {
      const newAncestorIds = [];
      const links = {};

      if (mother.mode === 'existing' && mother.ancestor_id) {
        links.mother_id = mother.ancestor_id;
      } else if (mother.mode === 'new' && mother.full_name?.trim()) {
        const m = await base44.entities.Ancestor.create({
          full_name: mother.full_name.trim(),
          sex: 'female',
          birth_place: mother.birth_place || null,
          living: false,
          review_status: 'staged',
          branch_id: invite.branch_id,
          created_by_id: user.id,
          created_by_name: user?.full_name || null,
        });
        newAncestorIds.push(m.id);
        links.mother_id = m.id;
      }

      if (father.mode === 'existing' && father.ancestor_id) {
        links.father_id = father.ancestor_id;
      } else if (father.mode === 'new' && father.full_name?.trim()) {
        const f = await base44.entities.Ancestor.create({
          full_name: father.full_name.trim(),
          sex: 'male',
          birth_place: father.birth_place || null,
          living: false,
          review_status: 'staged',
          branch_id: invite.branch_id,
          created_by_id: user.id,
          created_by_name: user?.full_name || null,
        });
        newAncestorIds.push(f.id);
        links.father_id = f.id;
      }

      // Tag the nominee's own ancestor to the branch and link the parents
      if (myAncestorId) {
        await base44.entities.Ancestor.update(myAncestorId, {
          branch_id: invite.branch_id,
          sex,
          ...(links.mother_id ? { mother_id: links.mother_id } : {}),
          ...(links.father_id ? { father_id: links.father_id } : {}),
        });
      }

      await base44.entities.BranchInvite.update(invite.id, {
        status: 'nominated',
        registered_user_id: user.id,
        registered_ancestor_id: myAncestorId,
        nomination: { description: description.trim(), mother, father },
        new_ancestor_ids: newAncestorIds,
      });

      onCompleted();
    } catch (e) {
      setError(e.message || 'Failed to submit nomination');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <Loader2 className="text-gold animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] mb-3">
            <GitBranch size={26} className="text-gold" />
          </div>
          <h1 className="font-display text-3xl text-parchment">Join the {branch?.name || 'Branch'}</h1>
          <p className="text-parchment/50 text-sm mt-2 max-w-md mx-auto leading-relaxed">
            You've been invited to this branch by {invite.invited_by_name || 'the branch admin'}. Nominate how you connect to the branch's tree so it can be added for their approval.
          </p>
        </div>

        <div className="aged-card rounded-2xl overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs text-parchment/50">
              <User size={13} className="text-gold/60" />
              Registered as <span className="text-amber-light">{user?.full_name || user?.email}</span>
            </div>

            <div>
              <label className="text-xs text-parchment/50 mb-2 block">You are a…</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSex('male')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    sex === 'male'
                      ? 'bg-[rgba(201,145,58,0.15)] border-[#C9913A] text-gold'
                      : 'bg-[#0D0B0A] border-[rgba(201,145,58,0.15)] text-parchment/50 hover:border-[rgba(201,145,58,0.3)]'
                  }`}
                >
                  Son
                </button>
                <button
                  type="button"
                  onClick={() => setSex('female')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    sex === 'female'
                      ? 'bg-[rgba(201,145,58,0.15)] border-[#C9913A] text-gold'
                      : 'bg-[#0D0B0A] border-[rgba(201,145,58,0.15)] text-parchment/50 hover:border-[rgba(201,145,58,0.3)]'
                  }`}
                >
                  Daughter
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-parchment/50 mb-2 block">How do you connect to this branch?</label>
              <div className="space-y-2.5">
                <ParentSelector label="Mother" value={mother} onChange={setMother} branchAncestors={branchAncestors} excludeId={myAncestorId} />
                <ParentSelector label="Father" value={father} onChange={setFather} branchAncestors={branchAncestors} excludeId={myAncestorId} />
              </div>
              <p className="text-[11px] text-parchment/40 mt-2">
                Choose "In tree" if your mother or father is already in the branch. Choose "Add new" to add a mother or father not yet recorded — they'll be added as placeholders pending the branch admin's approval.
              </p>
            </div>

            <div>
              <label className="text-xs text-parchment/50 mb-1 block">Relationship notes (optional)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                placeholder="e.g. Pamela Kay Lewis is my grandmother on my mother's side..."
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-[rgba(201,145,58,0.2)] flex items-center justify-end gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              Submit for Approval
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-parchment/30 mt-4">Your nomination will be reviewed by the branch admin before it's added to the tree.</p>
      </div>
    </div>
  );
}