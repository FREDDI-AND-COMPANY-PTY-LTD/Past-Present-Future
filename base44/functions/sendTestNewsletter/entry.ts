import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeDescendants, generateBranchChronicle, escapeHtml } from '../../shared/newsletterGeneration.ts';

function chronicleHtml(branchName, story, items, origin) {
  const sections = (story.sections || []).map(s => `
    <h2 style="color:#F5ECD7;font-size:18px;margin:24px 0 8px;">${escapeHtml(s.subheading)}</h2>
    <p style="color:#F5ECD7;font-size:15px;line-height:1.8;margin:0 0 16px;">${escapeHtml(s.body)}</p>`).join('');
  const itemList = items.length > 0
    ? `<div style="margin-top:20px;"><p style="color:#C9913A;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 10px;">This week's discoveries</p>${items.slice(0, 12).map(i => `<a href="${origin}/content/${i.id}" target="freddi_archive" rel="noopener noreferrer" style="display:block;background:#0D0B0A;border:1px solid rgba(201,145,58,0.12);border-radius:6px;padding:10px 14px;margin-bottom:6px;text-decoration:none;color:#F5ECD7;font-size:14px;">${escapeHtml(i.title || 'Untitled')} <span style="color:#C9913A;font-size:11px;float:right;">View &rarr;</span></a>`).join('')}</div>`
    : '';
  return `
  <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.2);border-radius:10px;padding:24px;margin-bottom:20px;">
    <p style="color:#C9913A;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 6px;">${escapeHtml(branchName)}</p>
    <h1 style="color:#F5ECD7;font-size:22px;margin:0 0 10px;line-height:1.3;">${escapeHtml(story.headline)}</h1>
    <p style="color:#F5ECD7;font-size:15px;line-height:1.8;margin:0 0 16px;font-style:italic;">${escapeHtml(story.intro)}</p>
    ${sections}
    <p style="color:#F5ECD7;font-size:15px;line-height:1.8;margin:16px 0 0;font-style:italic;">${escapeHtml(story.closing || '')}</p>
    ${itemList}
  </div>`;
}

// Test utility: generates a chronicle for the past N days (default 7) per branch and
// emails it to the requesting admin only. Does NOT persist Newsletter records or
// email other members — safe to run on demand.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const days = Number(body.days) > 0 ? Number(body.days) : 7;
    const toEmail = (body.to_email || '').trim().toLowerCase();

    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    const recipient = toEmail || user?.email;
    if (!recipient) {
      return Response.json({ error: 'No recipient email (pass to_email or invoke as a logged-in user)' }, { status: 400 });
    }

    const origin = (Deno.env.get('APP_PUBLIC_URL') || (() => { try { return new URL(req.url).origin; } catch { return ''; } })()).replace(/\/+$/, '');
    const since = new Date(Date.now() - days * 86400000);

    const [allItems, ancestors, branches, allComments] = await Promise.all([
      base44.asServiceRole.entities.ContentItem.list('-created_date', 300),
      base44.asServiceRole.entities.Ancestor.list(),
      base44.asServiceRole.entities.Branch.list(),
      base44.asServiceRole.entities.Comment.list('-created_date', 300),
    ]);

    const commentsByItem = {};
    for (const c of (allComments || [])) {
      if (c.entity_type === 'ContentItem' && c.entity_id) {
        if (!commentsByItem[c.entity_id]) commentsByItem[c.entity_id] = [];
        commentsByItem[c.entity_id].push({ author: c.author_name || 'Family Member', content: c.content, is_query: c.is_query });
      }
    }

    const windowLabel = `over the past ${days} days`;
    const chronicles = [];
    for (const branch of (branches || [])) {
      const descIds = computeDescendants(branch.ancestor_id, ancestors);
      const branchItems = (allItems || []).filter(item => {
        if (!item.created_date || new Date(item.created_date) < since) return false;
        if (item.branch_id === branch.id) return true;
        return (item.ancestor_ids || []).some(aid => descIds.has(aid));
      });
      if (branchItems.length === 0) continue;
      const story = await generateBranchChronicle(base44, branch, branchItems, ancestors, commentsByItem, windowLabel);
      chronicles.push({ branch, story, items: branchItems });
    }

    if (chronicles.length === 0) {
      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0B0A;font-family:Georgia,serif;"><div style="max-width:600px;margin:0 auto;padding:32px 20px;"><p style="color:#C9913A;font-size:12px;letter-spacing:2px;text-transform:uppercase;">The Freddi Family Chronicle</p><h1 style="color:#F5ECD7;">No new discoveries in the past ${days} days</h1><p style="color:#F5ECD7;opacity:0.6;">This is a test chronicle. No branches had uploads in the selected window.</p></div></body></html>`;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: recipient, from_name: 'Freddi Family Chronicle',
        subject: `Test Chronicle — no new discoveries (past ${days} days)`,
        body: html,
      });
      return Response.json({ success: true, emailedTo: recipient, days, chronicles: [], note: 'No branches had items in the window.' });
    }

    const bodyHtml = chronicles.map(g => chronicleHtml(g.branch.name, g.story, g.items, origin)).join('');
    const totalItems = chronicles.reduce((a, g) => a + g.items.length, 0);
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D0B0A;font-family:Georgia,serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <p style="color:#C9913A;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">The Freddi Family Chronicle &bull; Test</p>
    <p style="color:#F5ECD7;opacity:0.5;font-size:13px;margin:0 0 24px;">Past ${days} days &bull; ${chronicles.length} branch${chronicles.length === 1 ? '' : 'es'} &bull; ${totalItems} new ${totalItems === 1 ? 'discovery' : 'discoveries'}</p>
    ${bodyHtml}
    <p style="color:#F5ECD7;opacity:0.3;font-size:11px;text-align:center;border-top:1px solid rgba(201,145,58,0.1);padding-top:20px;">This is a test chronicle generated on demand. It was not sent to other family members.</p>
  </div>
</body></html>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient, from_name: 'Freddi Family Chronicle',
      subject: `Test Freddi Family Chronicle — past ${days} days`,
      body: html,
    });

    return Response.json({
      success: true,
      emailedTo: recipient,
      days,
      chronicles: chronicles.map(g => ({ branch: g.branch.name, headline: g.story.headline, items: g.items.length })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}