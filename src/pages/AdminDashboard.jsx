import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Flag, Copy, Users, AlertCircle, Edit3, Upload, Network, Brain, Inbox, Settings, Crop, ArrowRight, Loader2, Lightbulb, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AdminEditRequests from '@/components/admin/AdminEditRequests';
import AdminAncestorMergeReview from '@/components/admin/AdminAncestorMergeReview';
import AdminDuplicateReview from '@/components/admin/AdminDuplicateReview';
import AdminUploads from '@/components/admin/AdminUploads';
import AdminUncategorized from '@/components/admin/AdminUncategorized';
import AdminFamilyLinks from '@/components/admin/AdminFamilyLinks';
import AdminProblems from '@/components/admin/AdminProblems';
import AdminProposals from '@/components/admin/AdminProposals';
import AdminDisputesList from '@/components/admin/AdminDisputesList';
import AdminActivityFeed from '@/components/admin/AdminActivityFeed';
import AdminIncompleteUploads from '@/components/admin/AdminIncompleteUploads';
import AdminNewAncestors from '@/components/admin/AdminNewAncestors';
import AdminConnectAncestors from '@/components/admin/AdminConnectAncestors';

const TOP_TABS = [
  { key: 'review', label: 'Needs Review', icon: AlertCircle },
  { key: 'disputes', label: 'Disputes & Flags', icon: Flag },
  { key: 'duplicates', label: 'Duplicates', icon: Copy },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'setup', label: 'Setup', icon: Settings },
];

const REVIEW_FILTERS = [
  { key: 'uploads', label: 'Uploads', icon: Upload },
  { key: 'incomplete', label: 'Incomplete', icon: AlertCircle },
  { key: 'uncategorized', label: 'Uncategorized', icon: Brain },
  { key: 'edits', label: 'Edits', icon: Edit3 },
  { key: 'familyLinks', label: 'Family Links', icon: Network },
  { key: 'ancestors', label: 'Ancestors', icon: Users },
  { key: 'connect', label: 'Connect Tree', icon: Network },
  { key: 'problems', label: 'Problems', icon: Inbox },
  { key: 'proposals', label: 'Proposals', icon: Lightbulb },
];

