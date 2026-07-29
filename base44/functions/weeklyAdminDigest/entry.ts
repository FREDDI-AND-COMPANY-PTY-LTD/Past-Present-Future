import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch admin users
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');
    if (admins.length === 0) {
      return Response.json({ error: 'No admin users found' }, { status: 404 });
    }

    // Fetch all admin tasks
    const [openProblems, inProgressProblems, openFlags, allUploads] = await Promise.all([
      base44.asServiceRole.entities.ProblemReport.filter({ status: 'open' }, '-created_date', 50),
      base44.asServiceRole.entities.ProblemReport.filter({ status: 'in_progress' }, '-created_date', 50),
      base44.asServiceRole.entities.ConflictFlag.filter({ status: 'open' }, '-created_date', 50),
      base44.asServiceRole.entities.ContentItem.list('-created_date', 50),
    ]);

    const pendingUploads = (allUploads || []).filter(
      u => !u.review_status || u.review_status === 'pending'
    );

    const allProblems = [...(openProblems || []), ...(inProgressProblems || [])];
    const totalTasks = allProblems.length + (openFlags || []).length + pendingUploads.length;

    const dateStr = new Date().toLocaleDateString('en-AU', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Scheduled runs receive req.url from the backend dispatcher (not the app),
    // so prefer the configured public URL for in-app links.
    const origin = (Deno.env.get('APP_PUBLIC_URL') || new URL(req.url).origin).replace(/\/+$/, '');
    const html = buildEmailHtml(dateStr, openProblems || [], inProgressProblems || [], openFlags || [], pendingUploads, totalTasks, origin);

    const subject = `Weekly Admin Digest — Freddi Ancestry Archive (${totalTasks} task${totalTasks !== 1 ? 's' : ''})`;

    for (const admin of admins) {
      if (!admin.email) continue;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        from_name: 'Freddi Ancestry Archive',
        subject,
        body: html,
      });
    }

    return Response.json({
      success: true,
      adminsEmailed: admins.length,
      totalTasks,
      problems: allProblems.length,
      approvals: (openFlags || []).length,
      pendingUploads: pendingUploads.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildEmailHtml(dateStr, openProblems, inProgressProblems, conflicts, uploads, totalTasks, origin) {
  const problemSection = (openProblems.length > 0 || inProgressProblems.length > 0)
    ? renderSection('1', 'Problem Reports', `${openProblems.length} open, ${inProgressProblems.length} in progress`,
        [...openProblems, ...inProgressProblems].map(p =>
          renderItem(p.title || 'Untitled', p.description, [
            `Status: ${p.status}`,
            `Reported by: ${p.reported_by_name || 'Unknown'}`,
            p.admin_response ? `Admin note: ${p.admin_response}` : null,
          ], `${origin}/admin`)
        )
      )
    : renderEmptySection('1', 'Problem Reports', 'No open problem reports.');

  const approvalSection = conflicts.length > 0
    ? renderSection('2', 'Pending Approvals (Conflict Flags)', `${conflicts.length} awaiting review`,
        conflicts.map(c =>
          renderItem(c.dispute_description || 'No description', null, [
            c.field_name ? `Field: ${c.field_name.replace(/_/g, ' ')}` : null,
            c.bloodline ? `Bloodline: ${c.bloodline}` : null,
          ], c.content_item_id ? `${origin}/content/${c.content_item_id}` : (c.ancestor_id ? `${origin}/ancestor/${c.ancestor_id}` : `${origin}/admin`))
        )
      )
    : renderEmptySection('2', 'Pending Approvals (Conflict Flags)', 'No conflict flags awaiting approval.');

  const uploadSection = uploads.length > 0
    ? renderSection('3', 'Uploads to Review', `${uploads.length} pending review`,
        uploads.map(u =>
          renderItem(u.title || 'Untitled', u.description, [
            `Type: ${u.content_type}`,
            `Uploaded: ${new Date(u.created_date).toLocaleDateString('en-AU')}`,
          ], `${origin}/content/${u.id}`)
        )
      )
    : renderEmptySection('3', 'Uploads to Review', 'No uploads pending review.');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D0B0A;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <p style="color:#C9913A;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">Freddi Ancestry Archive</p>
    <h1 style="color:#F5ECD7;font-size:26px;margin:0 0 4px;">Weekly Admin Digest</h1>
    <p style="color:#F5ECD7;opacity:0.5;font-size:14px;margin:0 0 32px;">${dateStr}</p>

    <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.2);border-radius:8px;padding:20px;margin-bottom:32px;">
      <p style="color:#E8C97A;font-size:13px;margin:0 0 8px;">YOUR WORKFLOW SEQUENCE</p>
      <p style="color:#F5ECD7;font-size:15px;margin:0 0 6px;">1. Review ${openProblems.length + inProgressProblems.length} problem report${(openProblems.length + inProgressProblems.length) !== 1 ? 's' : ''}</p>
      <p style="color:#F5ECD7;font-size:15px;margin:0 0 6px;">2. Approve ${conflicts.length} conflict flag${conflicts.length !== 1 ? 's' : ''}</p>
      <p style="color:#F5ECD7;font-size:15px;margin:0;">3. Review ${uploads.length} upload${uploads.length !== 1 ? 's' : ''} pending moderation</p>
    </div>

    ${problemSection}
    ${approvalSection}
    ${uploadSection}

    <p style="color:#F5ECD7;opacity:0.3;font-size:11px;text-align:center;margin-top:40px;border-top:1px solid rgba(201,145,58,0.1);padding-top:20px;">
      Total tasks: ${totalTasks} &bull; This is an automated weekly digest from the Freddi Ancestry Archive.
    </p>
  </div>
</body>
</html>`;
}

function renderSection(num, title, subtitle, items) {
  return `
    <div style="margin-bottom:28px;">
      <p style="color:#C9913A;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 2px;">TASK ${num}</p>
      <h2 style="color:#F5ECD7;font-size:18px;margin:0 0 2px;">${title}</h2>
      <p style="color:#F5ECD7;opacity:0.4;font-size:13px;margin:0 0 16px;">${subtitle}</p>
      ${items.join('')}
    </div>`;
}

function renderEmptySection(num, title, msg) {
  return `
    <div style="margin-bottom:28px;">
      <p style="color:#C9913A;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 2px;">TASK ${num}</p>
      <h2 style="color:#F5ECD7;font-size:18px;margin:0 0 4px;">${title}</h2>
      <p style="color:#F5ECD7;opacity:0.4;font-size:13px;margin:0;">${msg}</p>
    </div>`;
}

function renderItem(title, description, metaLines, href) {
  const meta = (metaLines || []).filter(m => m !== null && m !== undefined);
  const titleHtml = href
    ? `<a href="${href}" target="freddi_archive" rel="noopener noreferrer" style="display:block;color:#F5ECD7;font-size:14px;font-weight:bold;margin:0 0 4px;text-decoration:none;">${title} <span style="color:#C9913A;font-size:11px;font-weight:normal;">Review &rarr;</span></a>`
    : `<p style="color:#F5ECD7;font-size:14px;font-weight:bold;margin:0 0 4px;">${title}</p>`;
  return `
    <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.12);border-radius:6px;padding:14px;margin-bottom:8px;">
      ${titleHtml}
      ${description ? `<p style="color:#F5ECD7;opacity:0.6;font-size:13px;margin:0 0 6px;">${description}</p>` : ''}
      ${meta.length > 0 ? `<p style="color:#C9913A;font-size:12px;margin:0;">${meta.join(' &bull; ')}</p>` : ''}
    </div>`;
}