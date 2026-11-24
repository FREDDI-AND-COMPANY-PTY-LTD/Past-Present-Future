// Shared guard + branch scoping for the review lifecycle functions
// (getReviewQueue, resolveReviewItem). Mirrors the branch scoping used by
// BranchAdminDashboard: branches the caller administers (by Branch.admin_user_id
// or User.data.admin_branch_ids), their descendant ancestors, and the content
// tagged to either.

export async function requireReviewer(base44) {
  const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
  if (!user) return { error: 'Unauthorized', status: 401 };

  const branches = await base44.asServiceRole.entities.Branch.list().catch(() => []);
  const myBranches = (branches || []).filter((b) => b.admin_user_id && b.admin_user_id === user.id);
  const adminBranchIds = new Set([
    ...(user.data?.admin_branch_ids || []),
    ...myBranches.map((b) => b.id),
  ]);
  const isGlobalAdmin = user.role === 'admin';

  if (!isGlobalAdmin && adminBranchIds.size === 0) {
    return { error: 'Admin or branch admin access required', status: 403 };
  }

  const [ancestors, items] = await Promise.all([
    base44.asServiceRole.entities.Ancestor.list('-created_date', 500).catch(() => []),
    base44.asServiceRole.entities.ContentItem.list('-created_date', 500).catch(() => []),
  ]);

  const rootIds = myBranches.map((b) => b.ancestor_id).filter(Boolean);
  const ancestorIds = new Set(rootIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of (ancestors || [])) {
      if (ancestorIds.has(a.id)) continue;
      if ((a.mother_id && ancestorIds.has(a.mother_id)) || (a.father_id && ancestorIds.has(a.father_id))) {
        ancestorIds.add(a.id);
        changed = true;
      }
    }
  }
  for (const a of (ancestors || [])) {
    if (ancestorIds.has(a.id) && a.partner_id) ancestorIds.add(a.partner_id);
  }
  for (const a of (ancestors || [])) {
    if (a.branch_id && adminBranchIds.has(a.branch_id)) ancestorIds.add(a.id);
  }

  const contentItems = (items || []).filter((i) =>
    (i.branch_id && adminBranchIds.has(i.branch_id)) ||
    (i.ancestor_ids || []).some((aid) => ancestorIds.has(aid))
  );

  return {
    user,
    isGlobalAdmin,
    adminBranchIds,
    ancestorIds,
    ancestors: ancestors || [],
    items: items || [],
    contentItemIds: new Set(contentItems.map((i) => i.id)),
  };
}