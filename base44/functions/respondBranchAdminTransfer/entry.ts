import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { branch_id, action } = body || {};
    if (!branch_id || !action || !['accept', 'decline'].includes(action)) {
      return Response.json({ error: 'branch_id and action (accept|decline) are required' }, { status: 400 });
    }

    const branch = await base44.asServiceRole.entities.Branch.get(branch_id);
    if (!branch) return Response.json({ error: 'Branch not found' }, { status: 404 });
    const tr = branch.transfer_request;
    if (!tr || tr.status !== 'pending') {
      return Response.json({ error: 'There is no pending transfer invitation for this branch' }, { status: 400 });
    }
    if (tr.to_user_id !== user.id) {
      return Response.json({ error: 'Only the invited ancestor can respond to this invitation' }, { status: 403 });
    }

    const respondedAt = new Date().toISOString();
    if (action === 'accept') {
      await base44.asServiceRole.entities.Branch.update(branch_id, {
        admin_user_id: user.id,
        is_claimed: true,
        transfer_request: { ...tr, status: 'accepted', responded_at: respondedAt },
      });
      return Response.json({ ok: true, action: 'accepted', branch_name: branch.name });
    } else {
      await base44.asServiceRole.entities.Branch.update(branch_id, {
        transfer_request: { ...tr, status: 'declined', responded_at: respondedAt },
      });
      return Response.json({ ok: true, action: 'declined' });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});