import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Counts pending branch-admin items for the signed-in user:
 * pending uploads, staged ancestors, open conflict flags, pending edit requests,
 * pending family links, and duplicate flags. Used for the sidebar badge and the
 * Home-page admin review card so branch admins can see at a glance that they
 * have items to review.
 */
export function useBranchAdminPendingCount() {
  const [count, setCount] = useState(0);
  const [breakdown, setBreakdown] = useState({ uploads: 0, ancestors: 0, disputes: 0, duplicates: 0, edits: 0, familyLinks: 0 });
  const [isBranchAdmin, setIsBranchAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me().catch(() => null);
        if (!me || cancelled) return;

        const [branches, ancestors, items, flags, editReqs, famLinks] = await Promise.all([
          base44.entities.Branch.list().catch(() => []),
          base44.entities.Ancestor.list().catch(() => []),
          base44.entities.ContentItem.list('-created_date', 200).catch(() => []),
          base44.entities.ConflictFlag.filter({ status: 'open' }).catch(() => []),
          base44.entities.EditRequest.filter({ status: 'pending' }).catch(() => []),
          base44.entities.FamilyLink.list('-created_date', 100).catch(() => []),
        ]);
        if (cancelled) return;

        const myBranches = (branches || []).filter(b => b.admin_user_id && b.admin_user_id === me.id);
        if (myBranches.length === 0) {
          setIsBranchAdmin(false);
          setLoading(false);
          return;
        }
        setIsBranchAdmin(true);

        const myBranchIds = new Set(myBranches.map(b => b.id));
        const rootIds = new Set(myBranches.map(b => b.ancestor_id).filter(Boolean));
        const descIds = new Set(rootIds);
        let changed = true;
        while (changed) {
          changed = false;
          for (const a of (ancestors || [])) {
            if (descIds.has(a.id)) continue;
            if ((a.mother_id && descIds.has(a.mother_id)) || (a.father_id && descIds.has(a.father_id))) {
              descIds.add(a.id);
              changed = true;
            }
          }
        }
        for (const a of (ancestors || [])) {
          if (descIds.has(a.id) && a.partner_id) descIds.add(a.partner_id);
        }

        const branchContent = (items || []).filter(i =>
          myBranchIds.has(i.branch_id) || (i.ancestor_ids || []).some(aid => descIds.has(aid))
        );
        const branchContentIds = new Set(branchContent.map(i => i.id));

        const uploads = branchContent.filter(i => !i.review_status || i.review_status === 'pending').length;
        const stagedAncestors = (ancestors || []).filter(a => myBranchIds.has(a.branch_id) && a.review_status === 'staged').length;
        const disputes = (flags || []).filter(f =>
          (f.ancestor_id && descIds.has(f.ancestor_id)) || branchContent.some(i => i.id === f.content_item_id)
        ).length;
        const duplicates = (flags || []).filter(f =>
          (f.flag_type === 'duplicate_upload' || f.flag_type === 'duplicate_ancestor') &&
          ((f.ancestor_id && descIds.has(f.ancestor_id)) || branchContent.some(i => i.id === f.content_item_id))
        ).length;
        const edits = (editReqs || []).filter(r => branchContentIds.has(r.content_item_id)).length;
        const familyLinks = (famLinks || []).filter(l =>
          branchContentIds.has(l.content_item_id) ||
          [l.subject_ancestor_id, l.mother_ancestor_id, l.father_ancestor_id, l.partner_ancestor_id].some(aid => aid && descIds.has(aid))
        ).length;

        const total = uploads + stagedAncestors + disputes + duplicates + edits + familyLinks;
        setBreakdown({ uploads, ancestors: stagedAncestors, disputes, duplicates, edits, familyLinks });
        setCount(total);
      } catch (e) {}
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { count, breakdown, isBranchAdmin, loading };
}