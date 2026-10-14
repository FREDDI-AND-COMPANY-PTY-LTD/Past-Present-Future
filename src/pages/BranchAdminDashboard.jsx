import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, UserPlus, Loader2, Check, X, GitBranch, Mail, Clock, AlertCircle, Upload, Users, Flag, Newspaper, LifeBuoy, Brain, Network, Heart, Edit3, Copy, Crop } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import BranchAdminInviteDialog from '@/components/BranchAdminInviteDialog';
import BranchNewsletterFrequency from '@/components/BranchNewsletterFrequency';
import BranchAdminEscalationDialog from '@/components/BranchAdminEscalationDialog';
import BranchAdminSuccession from '@/components/BranchAdminSuccession';
import AdminUploads from '@/components/admin/AdminUploads';
import AdminUncategorized from '@/components/admin/AdminUncategorized';
import AdminIncompleteUploads from '@/components/admin/AdminIncompleteUploads';
import AdminNewAncestors from '@/components/admin/AdminNewAncestors';
import AdminConnectAncestors from '@/components/admin/AdminConnectAncestors';
import AdminEditRequests from '@/components/admin/AdminEditRequests';
import AdminFamilyLinks from '@/components/admin/AdminFamilyLinks';
import AdminDuplicateReview from '@/components/admin/AdminDuplicateReview';
import AdminAncestorMergeReview from '@/components/admin/AdminAncestorMergeReview';

const statusBadge = {
  pending: 'bg-[rgba(201,145,58,0.1)] text-amber-light border-[rgba(201,145,58,0.25)]',
  nominated: 'bg-blue-900/20 text-blue-300 border-blue-800/30',
  approved: 'bg-green-900/20 text-green-400 border-green-800/30',
  declined: 'bg-[rgba(245,236,215,0.05)] text-parchment/50 border-[rgba(245,236,215,0.1)]',
  blocked: 'bg-red-900/20 text-red-400 border-red-800/30',
};

const REVIEW_TABS = [
  { key: 'uploads', label: 'Uploads', icon: Upload },
  { key: 'incomplete', label: 'Incomplete', icon: AlertCircle },
  { key: 'uncategorized', label: 'Uncategorized', icon: Brain },
  { key: 'ancestors', label: 'New Ancestors', icon: Users },
  { key: 'connect', label: 'Connect Tree', icon: Network },
  { key: 'edits', label: 'Edits', icon: Edit3 },
  { key: 'familyLinks', label: 'Family Links', icon: Heart },
  { key: 'duplicates', label: 'Duplicates', icon: Copy },
];

