import React, { useState } from 'react';
import { Crown, Loader2, Check, X, ArrowUpCircle, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Compute the senior living male ancestors in the bloodline who have registered
 * accounts and sit above the current admin on the paternal chain — the natural
 * successors to the branch admin role (eldest male protects the archive).
 */
function computeCandidates(branch, allAncestors, user) {
  const list = allAncestors || [];
  let node = list.find(a => a.user_account_id && a.user_account_id === user.id);
  if (!node) node = list.find(a => a.id === branch.ancestor_id);
  if (!node) return [];
  const chain = [];
  const seen = new Set();
  let cur = node;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur);
    if (!cur.father_id) break;
    cur = list.find(a => a.id === cur.father_id);
  }
  // chain[0] is the admin's own node; candidates are senior (later in array), living, male/unknown-sex, registered, not self
  return chain.filter(a =>
    a.id !== node.id &&
    a.user_account_id &&
    a.user_account_id !== user.id &&
    a.living !== false &&
    (!a.sex || a.sex === 'male')
  );
}

export default function BranchAdminSuccession({ branches, allAncestors, user, onChanged }) {
  const [openFor, setOpenFor] = useState(null); // branchId currently proposing
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const withCandidates = (branches || []).map(b => ({
    branch: b,
    candidates: computeCandidates(b, allAncestors, user),
  })).filter(x => x.candidates.length > 0 || (x.branch.transfer_request && x.branch.transfer_request.status === 'pending'));

  if (withCandidates.length === 0) return null;

  const active = withCandidates.find(x => x.branch.id === openFor);

  const sendProposal = async (branch, ancestor) => {
    setBusy(true); setError('');
    try {
      const res = await base44.functions.invoke('requestBranchAdminTransfer', {
        branch_id: branch.id,
        to_ancestor_id: ancestor.id,
        app_url: window.location.origin,
        message: message.trim(),
      });
      if (res?.data?.error) throw new Error(res.data.error);
      setConfirm(false); setOpenFor(null); setMessage('');
      onChanged?.();
    } catch (e) {
      setError(e.message || 'Failed to send the transfer invitation');
    }
    setBusy(false);
  };

  return (
    <div className="mt-8">
      <h2 className="font-display text-xl text-parchment mb-1 flex items-center gap-2">
        <Crown size={18} className="text-gold" /> Succession
      </h2>
      <p className="text-xs text-parchment/40 mb-4 max-w-2xl leading-relaxed">
        The first member to register holds the Branch Admin role as a placeholder. By principle, the role naturally
        devolves upon the eldest living male in the bloodline. When a senior member registers, you may propose to
        transfer the role to them — they'll receive an email with the responsibilities and an option to accept.
      </p>

      <div className="space-y-3">
        {withCandidates.map(({ branch, candidates }) => {
          const tr = branch.transfer_request;
          const pending = tr && tr.status === 'pending';
          return (
            <div key={branch.id} className="aged-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-sm text-parchment font-medium">{branch.name}</span>
                {pending && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.12)] text-amber-light border border-[rgba(201,145,58,0.25)] flex items-center gap-1">
                    <Loader2 size={9} className="animate-spin" /> Transfer pending — awaiting {tr.to_ancestor_name}'s acceptance
                  </span>
                )}
              </div>

              {pending ? (
                <div className="flex items-start gap-2 text-xs text-parchment/50">
                  <Info size={13} className="text-amber-light mt-0.5 flex-shrink-0" />
                  <p>
                    You've invited <span className="text-amber-light">{tr.to_ancestor_name}</span> to become Branch Admin.
                    The invitation email includes the role's responsibilities and a link to accept in the archive.
                    They can also decline, leaving you as admin.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {candidates.map(a => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-[rgba(201,145,58,0.04)] border border-[rgba(201,145,58,0.1)] flex-wrap">
                      <ArrowUpCircle size={16} className="text-gold flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-parchment truncate">{a.full_name}</p>
                        <p className="text-xs text-parchment/40">
                          {a.living === false ? 'deceased' : 'living'}{a.sex ? ` · ${a.sex}` : ''}{a.birth_date ? ` · b. ${a.birth_date}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => { setOpenFor(branch.id); setConfirm(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.08)] transition-colors flex-shrink-0"
                      >
                        <Crown size={12} /> Propose as Branch Admin
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      {active && confirm && (() => {
        const branch = active.branch;
        const ancestor = active.candidates[0];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={() => !busy && setConfirm(false)}>
            <div className="aged-card rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)]">
                <div className="flex items-center gap-2">
                  <Crown size={18} className="text-gold" />
                  <h3 className="font-display text-lg text-parchment">Transfer Branch Admin</h3>
                </div>
                <button onClick={() => !busy && setConfirm(false)} className="text-parchment/40 hover:text-parchment transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-parchment/70 leading-relaxed">
                  Propose <span className="text-amber-light font-medium">{ancestor?.full_name}</span> as the new Branch
                  Admin of <span className="text-amber-light font-medium">{branch.name}</span>. They'll receive an email
                  explaining the role's responsibilities, with an option to accept or decline.
                </p>
                <label className="flex items-start gap-2 text-sm text-parchment/60">
                  <input type="checkbox" defaultChecked disabled className="mt-1 accent-[#C9913A]" />
                  <span>Transfer branch admin to this elder ancestor (eldest male protects the archive)</span>
                </label>
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Optional message to include in the email</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={3}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] resize-none"
                    placeholder="e.g. As the senior male of our line, this role rightly belongs to you…"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
              </div>
              <div className="px-5 py-4 border-t border-[rgba(201,145,58,0.2)] flex items-center justify-end gap-2">
                <button onClick={() => !busy && setConfirm(false)} className="px-4 py-2 rounded-lg text-sm text-parchment/60 border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.05)] transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => sendProposal(branch, ancestor)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}