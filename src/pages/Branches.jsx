import React, { useState, useEffect } from 'react';
import { GitBranch, Plus, Sparkles, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AncestorAvatar from '@/components/AncestorAvatar';
import { useBranchRoot } from '@/hooks/useBranchRoot';
import BranchAdminOnboardingIntro from '@/components/BranchAdminOnboardingIntro';
import BranchCloudBackupSetup from '@/components/BranchCloudBackupSetup';
import { branchRoleEmailHtml, BRANCH_ROLE_EMAIL_SUBJECT } from '@/lib/branchAdminExplainer';

const branchColors = ['#C9913A', '#E8C97A', '#8B6914', '#D4A04C', '#B8860B', '#CD853F'];

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', ancestor_id: '', description: '', connected_branch_id: '', acknowledged: false });
  const [user, setUser] = useState(null);
  const [claimedBranch, setClaimedBranch] = useState(null);
  const [backupPromptBranch, setBackupPromptBranch] = useState(null);
  const { rootAncestorId, setBranchRoot } = useBranchRoot();

  useEffect(() => {
    Promise.all([
      base44.entities.Branch.list('-created_date'),
      base44.entities.Ancestor.list(),
    ]).then(([brs, ancs]) => {
      setBranches(brs || []);
      setAncestors(ancs || []);
    }).catch(() => {}).finally(() => setLoading(false));
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Case 2: a branch that became active via marriage acknowledgment while the
  // admin was away. On next visit to Branches, if the admin has an active
  // branch with no cloud backup configured, prompt for it. Skipped while the
  // onboarding intro (case 1 — self-claim) is showing.
  useEffect(() => {
    if (!user || claimedBranch) { setBackupPromptBranch(null); return; }
    const needsBackup = (branches || []).find(b =>
      b.admin_user_id === user.id &&
      b.activation_status === 'active' &&
      !b.cloud_folder_address
    );
    setBackupPromptBranch(needsBackup || null);
  }, [user, branches, claimedBranch]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.ancestor_id) return;
    const hasExisting = branches.length > 0;
    if (hasExisting && (!form.connected_branch_id || !form.acknowledged)) return;
    try {
      const color = branchColors[branches.length % branchColors.length];
      const connectedBranch = (branches || []).find(b => b.id === form.connected_branch_id);
      const newBranch = await base44.entities.Branch.create({
        name: form.name.trim(),
        ancestor_id: form.ancestor_id,
        description: form.description,
        accent_color: color,
        admin_user_id: user?.id || null,
        founder_id: user?.id || null,
        is_claimed: true,
        activation_status: hasExisting ? 'pending_acknowledgment' : 'active',
        connected_by_marriage_to_branch_id: hasExisting ? form.connected_branch_id : null,
        connected_by_marriage_to_branch_name: hasExisting ? (connectedBranch?.name || '') : null,
        requester_acknowledged: hasExisting,
        requester_acknowledged_by_id: hasExisting ? (user?.id || null) : null,
        requester_acknowledged_by_name: hasExisting ? (user?.full_name || null) : null,
        spouse_acknowledged: false,
      });
      setBranches([newBranch, ...branches]);
      setForm({ name: '', ancestor_id: '', description: '', connected_branch_id: '', acknowledged: false });
      setShowForm(false);

      // Send the branch-admin role explainer email + show the in-app intro
      if (user?.email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: BRANCH_ROLE_EMAIL_SUBJECT,
            body: branchRoleEmailHtml({ userName: user.full_name, appUrl: window.location.origin, branchNames: [newBranch.name] }),
          });
        } catch (_) {}
      }
      setClaimedBranch(newBranch);
      // Sync the user's admin_branch_ids so RLS gates writes by branch_id
      try { await base44.functions.invoke('syncUserAdminBranches', { user_id: user.id }); } catch (_) {}
    } catch (e) {}
  };

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl text-parchment mb-3">Family Branches</h1>
          <p className="text-parchment/50 max-w-2xl">Each branch is a connected family line within the Freddi tree. Start your own to preserve your line's unique stories alongside the shared archive.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1,2].map(i => <div key={i} className="aged-card rounded-xl h-40 animate-pulse" />)}
          </div>
        ) : branches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {branches.map(branch => {
              const ancestor = ancestors.find(a => a.id === branch.ancestor_id);
              return (
                <div key={branch.id} className="aged-card rounded-xl p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${branch.accent_color || '#C9913A'}20`, border: `2px solid ${branch.accent_color || '#C9913A'}` }}>
                    <GitBranch size={20} style={{ color: branch.accent_color || '#C9913A' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-lg text-parchment">{branch.name}</h3>
                      {branch.activation_status === 'pending_acknowledgment' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.12)] text-amber-light border border-[rgba(201,145,58,0.25)]">Pending Acknowledgment</span>}
                      {branch.activation_status === 'declined' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-800/30">Declined</span>}
                    </div>
                    {ancestor && <p className="text-sm text-amber-light/70">Rooted in: {ancestor.full_name}</p>}
                    {branch.description && <p className="text-xs text-parchment/50 mt-1">{branch.description}</p>}
                  </div>
                  {branch.ancestor_id && (
                    <button
                      onClick={() => setBranchRoot(branch.ancestor_id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                        rootAncestorId === branch.ancestor_id
                          ? 'bg-[rgba(201,145,58,0.15)] text-gold border border-[rgba(201,145,58,0.4)]'
                          : 'border border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:text-amber-light hover:border-[rgba(201,145,58,0.4)]'
                      }`}
                    >
                      {rootAncestorId === branch.ancestor_id ? <><Check size={14} /> Active Root</> : 'Set as Root'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="aged-card rounded-xl p-8 text-center">
            <p className="text-parchment/50">No branches yet. Be the first to start one.</p>
          </div>
        )}

        <div className="aged-card rounded-2xl p-8 mt-10 text-center bg-gradient-to-br from-[#1A1614] to-[#0D0B0A]">
          <Sparkles size={32} className="text-gold mx-auto mb-4" />
          <h2 className="font-display text-2xl text-parchment mb-2">Start Your Branch</h2>
          <p className="text-parchment/50 text-sm mb-6 max-w-md mx-auto">Create a connected family line that shares the Freddi archive while adding its own unique stories and content.</p>
          <button onClick={() => setShowForm(!showForm)} className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold hover:opacity-90 transition-opacity gold-glow">
            Begin Your Branch
          </button>
        </div>

        {showForm && (
          <div className="aged-card rounded-2xl p-6 mt-6">
            <h3 className="font-display text-xl text-parchment mb-4">New Branch Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Branch Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="e.g. The Carlton Freddis" />
              </div>
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Your Ancestor in the Tree</label>
                <select value={form.ancestor_id} onChange={e => setForm({...form, ancestor_id: e.target.value})}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]">
                  <option value="">Select your ancestor...</option>
                  {ancestors.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="Brief description of this branch..." />
              </div>
              {branches.length > 0 && (
                <div className="rounded-lg border border-[rgba(201,145,58,0.2)] bg-[rgba(201,145,58,0.04)] p-4 space-y-3">
                  <p className="text-xs text-amber-light font-medium">Marriage Connection</p>
                  <p className="text-xs text-parchment/50">An additional bloodline joins the archive by marriage. Select the existing branch this new bloodline is connected to — both branch admins must acknowledge the connection before it activates.</p>
                  <div>
                    <label className="text-xs text-parchment/50 mb-1 block">Connected by marriage to <span className="text-[#C9913A]">*</span></label>
                    <select value={form.connected_branch_id} onChange={e => setForm({...form, connected_branch_id: e.target.value})}
                      className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]">
                      <option value="">Select existing branch...</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <label className="flex items-start gap-2 text-xs text-parchment/60 cursor-pointer">
                    <input type="checkbox" checked={form.acknowledged} onChange={e => setForm({...form, acknowledged: e.target.checked})} className="accent-[#C9913A] mt-0.5" />
                    <span>I acknowledge, as representative of my bloodline, that this other bloodline is connected by marriage.</span>
                  </label>
                </div>
              )}
              <button onClick={handleCreate} disabled={branches.length > 0 && (!form.connected_branch_id || !form.acknowledged)}
                className="px-6 py-2.5 rounded-lg bg-[#C9913A] text-charcoal font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                {branches.length > 0 ? 'Request Branch Activation' : 'Create Branch'}
              </button>
            </div>
          </div>
        )}
      </div>

      {claimedBranch && (
        <BranchAdminOnboardingIntro branch={claimedBranch} user={user} onClose={() => setClaimedBranch(null)} />
      )}

      {backupPromptBranch && !claimedBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in" onClick={() => setBackupPromptBranch(null)}>
          <div className="aged-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
              <h3 className="font-display text-lg text-parchment">Branch Cloud Backup</h3>
              <button onClick={() => setBackupPromptBranch(null)} className="text-parchment/40 hover:text-parchment transition-colors text-sm">Skip for now</button>
            </div>
            <div className="p-5">
              <BranchCloudBackupSetup
                branch={backupPromptBranch}
                onSaved={() => setBackupPromptBranch(null)}
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}