import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { computeDescendants, generateBranchChronicle, generateMultiBranchIntro, teaserHtml, escapeHtml } from '../../shared/newsletterGeneration.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Scheduled runs receive req.url from the backend dispatcher (not the app),
    // so links built from new URL(req.url).origin point at the function host and
    // fail with "invalid dispatcher secret". Prefer the configured public URL.
    const origin = (Deno.env.get('APP_PUBLIC_URL') || (() => { try { return new URL(req.url).origin; } catch { return ''; } })()).replace(/\/+$/, '');

    const now = new Date();
    const monthName = now.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    // Monday of the current week for weekly labels
    const monday = new Date(now);
    const dow = (now.getDay() + 6) % 7; // 0 = Monday
    monday.setDate(now.getDate() - dow);
    const weekLabel = `Week of ${monday.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const [allItems, ancestors, branches, allComments, allInvites, existingNewsletters, users] = await Promise.all([
      base44.asServiceRole.entities.ContentItem.list('-created_date', 300),
      base44.asServiceRole.entities.Ancestor.list(),
      base44.asServiceRole.entities.Branch.list(),
      base44.asServiceRole.entities.Comment.list('-created_date', 300),
      base44.asServiceRole.entities.BranchInvite.list('-created_date', 300),
      base44.asServiceRole.entities.Newsletter.list('-created_date', 200),
      base44.asServiceRole.entities.User.list(),
    ]);

    // Index comments by content item
    const commentsByItem = {};
    for (const c of (allComments || [])) {
      if (c.entity_type === 'ContentItem' && c.entity_id) {
        if (!commentsByItem[c.entity_id]) commentsByItem[c.entity_id] = [];
        commentsByItem[c.entity_id].push({ author: c.author_name || 'Family Member', content: c.content, is_query: c.is_query });
      }
    }

    // Generate a distinct chronicle per branch
    const generated = []; // { newsletter, branch, story, items }
    for (const branch of (branches || [])) {
      const freq = branch.newsletter_frequency === 'weekly' ? 'weekly' : 'monthly';
      const windowDays = freq === 'weekly' ? 7 : 30;
      const since = new Date(now.getTime() - windowDays * 86400000);

      // Cadence dedupe: skip if a chronicle for this branch already exists within the cadence window
      const tooRecent = (existingNewsletters || []).some(n =>
        n.branch_id === branch.id && n.created_date &&
        new Date(n.created_date) > new Date(now.getTime() - (windowDays - 1) * 86400000)
      );
      if (tooRecent) continue;

      const descIds = computeDescendants(branch.ancestor_id, ancestors);
      const branchItems = (allItems || []).filter(item => {
        if (!item.created_date || new Date(item.created_date) < since) return false;
        if (item.branch_id === branch.id) return true;
        return (item.ancestor_ids || []).some(aid => descIds.has(aid));
      });
      if (branchItems.length === 0) continue;

      const story = await generateBranchChronicle(base44, branch, branchItems, ancestors, commentsByItem);

      const photoUrls = branchItems
        .filter(item => item.file_url && (item.content_type === 'photo' || item.content_type === 'press_clipping'))
        .slice(0, 6)
        .map(i => i.file_url);

      const newsletter = await base44.asServiceRole.entities.Newsletter.create({
        headline: story.headline,
        intro: story.intro,
        sections: story.sections || [],
        closing: story.closing,
        month_label: freq === 'weekly' ? weekLabel : monthName,
        item_count: branchItems.length,
        featured_item_ids: branchItems.map(i => i.id),
        photo_urls: photoUrls,
        branch_id: branch.id,
        branch_name: branch.name,
        frequency: freq,
      });
      generated.push({ newsletter, branch, story, items: branchItems });
    }

    // Per-member personalised delivery — one email per member integrating their branches
    const optedIn = (users || []).filter(u => u.newsletter_opt_in === true && u.email);
    let emailsSent = 0;

    for (const user of optedIn) {
      const myBranchIds = new Set((branches || []).filter(b => b.admin_user_id === user.id).map(b => b.id));
      (allInvites || []).forEach(inv => {
        if (inv.status === 'approved' && inv.registered_user_id === user.id) myBranchIds.add(inv.branch_id);
      });
      const mine = generated.filter(g => myBranchIds.has(g.branch.id));
      if (mine.length === 0) continue;

      if (mine.length === 1) {
        const g = mine[0];
        const nlUrl = `${origin}/newsletter/${g.newsletter.id}`;
        const teaser = (g.story.intro || '').substring(0, 220);
        const itemListHtml = (g.items || []).slice(0, 12).length > 0
          ? `<div style="margin-bottom:24px;"><p style="color:#C9913A;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">${escapeHtml(g.branch.name)} — this period's discoveries</p>${g.items.slice(0, 12).map(i => `<a href="${origin}/content/${i.id}" target="freddi_archive" rel="noopener noreferrer" style="display:block;background:#1A1614;border:1px solid rgba(201,145,58,0.12);border-radius:6px;padding:12px 14px;margin-bottom:8px;text-decoration:none;color:#F5ECD7;font-size:14px;">${escapeHtml(i.title || 'Untitled')} <span style="color:#C9913A;font-size:11px;float:right;">View &rarr;</span></a>`).join('')}</div>`
          : '';
        const html = teaserHtml({
          headline: g.story.headline,
          body: teaser,
          periodLabel: `${g.branch.name} \u2014 ${g.newsletter.month_label}`,
          itemCount: g.items.length,
          ctaUrl: nlUrl,
          ctaLabel: 'Read the full chronicle',
          itemListHtml,
        });
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email, from_name: 'Freddi Family Chronicle',
          subject: `${g.branch.name} — The Freddi Family Chronicle: ${g.story.headline}`,
          body: html,
        });
      } else {
        // Multi-branch: AI-integrated personal opening, then each branch's chronicle teaser + link
        const unifyingIntro = await generateMultiBranchIntro(base44, user, mine);
        const branchBlocks = mine.map(g => {
          const nlUrl = `${origin}/newsletter/${g.newsletter.id}`;
          const teaser = (g.story.intro || '').substring(0, 180);
          return `<div style="background:#1A1614;border:1px solid rgba(201,145,58,0.2);border-radius:8px;padding:18px 20px;margin-bottom:14px;">
            <p style="color:#C9913A;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 6px;">${escapeHtml(g.branch.name)}</p>
            <h2 style="color:#F5ECD7;font-size:18px;margin:0 0 8px;">${escapeHtml(g.story.headline)}</h2>
            <p style="color:#F5ECD7;opacity:0.7;font-size:14px;line-height:1.7;margin:0 0 12px;font-style:italic;">${escapeHtml(teaser)}</p>
            <a href="${nlUrl}" target="freddi_archive" rel="noopener noreferrer" style="color:#C9913A;font-size:13px;font-weight:600;text-decoration:none;">Read the ${escapeHtml(g.branch.name)} chronicle &rarr;</a>
          </div>`;
        }).join('');
        const first = (user.full_name || 'there').split(' ')[0];
        const html = teaserHtml({
          headline: `${first}, your branches have new chronicles`,
          body: `${unifyingIntro}`,
          periodLabel: `Combined digest \u2014 ${mine.length} branches`,
          itemCount: mine.reduce((a, g) => a + g.items.length, 0),
          ctaUrl: `${origin}/newsletters`,
          ctaLabel: 'Browse all chronicles',
          itemListHtml: `<div style="margin-bottom:8px;">${branchBlocks}</div>`,
        });
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email, from_name: 'Freddi Family Chronicle',
          subject: `Your Freddi Family Chronicle — ${mine.length} branches this period`,
          body: html,
        });
      }
      emailsSent++;
    }

    return Response.json({
      success: true,
      branchesProcessed: generated.length,
      chronicles: generated.map(g => ({ branch: g.branch.name, headline: g.story.headline, items: g.items.length })),
      emailsSent,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});