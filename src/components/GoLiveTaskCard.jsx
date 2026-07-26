import React, { useState, useEffect } from 'react';
import { Rocket, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SwipeReviewModal from '@/components/SwipeReviewModal';

// When `branchId` is provided, the card and the swipe review it launches are
// scoped to a single branch: only that branch's uploads count as pending, and
// the GoLiveSession completion milestone is recorded against that branch.
// Without `branchId` the card behaves globally (all branches), as before.
export default function GoLiveTaskCard({ branchId, descendantAncestorIds, scopeLabel }) {
  const [completed, setCompleted] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const inScope = (item) => {
    if (!branchId) return true;
    if (item.branch_id === branchId) return true;
    return (item.ancestor_ids || []).some(aid => (descendantAncestorIds || []).includes(aid));
  };

  const loadData = async () => {
    try {
      const sessions = await base44.entities.GoLiveSession.list().catch(() => []);
      const mySessions = branchId
        ? (sessions || []).filter(s => s.branch_id === branchId)
        : (sessions || []).filter(s => !s.branch_id);
      const isDone = mySessions.some(s => s.status === 'completed');
      setCompleted(isDone);

      if (!isDone) {
        const items = await base44.entities.ContentItem.list('-created_date', 200);
        const pendingItems = (items || []).filter(i =>
          (!i.review_status || i.review_status === 'pending' || i.review_status === 'flagged') && inScope(i)
        );
        const ancs = await base44.entities.Ancestor.list();
        const pendingAncs = (ancs || []).filter(a =>
          (a.review_status === 'auto_approved' || a.review_status === 'staged') &&
          (!branchId || a.branch_id === branchId || (descendantAncestorIds || []).includes(a.id))
        );
        setPendingCount(pendingItems.length + pendingAncs.length);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [branchId]);

  if (loading || completed) return null;

  const scopeSuffix = scopeLabel ? ` for ${scopeLabel}` : '';

  return (
    <>
      <div className="aged-card rounded-xl p-5 border-[rgba(201,145,58,0.4)] gold-glow mt-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9913A] to-[#E8C97A] flex items-center justify-center flex-shrink-0">
            <Rocket size={20} className="text-charcoal" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.15)] text-amber-light border border-[rgba(201,145,58,0.25)] font-medium">GOING LIVE</span>
              <span className="text-xs text-parchment/30">{scopeLabel ? `${scopeLabel} Branch` : 'Master Task'}</span>
            </div>
            <p className="text-sm text-parchment font-medium mb-1">Review all events and ancestors before going live{scopeSuffix}</p>
            <p className="text-xs text-parchment/50 mb-3">
              {pendingCount > 0
                ? `${pendingCount} item${pendingCount !== 1 ? 's' : ''} awaiting review (events + ancestor profiles). Swipe through each one — right to confirm, left to flag for further review.`
                : `All events and ancestors reviewed. Ready to go live${scopeSuffix} and invite family members.`}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Start Review
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
      {showModal && (
        <SwipeReviewModal
          onClose={() => { setShowModal(false); loadData(); }}
          branchId={branchId}
          descendantAncestorIds={descendantAncestorIds}
          scopeLabel={scopeLabel}
        />
      )}
    </>
  );
}