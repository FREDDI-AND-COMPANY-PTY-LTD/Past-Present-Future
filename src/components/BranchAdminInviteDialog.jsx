import React, { useState } from 'react';
import { X, UserPlus, Loader2, CheckCircle2, Mail, GitBranch } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BranchAdminInviteDialog({ open, onClose, branches, user }) {
  const [branchId, setBranchId] = useState(branches?.[0]?.id || '');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!open) return null;

  const branch = (branches || []).find(b => b.id === branchId);

  const handleClose = () => {
    setEmail(''); setError(''); setSuccess('');
    setBranchId(branches?.[0]?.id || '');
    onClose();
  };

  const handleSend = async () => {
    if (!branchId) { setError('Select a branch'); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('A valid email is required'); return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      // 1. Record the branch invitation (pending) — the nomination step activates on registration
      await base44.entities.BranchInvite.create({
        branch_id: branchId,
        branch_name: branch?.name || '',
        invitee_email: email.trim().toLowerCase(),
        invited_by_id: user?.id || null,
        invited_by_name: user?.full_name || null,
        status: 'pending',
      });

      // 2. Issue the platform account invitation (best effort — may require global-admin role)
      let accountInvited = true;
      try {
        await base44.users.inviteUser(email.trim(), 'user');
      } catch (e) {
        accountInvited = false;
      }

      setSuccess(
        `Invitation recorded for ${email.trim()}.` +
        (accountInvited
          ? ` When they register, they'll be prompted to nominate their relationship to the ${branch?.name} branch for your approval.`
          : ` Note: the platform account invite could not be sent automatically — please ask the global admin to invite ${email.trim()}, after which this branch nomination will activate.`)
      );
      setEmail('');
    } catch (e) {
      setError(e.message || 'Failed to send invitation');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={handleClose}>
      <div className="aged-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Invite to Your Branch</h3>
          </div>
          <button onClick={handleClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
            <p className="text-parchment text-sm leading-relaxed">{success}</p>
            <button onClick={handleClose} className="mt-5 px-4 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <p className="text-xs text-parchment/50 leading-relaxed">
                Invite a family member to your branch. Once they register, they'll nominate how they connect to your branch's tree — adding any missing ancestors as placeholders for your approval before they're integrated.
              </p>

              {(branches || []).length > 1 && (
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1">
                    <GitBranch size={12} /> Branch <span className="text-[#C9913A]">*</span>
                  </label>
                  <select
                    value={branchId}
                    onChange={e => setBranchId(e.target.value)}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  >
                    {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1">
                  <Mail size={12} /> Email Address <span className="text-[#C9913A]">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="family.member@example.com"
                  autoFocus
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="px-5 py-4 border-t border-[rgba(201,145,58,0.2)] flex items-center justify-end gap-2 sticky bottom-0 bg-[#1A1614]">
              <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm text-parchment/50 border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.05)] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={saving || !branchId || !email.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Send Invitation
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}