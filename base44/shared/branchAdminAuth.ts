// Shared authorization for branch-scoped admin operations.
// A caller may run an action when they are EITHER:
//   - the global admin (role === 'admin') — full override, OR
//   - the branch admin of a branch that owns the targeted ancestor(s)/content.
// Used by scanForDuplicates, scanAncestorDuplicates, mergeAncestorProfiles,
// mergeDuplicateItems, integrateFamilyLink.

export async function getUserBranchScope(base44, user) {
  const isGlobalAdmin = user?.role === 'admin';
  const branches = await base44.asServiceRole.entities.Branch.list().catch(() => []);
  const myBranches = (branches || []).filter((b) => b.admin_user_id && b.admin_user_id === user.id);
  const branchIds = new Set(myBranches.map((b) => b.id));
  const rootIds = myBranches.map((b) => b.ancestor_id).filter(Boolean);

  const all = await base44.asServiceRole.entities.Ancestor.list('-created_date', 500).catch(() => []);
  // Descendants of each branch root (follow mother/father links) + partners + direct branch assignment.
  const ancestorIds = new Set(rootIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of (all || [])) {
      if (ancestorIds.has(a.id)) continue;
      if ((a.mother_id && ancestorIds.has(a.mother_id)) || (a.father_id && ancestorIds.has(a.father_id))) {
        ancestorIds.add(a.id);
        changed = true;
      }
    }
  }
  for (const a of (all || [])) {
    if (ancestorIds.has(a.id) && a.partner_id) ancestorIds.add(a.partner_id);
  }
  for (const a of (all || [])) {
    if (a.branch_id && branchIds.has(a.branch_id)) ancestorIds.add(a.id);
  }
  return { isGlobalAdmin, branchIds, ancestorIds };
}

// Verify the caller is a branch admin (or global admin) with authority over the
// given ancestor ids and/or content item ids. Returns { ok, error?, status? }.
export async function authorizeBranchAdminAction(base44, user, { ancestorIds = [], contentItemIds = [] } = {}) {
  const { isGlobalAdmin, branchIds, ancestorIds: ownedAncestorIds } = await getUserBranchScope(base44, user);
  if (isGlobalAdmin) return { ok: true, isGlobalAdmin: true };

  if (branchIds.size === 0) {
    return { ok: false, error: 'Branch admin access required', status: 403 };
  }

  for (const id of ancestorIds) {
    if (id && !ownedAncestorIds.has(id)) {
      return { ok: false, error: 'You can only manage records within your own branch', status: 403 };
    }
  }

  if (contentItemIds.length > 0) {
    const items = await base44.asServiceRole.entities.ContentItem.list('-created_date', 500).catch(() => []);
    for (const targetId of contentItemIds) {
      const it = (items || []).find((i) => i.id === targetId);
      if (!it) {
        return { ok: false, error: 'Target content item not found', status: 404 };
      }
      const byBranch = it.branch_id && branchIds.has(it.branch_id);
      const byAncestor = (it.ancestor_ids || []).some((aid) => ownedAncestorIds.has(aid));
      if (!byBranch && !byAncestor) {
        return { ok: false, error: 'You can only manage content within your own branch', status: 403 };
      }
    }
  }

  return { ok: true, isGlobalAdmin: false };
}