export default function BranchAdminDashboard() {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [allAncestors, setAllAncestors] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});
  const [pendingUploads, setPendingUploads] = useState([]);
  const [newAncestors, setNewAncestors] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState(null);
  const [scope, setScope] = useState(null);
  const [branchItems, setBranchItems] = useState([]);
  const [editCount, setEditCount] = useState(0);
  const [familyLinkCount, setFamilyLinkCount] = useState(0);
  const [duplicateFlagCount, setDuplicateFlagCount] = useState(0);

  const load = async () => {
    try {
      const [u, brs, anc, allInvites, items, flags, editReqs, famLinks] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.Branch.list(),
        base44.entities.Ancestor.list(),
        base44.entities.BranchInvite.list('-created_date', 200),
        base44.entities.ContentItem.list('-created_date', 200),
        base44.entities.ConflictFlag.filter({ status: 'open' }),
        base44.entities.EditRequest.filter({ status: 'pending' }),
        base44.entities.FamilyLink.list('-created_date', 100),
      ]);
      setUser(u);
      setBranches(brs || []);
      setAllAncestors(anc || []);
      const myBr = (brs || []).filter(b => b.admin_user_id && u && b.admin_user_id === u.id);
      const myBranchIds = myBr.map(b => b.id);
      setInvites((allInvites || []).filter(i => myBranchIds.includes(i.branch_id)));

      // Branch-scoped admin queues — descendants of this branch's root ancestor(s)
      const rootIds = myBr.map(b => b.ancestor_id).filter(Boolean);
      const descIds = new Set(rootIds);
      let changed = true;
      while (changed) {
        changed = false;
        for (const a of (anc || [])) {
          if (descIds.has(a.id)) continue;
          if ((a.mother_id && descIds.has(a.mother_id)) || (a.father_id && descIds.has(a.father_id))) {
            descIds.add(a.id);
            changed = true;
          }
        }
      }
      for (const a of (anc || [])) {
        if (descIds.has(a.id) && a.partner_id) descIds.add(a.partner_id);
      }
      const branchContent = (items || []).filter(i =>
        myBranchIds.includes(i.branch_id) || (i.ancestor_ids || []).some(aid => descIds.has(aid))
      );
      setBranchItems(branchContent);
      setScope({ branchIds: new Set(myBranchIds), ancestorIds: descIds, contentItemIds: new Set(branchContent.map(i => i.id)) });
      setPendingUploads(branchContent.filter(i => !i.review_status || i.review_status === 'pending'));
      setNewAncestors((anc || []).filter(a => myBranchIds.includes(a.branch_id) && a.review_status === 'staged'));
      setDisputes((flags || []).filter(f =>
        (f.ancestor_id && descIds.has(f.ancestor_id)) || branchContent.some(i => i.id === f.content_item_id)
      ));
      const branchContentIds = new Set(branchContent.map(i => i.id));
      setEditCount((editReqs || []).filter(r => branchContentIds.has(r.content_item_id)).length);
      setFamilyLinkCount((famLinks || []).filter(l =>
        branchContentIds.has(l.content_item_id) ||
        [l.subject_ancestor_id, l.mother_ancestor_id, l.father_ancestor_id, l.partner_ancestor_id].some(aid => aid && descIds.has(aid))
      ).length);
      setDuplicateFlagCount((flags || []).filter(f =>
        (f.flag_type === 'duplicate_upload' || f.flag_type === 'duplicate_ancestor') &&
        ((f.ancestor_id && descIds.has(f.ancestor_id)) || branchContent.some(i => i.id === f.content_item_id))
      ).length);

      // Auto-select the first tab that has pending items so the admin lands on
      // something actionable instead of an empty default tab
      const pendingUploadCount = branchContent.filter(i => !i.review_status || i.review_status === 'pending').length;
      const flaggedCount = branchContent.filter(i => i.review_status === 'flagged').length;
      const uncategorizedNum = branchContent.filter(i => i.content_type === 'uncategorized').length;
      const stagedCount = (anc || []).filter(a => myBranchIds.includes(a.branch_id) && a.review_status === 'staged').length;
      const editReqCount = (editReqs || []).filter(r => new Set(branchContent.map(i => i.id)).has(r.content_item_id)).length;
      const famLinkCount = (famLinks || []).filter(l =>
        new Set(branchContent.map(i => i.id)).has(l.content_item_id) ||
        [l.subject_ancestor_id, l.mother_ancestor_id, l.father_ancestor_id, l.partner_ancestor_id].some(aid => aid && descIds.has(aid))
      ).length;
      const dupFlagCount = (flags || []).filter(f =>
        (f.flag_type === 'duplicate_upload' || f.flag_type === 'duplicate_ancestor') &&
        ((f.ancestor_id && descIds.has(f.ancestor_id)) || branchContent.some(i => i.id === f.content_item_id))
      ).length;
      const tabCounts = { uploads: pendingUploadCount, incomplete: flaggedCount, uncategorized: uncategorizedNum, ancestors: stagedCount, connect: 0, edits: editReqCount, familyLinks: famLinkCount, duplicates: dupFlagCount };
      const firstWithItems = REVIEW_TABS.find(t => (tabCounts[t.key] || 0) > 0);
      setReviewTab(prev => prev || (firstWithItems ? firstWithItems.key : 'uploads'));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const myBranches = (branches || []).filter(b => b.admin_user_id && user && b.admin_user_id === user.id);
  const pendingMarriageRequests = (branches || []).filter(b =>
    b.activation_status === 'pending_acknowledgment' &&
    myBranches.some(mb => mb.id === b.connected_by_marriage_to_branch_id) &&
    !b.spouse_acknowledged
  );
  const nominations = invites.filter(i => i.status === 'nominated');
  const others = invites.filter(i => i.status !== 'nominated');
  const flaggedContent = (branchItems || []).filter(i => i.review_status === 'flagged');
  const uncategorizedCount = (branchItems || []).filter(i => i.content_type === 'uncategorized').length;
  const rootIdsSet = new Set((branches || []).filter(b => myBranches.some(mb => mb.id === b.id)).map(b => b.ancestor_id).filter(Boolean));
  const connectCount = (allAncestors || []).filter(a => !a.father_id && !a.mother_id && !a.partner_id && !rootIdsSet.has(a.id) && myBranches.some(b => b.id === a.branch_id)).length;

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

  const handleAcknowledgeMarriage = async (b) => {
    setBusy(b.id);
    try {
      await base44.entities.Branch.update(b.id, {
        activation_status: 'active',
        spouse_acknowledged: true,
        spouse_acknowledged_by_id: user?.id || null,
        spouse_acknowledged_by_name: user?.full_name || null,
        spouse_acknowledged_at: new Date().toISOString(),
      });
      load();
    } catch (e) {}
    setBusy(null);
  };

  const handleDeclineMarriage = async (b) => {
    setBusy(b.id);
    try {
      await base44.entities.Branch.update(b.id, {
        activation_status: 'declined',
        spouse_acknowledged_by_id: user?.id || null,
        spouse_acknowledged_by_name: user?.full_name || null,
        spouse_acknowledged_at: new Date().toISOString(),
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
            <h2 className="font-display text-2xl text-parchment mb-2">No Branch to Administer Yet</h2>
            <p className="text-parchment/50 text-sm mb-6 max-w-md mx-auto">Branch admins review pending uploads, approve or reject content, run duplicate detection, and merge duplicate ancestor profiles. Create a branch to become its admin and unlock these tools.</p>
            <Link to="/branches"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <GitBranch size={16} /> Create a Branch
            </Link>
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
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/crop-reedit"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.08)] transition-colors">
              <Crop size={15} /> Re-edit Crops
            </Link>
            <button onClick={() => setEscalateOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.08)] transition-colors">
              <LifeBuoy size={15} /> Escalate to Global Admin
            </button>
            <button onClick={() => setInviteOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
              <UserPlus size={15} /> Invite to Branch
            </button>
          </div>
        </div>

        {/* Marriage connection requests — two-admin mutual acknowledgment */}
        {pendingMarriageRequests.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-xl text-parchment mb-4 flex items-center gap-2">
              <Heart size={18} className="text-gold" /> Marriage Connection Requests
            </h2>
            <div className="space-y-3">
              {pendingMarriageRequests.map(b => (
                <div key={b.id} className="aged-card rounded-xl p-5">
                  <p className="text-sm text-parchment"><span className="text-amber-light font-medium">{b.name}</span> was created as a bloodline connected by marriage to <span className="text-amber-light">{b.connected_by_marriage_to_branch_name}</span>.</p>
                  <p className="text-xs text-parchment/40 mt-1">Acknowledged by the requester: {b.requester_acknowledged_by_name || '—'}. Awaiting your acknowledgment as representative of {b.connected_by_marriage_to_branch_name}.</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleAcknowledgeMarriage(b)} disabled={busy === b.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors disabled:opacity-50">
                      {busy === b.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Acknowledge & Activate
                    </button>
                    <button onClick={() => handleDeclineMarriage(b)} disabled={busy === b.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(245,236,215,0.05)] text-parchment/60 text-xs border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.08)] transition-colors disabled:opacity-50">
                      <X size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Succession — transfer branch admin to an elder living male ancestor */}
        <BranchAdminSuccession branches={myBranches} allAncestors={allAncestors} user={user} onChanged={load} />

        {/* Branch Review — day-to-day curation tools, scoped to your branch(es) */}
        <div className="mt-8">
          <h2 className="font-display text-xl text-parchment mb-2 flex items-center gap-2">
            <AlertCircle size={18} className="text-gold" /> Branch Review
          </h2>
          <p className="text-sm text-parchment/50 mb-4">
            {pendingUploads.length === 0 && editCount === 0 && familyLinkCount === 0 && duplicateFlagCount === 0 && newAncestors.length === 0 && flaggedContent.length === 0 && uncategorizedCount === 0
              ? 'All caught up — no pending items in your branch. Click any tab below to review its category.'
              : <>
                  Pending items: {[
                    pendingUploads.length > 0 && `${pendingUploads.length} upload${pendingUploads.length > 1 ? 's' : ''}`,
                    flaggedContent.length > 0 && `${flaggedContent.length} incomplete`,
                    uncategorizedCount > 0 && `${uncategorizedCount} uncategorized`,
                    newAncestors.length > 0 && `${newAncestors.length} new ancestor${newAncestors.length > 1 ? 's' : ''}`,
                    editCount > 0 && `${editCount} edit request${editCount > 1 ? 's' : ''}`,
                    familyLinkCount > 0 && `${familyLinkCount} family link${familyLinkCount > 1 ? 's' : ''}`,
                    duplicateFlagCount > 0 && `${duplicateFlagCount} duplicate flag${duplicateFlagCount > 1 ? 's' : ''}`,
                  ].filter(Boolean).join(' · ')}. Click a tab below to review and take action.
                </>
              }
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {REVIEW_TABS.map(f => {
              const Icon = f.icon;
              const isActive = reviewTab === f.key;
              const count = f.key === 'uploads' ? pendingUploads.length
                : f.key === 'incomplete' ? flaggedContent.length
                : f.key === 'uncategorized' ? uncategorizedCount
                : f.key === 'ancestors' ? newAncestors.length
                : f.key === 'connect' ? connectCount
                : f.key === 'edits' ? editCount
                : f.key === 'familyLinks' ? familyLinkCount
                : f.key === 'duplicates' ? duplicateFlagCount
                : 0;
              return (
                <button key={f.key} onClick={() => setReviewTab(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isActive ? 'bg-[rgba(201,145,58,0.15)] text-gold border-[rgba(201,145,58,0.4)]' : 'text-parchment/60 border-[rgba(201,145,58,0.12)] hover:text-amber-light'}`}>
                  <Icon size={13} /> {f.label}
                  {count > 0 && <span className="px-1.5 py-0.5 rounded-full bg-[#8B6914] text-amber-light text-[10px] leading-none">{count}</span>}
                </button>
              );
            })}
          </div>
          <div>
            {reviewTab === 'uploads' && <AdminUploads scope={scope} />}
            {reviewTab === 'incomplete' && <AdminIncompleteUploads items={flaggedContent} onResolved={load} />}
            {reviewTab === 'uncategorized' && <AdminUncategorized scope={scope} />}
            {reviewTab === 'ancestors' && <AdminNewAncestors ancestors={newAncestors} onVerified={load} />}
            {reviewTab === 'connect' && <AdminConnectAncestors scope={scope} onResolved={load} />}
            {reviewTab === 'edits' && <AdminEditRequests scope={scope} />}
            {reviewTab === 'familyLinks' && <AdminFamilyLinks scope={scope} onResolved={load} />}
            {reviewTab === 'duplicates' && (
              <div className="space-y-6">
                <AdminDuplicateReview duplicates={[]} onResolved={load} scope={scope} />
                <AdminAncestorMergeReview scope={scope} />
              </div>
            )}
          </div>
          {disputes.length > 0 && (
            <p className="text-xs text-parchment/40 mt-3">Open disputes in your branch: {disputes.length}. Cross-branch and contested disputes are resolved by the Global Admin — use "Escalate to Global Admin" if a dispute is stuck.</p>
          )}
        </div>

        {/* Newsletter frequency — per branch */}
        <div className="mt-8">
          <h2 className="font-display text-xl text-parchment mb-4 flex items-center gap-2">
            <Newspaper size={18} className="text-gold" /> Newsletter Frequency
          </h2>
          <div className="space-y-3 max-w-xl">
            {myBranches.map(b => (
              <BranchNewsletterFrequency key={b.id} branch={b} onUpdate={load} />
            ))}
          </div>
          <p className="text-xs text-parchment/30 mt-2">Tick a branch to issue its newsletter weekly; untick for monthly (the default).</p>
        </div>

        {/* Nominations awaiting review */}
        <div className="mt-10">
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
      <BranchAdminEscalationDialog open={escalateOpen} onClose={() => setEscalateOpen(false)} branches={myBranches} user={user} />
    </Layout>
  );
}