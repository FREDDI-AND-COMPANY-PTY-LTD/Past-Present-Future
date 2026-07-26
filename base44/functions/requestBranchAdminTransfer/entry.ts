import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildTransferEmail({ fromName, toName, branchName, appUrl, message }) {
  const home = appUrl || '/';
  const first = toName ? String(toName).split(' ')[0] : 'there';
  const bullets = [
    'Approve or decline nominations from family members requesting to join your branch',
    "Invite new members directly — they'll nominate their tree relationship for your approval",
    "Edit and curate your branch's records, photos, and stories",
    "Manage your branch's monthly cloud backup (your branch's records only)",
  ];
  const li = bullets.map((b) => `<li style="margin-bottom:6px">${b}</li>`).join('');
  const messageLine = message
    ? `<p style="margin:0 0 16px;color:rgba(245,236,215,0.85);font-style:italic;padding:12px 16px;background:#1A1614;border-left:3px solid #C9913A;border-radius:4px;">${escapeHtml(message)}</p>`
    : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D0B0A;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <p style="color:#C9913A;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">The Freddi Family Archive</p>
    <h1 style="color:#F5ECD7;font-size:26px;margin:0 0 4px;">An invitation to protect ${escapeHtml(branchName)}</h1>
    <p style="color:#F5ECD7;opacity:0.5;font-size:13px;margin:0 0 28px;letter-spacing:1px;">Present &bull; Past &bull; Future</p>

    <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.2);border-radius:8px;padding:24px;margin-bottom:24px;">
      <p style="color:#F5ECD7;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${escapeHtml(first)},</p>
      <p style="color:#F5ECD7;font-size:15px;line-height:1.7;margin:0 0 16px;">
        <strong style="color:#C9913A">${escapeHtml(fromName)}</strong>, the current Branch Admin of the
        <strong>${escapeHtml(branchName)}</strong> branch, has invited you to take on the Branch Admin role.
      </p>
      <p style="color:#F5ECD7;font-size:15px;line-height:1.7;margin:0 0 16px;">
        By the principle that the eldest male in the line protects the archive, this role naturally belongs to you.
        ${escapeHtml(fromName)} registered first and has held the role as a placeholder until a senior member of the bloodline joined.
      </p>
      ${messageLine}
      <p style="color:#C9913A;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">Your role &amp; responsibilities</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#F5ECD7;font-size:14px;line-height:1.6;">${li}</ul>
      <p style="color:rgba(245,236,215,0.7);font-size:13px;line-height:1.6;margin:0 0 16px;">
        The bloodline data belongs to everyone in the bloodline &mdash; any registered member may always export a copy.
        As Branch Admin you are its steward: the sole authority over who can add to it, and the one who safeguards it for the next generation.
      </p>
      <a href="${escapeHtml(home)}" target="freddi_archive" rel="noopener noreferrer" style="display:inline-block;background:#C9913A;color:#0D0B0A;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">Open the archive to accept &rarr;</a>
      <p style="color:rgba(245,236,215,0.5);font-size:12px;line-height:1.5;margin:14px 0 0;">
        When you sign in, you'll see the invitation at the top of the archive with options to accept or decline.
        If you decline, ${escapeHtml(fromName)} will remain the Branch Admin.
      </p>
    </div>

    <p style="color:#C9913A;font-size:13px;margin:0 0 4px;">&mdash; The Freddi Family Archive</p>
    <p style="color:#F5ECD7;opacity:0.3;font-size:11px;text-align:center;border-top:1px solid rgba(201,145,58,0.1);padding-top:20px;">This is an automated message from the Freddi Family Archive.</p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { branch_id, to_ancestor_id, app_url, message } = body || {};
    if (!branch_id || !to_ancestor_id) {
      return Response.json({ error: 'branch_id and to_ancestor_id are required' }, { status: 400 });
    }

    const branch = await base44.asServiceRole.entities.Branch.get(branch_id);
    if (!branch) return Response.json({ error: 'Branch not found' }, { status: 404 });
    if (branch.admin_user_id !== user.id) {
      return Response.json({ error: 'Only the current branch admin can propose a transfer' }, { status: 403 });
    }

    const target = await base44.asServiceRole.entities.Ancestor.get(to_ancestor_id);
    if (!target) return Response.json({ error: 'Target ancestor not found' }, { status: 404 });
    if (!target.user_account_id) {
      return Response.json({ error: 'That ancestor has not registered an account yet' }, { status: 400 });
    }
    if (target.user_account_id === user.id) {
      return Response.json({ error: 'You are already the branch admin of this branch' }, { status: 400 });
    }
    if (target.sex && target.sex !== 'male') {
      return Response.json({ error: 'By branch principle, the admin devolves upon the eldest male in the line' }, { status: 400 });
    }
    if (target.living === false) {
      return Response.json({ error: 'The successor must be a living ancestor' }, { status: 400 });
    }

    const targetUsers = await base44.asServiceRole.entities.User.filter({ id: target.user_account_id });
    const targetUser = (targetUsers || [])[0];
    if (!targetUser || !targetUser.email) {
      return Response.json({ error: 'Could not resolve the invited member\u2019s email' }, { status: 400 });
    }

    const invitedAt = new Date().toISOString();
    await base44.asServiceRole.entities.Branch.update(branch_id, {
      transfer_request: {
        to_user_id: target.user_account_id,
        to_user_name: targetUser.full_name || target.full_name || targetUser.email,
        to_ancestor_id: target.id,
        to_ancestor_name: target.full_name,
        from_user_id: user.id,
        from_user_name: user.full_name || user.email,
        status: 'pending',
        invited_at: invitedAt,
        message: (message || '').slice(0, 1000),
      },
    });

    const html = buildTransferEmail({
      fromName: user.full_name || user.email,
      toName: targetUser.full_name || target.full_name,
      branchName: branch.name,
      appUrl: app_url || '',
      message: message || '',
    });
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: targetUser.email,
        subject: `You\u2019re invited to become Branch Admin of ${branch.name}`,
        body: html,
        from_name: 'Freddi Family Archive',
      });
    } catch (emailErr) {
      // The transfer request is recorded even if the email fails; the in-app banner still reaches them.
      return Response.json({ ok: true, transfer_request: { to_ancestor_name: target.full_name, status: 'pending' }, email_warning: String(emailErr?.message || emailErr) });
    }

    return Response.json({ ok: true, transfer_request: { to_ancestor_name: target.full_name, status: 'pending' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});