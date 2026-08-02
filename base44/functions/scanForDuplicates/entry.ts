import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { authorizeBranchAdminAction } from '../../shared/branchAdminAuth.ts';
import { detectDuplicateContentPairs } from '../../shared/duplicateDetection.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scopeAncestorIds = Array.isArray(body?.ancestor_ids) && body.ancestor_ids.length > 0 ? new Set(body.ancestor_ids) : null;

    // Gate to branch admin (over the scoped ancestors) or global admin override.
    const auth = await authorizeBranchAdminAction(base44, user, {
      ancestorIds: scopeAncestorIds ? [...scopeAncestorIds] : [],
    });
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    if (!auth.isGlobalAdmin && !scopeAncestorIds) {
      return Response.json({ error: 'Branch admins must scope the scan to their own ancestors' }, { status: 403 });
    }

    const allItems = await base44.asServiceRole.entities.ContentItem.list('-created_date', 500);
    const scopedItems = (allItems || []).filter((i) => {
      if (scopeAncestorIds) return (i.ancestor_ids || []).some((aid) => scopeAncestorIds.has(aid));
      return true;
    });

    const { pairs, scanned } = await detectDuplicateContentPairs(base44, scopedItems);
    return Response.json({ duplicate_pairs: pairs, scanned });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});