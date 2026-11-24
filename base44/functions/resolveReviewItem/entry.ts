import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireReviewer } from '../../shared/reviewAccess.ts';

// Action dispatcher for the shared review lifecycle. It never re-implements an
// existing workflow: "resolve" hands off to the function that already owns that
// job, then records the outcome on the new parallel review_state fields.
// The entities' legacy `status` values keep their existing meaning.

const ENTITY_NAMES = ['ConflictFlag', 'FamilyLink', 'EditRequest', 'ProblemReport', 'Assertion', 'Comment'];
const ACTIONS = ['resolve', 'dismiss', 'later', 'reopen'];

const inCallerScope = (sourceEntity, record, access) => {
  if (access.isGlobalAdmin) return true;
  const inContent = (id) => !!id && access.contentItemIds.has(id);
  const inAncestors = (id) => !!id && access.ancestorIds.has(id);
  switch (sourceEntity) {
    case 'ConflictFlag':
      return inAncestors(record.ancestor_id) || inContent(record.content_item_id) || inContent(record.duplicate_of_content_item_id);
    case 'FamilyLink':
      return inContent(record.content_item_id) ||
        [record.subject_ancestor_id, record.mother_ancestor_id, record.father_ancestor_id, record.partner_ancestor_id].some(inAncestors);
    case 'EditRequest':
      return inContent(record.content_item_id);
    case 'ProblemReport':
      return !!record.branch_id && access.adminBranchIds.has(record.branch_id);
    case 'Assertion':
      return (!!record.branch_id && access.adminBranchIds.has(record.branch_id)) ||
        (record.subject_type === 'ancestor' && inAncestors(record.subject_id)) ||
        (record.subject_type === 'content_item' && inContent(record.subject_id));
    case 'Comment':
      return (record.tagged_user_ids || []).includes(access.user.id) ||
        (record.entity_type === 'ContentItem' && inContent(record.entity_id)) ||
        (record.entity_type === 'Ancestor' && inAncestors(record.entity_id));
    default:
      return false;
  }
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await requireReviewer(base44);
    if (access.error) return Response.json({ error: access.error }, { status: access.status });
    const user = access.user;

    const body = await req.json().catch(() => ({}));
    const { source_entity, id, action, note, survivor_id } = body;
    if (!ENTITY_NAMES.includes(source_entity)) {
      return Response.json({ error: `source_entity must be one of ${ENTITY_NAMES.join(', ')}` }, { status: 400 });
    }
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
    if (!ACTIONS.includes(action)) {
      return Response.json({ error: `action must be one of ${ACTIONS.join(', ')}` }, { status: 400 });
    }

    const record = await base44.asServiceRole.entities[source_entity].get(id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!record) return Response.json({ error: 'Record not found' }, { status: 404 });
    if (!inCallerScope(source_entity, record, access)) {
      return Response.json({ error: 'You can only review records within your own branch' }, { status: 403 });
    }

    const reviewFields = {
      review_note: note || null,
      reviewed_by_id: user.id,
      reviewed_date: new Date().toISOString(),
    };

    // ── Lifecycle-only actions ──
    if (action === 'later' || action === 'reopen') {
      const review_state = action === 'later' ? 'later' : 'open';
      await base44.asServiceRole.entities[source_entity].update(id, { review_state, ...reviewFields });
      return Response.json({ success: true, source_entity, id, action, review_state });
    }

    if (action === 'dismiss') {
      const patch = { review_state: 'dismissed', ...reviewFields };
      // A dismissed duplicate is recorded as "not a match" so the scans can
      // recognise the pair and never raise it again.
      if (source_entity === 'ConflictFlag' &&
          (record.flag_type === 'duplicate_upload' || record.flag_type === 'duplicate_ancestor')) {
        patch.status = 'dismissed';
        patch.dispute_description = `Not a match — reviewed and dismissed by ${user.full_name || user.email || 'an admin'}. ${record.dispute_description || ''}`.trim();
      }
      await base44.asServiceRole.entities[source_entity].update(id, patch);
      return Response.json({ success: true, source_entity, id, action, review_state: 'dismissed' });
    }

    // ── resolve: hand off to the function that owns this kind of record ──
    let detail = null;

    if (source_entity === 'ConflictFlag') {
      const isDuplicate = record.flag_type === 'duplicate_upload' || record.flag_type === 'duplicate_ancestor';

      if (isDuplicate) {
        const pair = record.flag_type === 'duplicate_upload'
          ? { a: record.content_item_id, b: record.duplicate_of_content_item_id, kind: 'item' }
          : { a: record.ancestor_id, b: record.duplicate_of_ancestor_id, kind: 'ancestor' };

        if (!pair.a || !pair.b) {
          return Response.json({ error: 'This duplicate pair is incomplete and cannot be merged' }, { status: 400 });
        }
        if (pair.a === pair.b) {
          return Response.json({ error: 'This duplicate flag points at a single record — dismiss it instead of merging' }, { status: 400 });
        }
        const keep = survivor_id && (survivor_id === pair.a || survivor_id === pair.b) ? survivor_id : pair.b;
        const remove = keep === pair.a ? pair.b : pair.a;

        const res = pair.kind === 'item'
          ? await base44.functions.invoke('resolveDuplicateMerge', {
              keep_item_id: keep,
              remove_item_id: remove,
              field_resolutions: {},
            })
          : await base44.functions.invoke('mergeAncestorProfiles', {
              keep_ancestor_id: keep,
              remove_ancestor_id: remove,
            });
        detail = { merged: true, kept_id: keep, removed_id: remove, result: res?.data ?? res ?? null };
      } else {
        await base44.asServiceRole.entities.ConflictFlag.update(id, {
          status: 'resolved',
          resolution_note: note || 'Dispute accepted by reviewer',
          resolved_by_id: user.id,
        });
        detail = { conflict: 'accepted' };
      }
    } else if (source_entity === 'FamilyLink') {
      const res = await base44.functions.invoke('integrateFamilyLink', { family_link_id: id });
      detail = { integrated: true, result: res?.data ?? res ?? null };
    } else if (source_entity === 'EditRequest') {
      if (record.content_item_id && record.proposed_changes) {
        await base44.asServiceRole.entities.ContentItem.update(record.content_item_id, record.proposed_changes);
      }
      await base44.asServiceRole.entities.EditRequest.update(id, {
        status: 'approved',
        reviewed_by_id: user.id,
        reviewed_by_name: user.full_name || user.email || 'Admin',
        review_note: note || 'Approved and applied by admin',
      });
      detail = { applied: true };
    } else if (source_entity === 'ProblemReport') {
      await base44.asServiceRole.entities.ProblemReport.update(id, {
        status: 'resolved',
        admin_response: note || record.admin_response || null,
      });
      detail = { handled: true };
    } else if (source_entity === 'Assertion') {
      await base44.asServiceRole.entities.Assertion.update(id, { accepted: true, conflict: false });
      detail = { accepted: true };
    } else if (source_entity === 'Comment') {
      const acknowledged = [...new Set([...(record.acknowledged_by || []), user.id])];
      await base44.asServiceRole.entities.Comment.update(id, { acknowledged_by: acknowledged });
      detail = { cleared: true };
    }

    await base44.asServiceRole.entities[source_entity].update(id, { review_state: 'resolved', ...reviewFields });

    return Response.json({ success: true, source_entity, id, action, review_state: 'resolved', detail });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}