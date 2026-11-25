import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireReviewer } from '../../shared/reviewAccess.ts';

// One-off maintenance sweep: an earlier merge can leave an open duplicate flag
// pointing at a record that no longer exists, or at the very record it flags.
// Such a flag can never be merged, so it is auto-dismissed here. Valid,
// still-mergeable flags are never touched, and re-running is safe because only
// open flags are considered.

const DUPLICATE_TYPES = ['duplicate_ancestor', 'duplicate_upload', 'duplicate'];
const NOTE = 'Auto-dismissed: duplicate target no longer exists after an earlier merge';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await requireReviewer(base44);
    if (access.error) return Response.json({ error: access.error }, { status: access.status });
    const user = access.user;

    const [openFlags, ancestorRows, itemRows] = await Promise.all([
      base44.asServiceRole.entities.ConflictFlag.filter({ status: 'open' }).catch(() => []),
      base44.asServiceRole.entities.Ancestor.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.ContentItem.list('-created_date', 500).catch(() => []),
    ]);

    const liveAncestors = new Set((ancestorRows || []).map((a) => a.id));
    const liveItems = new Set((itemRows || []).map((i) => i.id));

    const candidates = (openFlags || []).filter((f) => DUPLICATE_TYPES.includes(f.flag_type));

    const orphans = [];
    for (const f of candidates) {
      const isAncestorPair = f.flag_type === 'duplicate_ancestor';
      const a = isAncestorPair ? f.ancestor_id : f.content_item_id;
      const b = isAncestorPair ? f.duplicate_of_ancestor_id : f.duplicate_of_content_item_id;
      const live = isAncestorPair ? liveAncestors : liveItems;
      const missing = !a || !b || !live.has(a) || !live.has(b);
      const selfFlagged = !!a && a === b;
      if (missing || selfFlagged) orphans.push(f);
    }

    const reviewedDate = new Date().toISOString();
    if (orphans.length) {
      await base44.asServiceRole.entities.ConflictFlag.bulkUpdate(orphans.map((f) => ({
        id: f.id,
        status: 'dismissed',
        review_state: 'dismissed',
        resolution_note: NOTE,
        reviewed_by_id: user.id,
        reviewed_date: reviewedDate,
      })));
    }

    return Response.json({ checked: candidates.length, dismissed: orphans.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}