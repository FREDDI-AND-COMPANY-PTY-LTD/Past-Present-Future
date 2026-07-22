// Shared branch-admin role explainer used by both the in-app intro overlay
// (BranchAdminOnboardingIntro) and the follow-up email sent at claim time.

export function getBranchAdminExplainer(branchName, userName, appUrl) {
  const first = userName ? String(userName).split(' ')[0] : null;
  const greeting = first ? `Hi ${first},` : 'Welcome,';
  const bullets = [
    'Approve or decline nominations from family members requesting to join your branch',
    "Invite new members directly — they'll nominate their tree relationship for your approval",
    "Edit and curate your branch's records, photos, and stories",
    "Manage your branch's monthly cloud backup (your branch's records only)",
  ];
  const closing = "Other family members can view your branch's content, but only approved members can add to it. Visitors receive no backup of your branch.";
  const dashboardPath = '/branch-admin';
  const dashboardUrl = appUrl ? `${appUrl}${dashboardPath}` : dashboardPath;
  const subject = `You're now Branch Admin of ${branchName}`;
  return { subject, greeting, branchName, bullets, closing, dashboardPath, dashboardUrl };
}

export function explainerToHtml(e) {
  const li = (e.bullets || []).map((b) => `<li style="margin-bottom:6px">${b}</li>`).join('');
  return `<div style="font-family:Georgia,serif;color:#F5ECD7;background:#0D0B0A;padding:24px;border:1px solid rgba(201,145,58,0.2);border-radius:8px;max-width:560px">
    <p style="margin:0 0 12px">${e.greeting}</p>
    <p style="margin:0 0 12px">You're now the <strong style="color:#C9913A">Branch Admin</strong> for the <strong>${e.branchName}</strong> branch. As the sole authority over this branch, you can:</p>
    <ul style="margin:0 0 12px;padding-left:20px">${li}</ul>
    <p style="margin:0 0 12px;color:rgba(245,236,215,0.7)">${e.closing}</p>
    <p style="margin:0 0 12px">Your <strong style="color:#C9913A">Branch Admin dashboard</strong> (sidebar &rarr; Branch Admin) is where you manage nominations, invitations, and branch-scoped review queues.</p>
    <p style="margin:12px 0 0"><a href="${e.dashboardUrl}" target="freddi_archive" style="color:#C9913A;text-decoration:none;font-weight:600">Open your Branch Admin dashboard &rarr;</a></p>
  </div>`;
}