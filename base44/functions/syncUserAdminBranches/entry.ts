import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { user_id } = body || {};
    if (!user_id) return Response.json({ error: 'user_id is required' }, { status: 400 });

    // Recompute the user's admin_branch_ids from the Branch table (source of truth).
    // Called whenever a branch is claimed or transferred, so RLS rules that gate
    // writes by branch_id always reflect the current admin.
    const branches = await base44.asServiceRole.entities.Branch.filter({ admin_user_id: user_id });
    const adminBranchIds = (branches || []).map(b => b.id);

    await base44.asServiceRole.entities.User.update(user_id, { admin_branch_ids: adminBranchIds });

    return Response.json({ ok: true, user_id, admin_branch_ids: adminBranchIds });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}