const DUP_FILTERS = [
  { key: 'content', label: 'Content Items', icon: Copy },
  { key: 'profiles', label: 'Ancestor Profiles', icon: Users },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('review');
  const [reviewFilter, setReviewFilter] = useState('uploads');
  const [dupFilter, setDupFilter] = useState('content');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState(null);
  const [globalScope, setGlobalScope] = useState(null);

  const [logs, setLogs] = useState([]);
  const [flags, setFlags] = useState([]);
  const [newAncestors, setNewAncestors] = useState([]);
  const [flaggedItems, setFlaggedItems] = useState([]);
  const [editRequestCount, setEditRequestCount] = useState(0);
  const [uploadCount, setUploadCount] = useState(0);
  const [familyLinkCount, setFamilyLinkCount] = useState(0);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [problemCount, setProblemCount] = useState(0);
  const [proposalCount, setProposalCount] = useState(0);
  const [unconnectedCount, setUnconnectedCount] = useState(0);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    Promise.all([
      base44.entities.ActivityLog.list('-created_date', 50),
      base44.entities.ConflictFlag.filter({ status: 'open' }),
      base44.entities.Ancestor.filter({ review_status: 'staged' }),
      base44.entities.ContentItem.filter({ review_status: 'flagged' }),
      base44.entities.EditRequest.filter({ status: 'pending' }),
      base44.entities.ContentItem.list('-created_date', 100),
      base44.entities.FamilyLink.filter({ status: 'pending' }),
      base44.entities.ContentItem.filter({ content_type: 'uncategorized' }),
      base44.entities.ProblemReport.filter({ status: 'open' }),
      base44.entities.Proposal.filter({ status: 'pending' }),
      base44.entities.Ancestor.list(),
      base44.entities.Branch.list(),
    ]).then(([lg, fl, na, fi, er, items, flk, unc, probs, props, allAnc, brs]) => {
      setLogs(lg || []);
      setFlags(fl || []);
      setEditRequestCount((er || []).length);
      setFamilyLinkCount((flk || []).length);
      setProblemCount((probs || []).length);
      setProposalCount((props || []).length);

      // ── Branch ownership ──
      // Day-to-day approvals/verifications for a CLAIMED branch are the Branch
      // Admin's job. The Global Admin only sees the unclaimed/orphaned backlog
      // (items no Branch Admin owns yet), plus the oversight queues above.
      const branches = brs || [];
      const claimedBranchIds = new Set(branches.filter(b => b.admin_user_id).map(b => b.id));
      const claimedRootIds = new Set(branches.filter(b => b.admin_user_id && b.ancestor_id).map(b => b.ancestor_id));
      // Descendants + partners of claimed roots = ancestors owned by a claimed branch
      const claimedAncestorIds = new Set(claimedRootIds);
      let changed = true;
      while (changed) {
        changed = false;
        for (const a of (allAnc || [])) {
          if (claimedAncestorIds.has(a.id)) continue;
          if ((a.mother_id && claimedAncestorIds.has(a.mother_id)) || (a.father_id && claimedAncestorIds.has(a.father_id))) {
            claimedAncestorIds.add(a.id);
            changed = true;
          }
        }
      }
      for (const a of (allAnc || [])) {
        if (claimedAncestorIds.has(a.id) && a.partner_id) claimedAncestorIds.add(a.partner_id);
      }
      const isClaimedItem = (i) => claimedBranchIds.has(i.branch_id) || (i.ancestor_ids || []).some(aid => claimedAncestorIds.has(aid));

      // Pending uploads — unclaimed backlog only
      setUploadCount((items || []).filter(i => (!i.review_status || i.review_status === 'pending') && !isClaimedItem(i)).length);
      // Uncategorized — unclaimed backlog only
      setUncategorizedCount((unc || []).filter(i => !isClaimedItem(i)).length);
      // Staged ancestors — unclaimed branches / branchless only
      setNewAncestors((na || []).filter(a => !claimedBranchIds.has(a.branch_id)));
      // Flagged (incomplete) uploads — unclaimed backlog only
      setFlaggedItems((fi || []).filter(i => !isClaimedItem(i)));
      // Unconnected ancestors — unclaimed branches / branchless only
      const rootIds = new Set(branches.map(b => b.ancestor_id).filter(Boolean));
      setUnconnectedCount((allAnc || []).filter(a => !a.father_id && !a.mother_id && !a.partner_id && !rootIds.has(a.id) && !claimedBranchIds.has(a.branch_id)).length);

      // Positive-include scope for the review components = the unclaimed set
      const unclaimedBranchIds = new Set([...branches.filter(b => !b.admin_user_id).map(b => b.id), null, undefined]);
      const globalAncestorIds = new Set((allAnc || []).filter(a => !claimedAncestorIds.has(a.id)).map(a => a.id));
      setGlobalScope({ branchIds: unclaimedBranchIds, ancestorIds: globalAncestorIds });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [refreshKey]);


  const reviewCounts = {
    uploads: uploadCount,
    incomplete: flaggedItems.length,
    uncategorized: uncategorizedCount,
    edits: editRequestCount,
    familyLinks: familyLinkCount,
    ancestors: newAncestors.length,
    connect: unconnectedCount,
    problems: problemCount,
    proposals: proposalCount,
  };

  const topCounts = {
    review: Object.values(reviewCounts).reduce((a, b) => a + b, 0),
    disputes: flags.length,
    duplicates: 0,
    activity: logs.length,
    setup: 0,
  };

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center">
            <Activity size={24} className="text-gold" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-parchment">Global Admin</h1>
            <p className="text-parchment/50 text-sm">Oversight capacity — a backdoor into the archive for anything the system can't resolve on its own (AI proposals, branch-admin escalations, stuck workflows)</p>
          </div>
        </div>

        {/* Bucket cards — act as top-level tabs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-8 mb-8">
          {TOP_TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            const showCount = t.key !== 'duplicates' && t.key !== 'setup';
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`aged-card rounded-xl p-4 text-left transition-all ${isActive ? 'border-[rgba(201,145,58,0.5)] gold-glow' : 'hover:border-[rgba(201,145,58,0.3)]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <Icon size={18} className="text-gold flex-shrink-0" />
                  {showCount ? <span className="font-display text-2xl text-parchment leading-none">{topCounts[t.key]}</span> : <span className="text-xs text-parchment/40">—</span>}
                </div>
                <p className="text-xs text-parchment/60 leading-tight">{t.label}</p>
              </button>
            );
          })}
        </div>

        {/* Needs Review sub-filters */}
        {tab === 'review' && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {REVIEW_FILTERS.map(f => {
              const Icon = f.icon;
              const isActive = reviewFilter === f.key;
              const count = reviewCounts[f.key];
              return (
                <button key={f.key} onClick={() => setReviewFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isActive ? 'bg-[rgba(201,145,58,0.15)] text-gold border-[rgba(201,145,58,0.4)]' : 'text-parchment/60 border-[rgba(201,145,58,0.12)] hover:text-amber-light'}`}>
                  <Icon size={13} /> {f.label}
                  {count > 0 && <span className="px-1.5 py-0.5 rounded-full bg-[#8B6914] text-amber-light text-[10px] leading-none">{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Duplicates sub-filters */}
        {tab === 'duplicates' && (
          <div className="flex gap-2 mb-6">
            {DUP_FILTERS.map(f => {
              const Icon = f.icon;
              const isActive = dupFilter === f.key;
              return (
                <button key={f.key} onClick={() => setDupFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isActive ? 'bg-[rgba(201,145,58,0.15)] text-gold border-[rgba(201,145,58,0.4)]' : 'text-parchment/60 border-[rgba(201,145,58,0.12)] hover:text-amber-light'}`}>
                  <Icon size={13} /> {f.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="aged-card rounded-lg h-16 animate-pulse" />)}</div>
        ) : (
          <>
            {tab === 'review' && (
              <>
                <div className="aged-card rounded-xl p-4 mb-4 flex items-start gap-3">
                  <Shield size={16} className="text-gold flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-parchment/60 leading-relaxed">
                    Day-to-day approvals for a claimed branch are handled by its <span className="text-amber-light">Branch Admin</span>. The queues below show only <span className="text-amber-light">unclaimed and orphaned</span> items nobody owns yet — the Global Admin backlog. Branch-admin escalations, disputes, AI proposals and duplicates live in their own tabs.
                  </p>
                </div>
                {reviewFilter === 'uploads' && <AdminUploads refreshKey={refreshKey} scope={globalScope} />}
                {reviewFilter === 'incomplete' && <AdminIncompleteUploads items={flaggedItems} onResolved={() => setRefreshKey(k => k + 1)} />}
                {reviewFilter === 'uncategorized' && <AdminUncategorized refreshKey={refreshKey} scope={globalScope} />}
                {reviewFilter === 'edits' && <AdminEditRequests />}
                {reviewFilter === 'familyLinks' && <AdminFamilyLinks refreshKey={refreshKey} />}
                {reviewFilter === 'ancestors' && <AdminNewAncestors ancestors={newAncestors} onVerified={() => setRefreshKey(k => k + 1)} />}
                {reviewFilter === 'connect' && <AdminConnectAncestors onResolved={() => setRefreshKey(k => k + 1)} scope={globalScope} />}
                {reviewFilter === 'problems' && <AdminProblems refreshKey={refreshKey} />}
                {reviewFilter === 'proposals' && <AdminProposals refreshKey={refreshKey} />}
              </>
            )}
            {tab === 'disputes' && <AdminDisputesList flags={flags} onResolved={() => setRefreshKey(k => k + 1)} />}
            {tab === 'duplicates' && (
              <>
                {dupFilter === 'content' && <AdminDuplicateReview duplicates={[]} onResolved={() => setRefreshKey(k => k + 1)} />}
                {dupFilter === 'profiles' && <AdminAncestorMergeReview />}
              </>
            )}
            {tab === 'activity' && <AdminActivityFeed logs={logs} />}
            {tab === 'setup' && (
              <div className="space-y-5">
                {user?.role === 'admin' && (
                <Link to="/crop-reedit" className="block aged-card rounded-xl p-5 hover:border-[rgba(201,145,58,0.45)] transition-colors group">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[rgba(201,145,58,0.12)] border border-[rgba(201,145,58,0.25)] flex items-center justify-center flex-shrink-0">
                      <Crop size={20} className="text-gold" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.12)] text-amber-light border border-[rgba(201,145,58,0.2)] font-medium">ADMIN SETUP</span>
                        <span className="text-xs text-parchment/30">Permanent tool</span>
                      </div>
                      <p className="text-sm text-parchment font-medium mb-1">Re-edit Image Cropping</p>
                      <p className="text-xs text-parchment/50">Re-adjust the focal point and crop box for any image across the archive so cards and hero displays frame subjects correctly.</p>
                    </div>
                    <ArrowRight size={18} className="text-gold/50 group-hover:text-gold transition-colors flex-shrink-0 mt-1" />
                  </div>
                </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}