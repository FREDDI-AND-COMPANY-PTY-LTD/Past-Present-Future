import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, Loader2, Check, X, GitBranch, Mail, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import BranchAdminInviteDialog from '@/components/BranchAdminInviteDialog';

const statusBadge = {
  pending: 'bg-[rgba(201,145,58,0.1)] text-amber-light border-[rgba(201,145,58,0.25)]',
  nominated: 'bg-blue-900/20 text-blue-300 border-blue-800/30',
  approved: 'bg-green-900/20 text-green-400 border-green-800/30',
  declined: 'bg-[rgba(245,236,215,0.05)] text-parchment/50 border-[rgba(245,236,215,0.1)]',
  blocked: 'bg-red-900/20 text-red-400 border-red-800/30',
};

export default function BranchAdminDashboard() {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [allAncestors, setAllAncestors] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});

  const load = async () => {
    try {
      const [u, brs, anc, allInvites] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.Branch.list(),
        base44.entities.Ancestor.list(),
        base44.entities.BranchInvite.list('-created_date', 200),
      ]);
      setUser(u);
      setBranches(brs || []);
      setAllAncestors(anc || []);
      const myBranchIds = (brs || []).filter(b => b.admin_user_id && u && b.admin_user_id === u.id).map(b => b.id);
      setInvites((allInvites || []).filter(i => myBranchIds.includes(i.branch_id)));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const myBranches = (branches || []).filter(b => b.admin_user_id && user && b.admin_user_id === user.id);
  const nominations = invites.filter(i => i.status === 'nominated');
  const others = invites.filter(i => i.status !== 'nominated');

  const ancestorName = (id) => {
    if (!id) return '—';
    const a = (allAncestors || []).find(x => x.id === id);
    return a?.full_name || 'Unknown';
  };

  const handleApprove = async (inv) => {
    setBusy(inv.id);
    try {
      // Integrate the nominee's staged ancestors into the tree
      for (const id of (inv.new_ancestor_ids || [])) {
        try { await base44.entities.Ancestor.update(id, { review_status: 'auto_approved' }); } catch (e) {}
      }
      // Ensure the nominee's own ancestor is integrated too
      if (inv.registered_ancestor_id) {
        try { await base44.entities.Ancestor.update(inv.registered_ancestor_id, { review_status: 'auto_approved' }); } catch (e) {}
      }
      await base44.entities.BranchInvite.update(inv.id, {
        status: 'approved',
        reviewed_by_id: user.id,
        reviewed_by_name: user?.full_name,
        review_note: (notes[inv.id] || '').trim(),
      });
      load();
    } catch (e) {}
    setBusy(null);
  };

  const handleDecline = async (inv) => {
    setBusy(inv.id);
    try {
      await base44.entities.BranchInvite.update(inv.id, {
        status: 'declined',
        reviewed_by_id: user.id,
        reviewed_by_name: user?.full_name,
        review_note: (notes[inv.id] || '').trim(),
      });
      load();
    } catch (e) {}
    setBusy(null);
  };

  const handleBlock = async (inv) => {
    setBusy(inv.id);
    try {
      await base44.entities.BranchInvite.update(inv.id, {
        status: 'blocked',
        reviewed_by_id: user.id,
        reviewed_by_name: user?.full_name,
      });
      load();
    } catch (e) {}
    setBusy(null);
  };

  if (loading) {
    return <Layout><div className="flex justify-center py-12"><Loader2 size={24} className="text-gold animate-spin" /></div></Layout>;
  }

  if (myBranches.length === 0) {
    return (
      <Layout>
        <div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto">
          <div className="aged-card rounded-xl p-12 text-center">
            <Shield size={32} className="text-gold/30 mx-auto mb-3" />
            <p className="text-parchment/50">You are not the admin of any branch.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center">
              <GitBranch size={22} className="text-gold" />
            </div>
            <div>
              <h1 className="font-display text-3xl text-parchment">Branch Admin</h1>
              <p className="text-parchment/50 text-sm">You are the sole authority over: {myBranches.map(b => b.name).join(', ')}</p>
            </div>
          </div>
          <button onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
            <UserPlus size={15} /> Invite to Branch
          </button>
        </div>

        {/* Nominations awaiting review */}
        <div className="mt-8">
          <h2 className="font-display text-xl text-parchment mb-4 flex items-center gap-2">
            <Clock size={18} className="text-gold" /> Nominations Awaiting Your Approval
            {nominations.length > 0 && <span className="px-2 py-0.5 rounded-full bg-[#8B6914] text-amber-light text-xs">{nominations.length}</span>}
          </h2>

          {nominations.length === 0 ? (
            <div className="aged-card rounded-xl p-10 text-center">
              <p className="text-parchment/50">No nominations awaiting review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {nominations.map(inv => {
                const nom = inv.nomination || {};
                const newCount = (inv.new_ancestor_ids || []).length;
                return (
                  <div key={inv.id} className="aged-card rounded-xl p-5">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <Mail size={15} className="text-amber-light" />
                      <span className="text-sm text-parchment font-medium">{inv.invitee_email}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge[inv.status]}`}>{inv.status}</span>
                      <span className="text-xs text-parchment/40">· {inv.branch_name}</span>
                      <span className="text-xs text-parchment/40 ml-auto">{inv.created_date ? new Date(inv.created_date).toLocaleDateString('en-AU') : ''}</span>
                    </div>

                    <div className="text-xs text-parchment/50 space-y-1 mb-3">
                      <div>Registered as: <span className="text-amber-light">{ancestorName(inv.registered_ancestor_id)}</span></div>
                      <div>Mother link: <span className="text-parchment/70">{nom.mother?.mode === 'existing' ? ancestorName(nom.mother?.ancestor_id) : nom.mother?.mode === 'new' ? `${nom.mother?.full_name} (new — pending)` : 'none'}</span></div>
                      <div>Father link: <span className="text-parchment/70">{nom.father?.mode === 'existing' ? ancestorName(nom.father?.ancestor_id) : nom.father?.mode === 'new' ? `${nom.father?.full_name} (new — pending)` : 'none'}</span></div>
                      {newCount > 0 && <div>New ancestors to add: <span className="text-amber-light">{newCount} placeholder{newCount > 1 ? 's' : ''}</span></div>}
                      {nom.description && <div className="text-parchment/60 italic mt-1">"{nom.description}"</div>}
                    </div>

                    <div className="pt-3 border-t border-[rgba(201,145,58,0.12)] space-y-3">
                      <input
                        value={notes[inv.id] || ''}
                        onChange={e => setNotes(prev => ({ ...prev, [inv.id]: e.target.value }))}
                        placeholder="Review note (optional)..."
                        className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded-lg px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleApprove(inv)} disabled={busy === inv.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors disabled:opacity-50">
                          {busy === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve & Grant Access
                        </button>
                        <button onClick={() => handleDecline(inv)} disabled={busy === inv.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(245,236,215,0.05)] text-parchment/60 text-xs border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.08)] transition-colors disabled:opacity-50">
                          {busy === inv.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Decline
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* All invitations — manage access */}
        <div className="mt-10">
          <h2 className="font-display text-xl text-parchment mb-4">Invitations & Access</h2>
          {others.length === 0 ? (
            <div className="aged-card rounded-xl p-8 text-center"><p className="text-parchment/50">No invitations yet.</p></div>
          ) : (
            <div className="space-y-2">
              {others.map(inv => (
                <div key={inv.id} className="aged-card rounded-xl p-4 flex items-center gap-3 flex-wrap">
                  <Mail size={14} className="text-amber-light" />
                  <span className="text-sm text-parchment">{inv.invitee_email}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge[inv.status]}`}>{inv.status}</span>
                  <span className="text-xs text-parchment/40">· {ancestorName(inv.registered_ancestor_id) !== '—' ? ancestorName(inv.registered_ancestor_id) : 'not registered'}</span>
                  <span className="text-xs text-parchment/40 ml-auto">{inv.created_date ? new Date(inv.created_date).toLocaleDateString('en-AU') : ''}</span>
                  {inv.status === 'approved' && (
                    <button onClick={() => handleBlock(inv)} disabled={busy === inv.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-900/15 text-red-400 text-xs border border-red-800/25 hover:bg-red-900/25 transition-colors disabled:opacity-50">
                      {busy === inv.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Block Access
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BranchAdminInviteDialog open={inviteOpen} onClose={() => { setInviteOpen(false); load(); }} branches={myBranches} user={user} />
    </Layout>
  );
}