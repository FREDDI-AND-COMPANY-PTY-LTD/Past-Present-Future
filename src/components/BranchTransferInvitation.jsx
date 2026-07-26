import React, { useState } from 'react';
import { Crown, Check, X, Loader2, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Banner shown to a registered member who has been invited to take over as
 * Branch Admin of a branch (branch.transfer_request.to_user_id === user.id,
 * status 'pending'). Renders accept / decline controls wired to the
 * respondBranchAdminTransfer backend function.
 */
export default function BranchTransferInvitation({ branches, user, onResponded }) {
  const [busy, setBusy] = useState(null); // branchId being actioned
  const [error, setError] = useState('');

  const invitations = (branches || []).filter(b => {
    const tr = b.transfer_request;
    return tr && tr.status === 'pending' && tr.to_user_id && tr.to_user_id === user?.id;
  });

  if (invitations.length === 0) return null;

  const respond = async (branch, action) => {
    setBusy(branch.id); setError('');
    try {
      const res = await base44.functions.invoke('respondBranchAdminTransfer', {
        branch_id: branch.id,
        action,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      onResponded?.();
    } catch (e) {
      setError(e.message || 'Failed to respond');
    }
    setBusy(null);
  };

  return (
    <div className="px-4 lg:px-6 pt-4">
      <div className="max-w-4xl mx-auto space-y-3">
        {invitations.map(b => {
          const tr = b.transfer_request;
          return (
            <div key={b.id} className="aged-card rounded-xl p-4 border-[rgba(201,145,58,0.35)]">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-lg bg-[rgba(201,145,58,0.12)] border border-[rgba(201,145,58,0.25)] flex items-center justify-center flex-shrink-0">
                  <Crown size={18} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-parchment">
                    <span className="text-amber-light font-medium">{tr.from_user_name}</span> has invited you to become
                    the Branch Admin of <span className="text-amber-light font-medium">{b.name}</span>.
                  </p>
                  <p className="text-xs text-parchment/50 mt-1">
                    By the principle that the eldest male in the line protects the archive, this role naturally belongs
                    to you. {tr.from_user_name} has held it as a placeholder since they first registered.
                  </p>
                  {tr.message && (
                    <div className="mt-2 p-2.5 rounded-lg bg-[rgba(201,145,58,0.06)] border-l-2 border-[#C9913A] text-xs text-parchment/70 italic">
                      "{tr.message}"
                    </div>
                  )}
                  {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => respond(b, 'decline')}
                    disabled={busy === b.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-parchment/60 border border-[rgba(245,236,215,0.12)] hover:bg-[rgba(245,236,215,0.05)] transition-colors disabled:opacity-50"
                  >
                    {busy === b.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                    Decline
                  </button>
                  <button
                    onClick={() => respond(b, 'accept')}
                    disabled={busy === b.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {busy === b.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Accept Role
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}