import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Breadth-first descendants of a branch root, following mother_id / father_id (+ partners)
function computeDescendants(rootId, ancestors) {
  const byId = new Map((ancestors || []).map(a => [a.id, a]));
  const ids = new Set(rootId ? [rootId] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of (ancestors || [])) {
      if (ids.has(a.id)) continue;
      if ((a.mother_id && ids.has(a.mother_id)) || (a.father_id && ids.has(a.father_id))) {
        ids.add(a.id); changed = true;
      }
    }
  }
  for (const a of (ancestors || [])) {
    if (ids.has(a.id) && a.partner_id) ids.add(a.partner_id);
  }
  return ids;
}

// Build a rich, context-laden summary block per item (same editorial inputs as before,
// but scoped to a single branch's items)
function buildItemSummaries(items, ancestors, commentsByItem) {
  return items.map((item, i) => {
    const date = new Date(item.created_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const taggedAncestors = (item.ancestor_ids || [])
      .map(aid => ancestors.find(a => a.id === aid))
      .filter(Boolean)
      .map(a => {
        const bio = [];
        if (a.full_name) bio.push(`Name: ${a.full_name}`);
        if (a.birth_date) bio.push(`Born: ${a.birth_date}`);
        if (a.birth_place) bio.push(`Birthplace: ${a.birth_place}`);
        if (a.death_date) bio.push(`Died: ${a.death_date}`);
        if (a.nationality) bio.push(`Nationality: ${a.nationality}`);
        if (a.biography) bio.push(`Bio: ${a.biography}`);
        return bio.join(', ');
      }).join(' | ');

    const comments = commentsByItem[item.id] || [];
    const commentText = comments.length > 0
      ? comments.map(c => `    - ${c.author}${c.is_query ? ' (query)' : ''}: "${c.content}"`).join('\n')
      : '';

    const parts = [
      `${i + 1}. [${item.content_type}] "${item.title}"`,
      `   Description: ${item.description || 'no description'}`,
      `   Added: ${date}${item.location_name ? ', location: ' + item.location_name : ''}`,
      `   Era: ${item.era || 'unknown'}`,
    ];
    if (taggedAncestors) parts.push(`   Tagged Ancestor(s): ${taggedAncestors}`);
    const ne = item.narrative_extraction;
    if (ne && (ne.event_description || ne.chronicle_snippet)) {
      if (ne.event_date_display) parts.push(`   Event Date (narrative): ${ne.event_date_display}`);
      if (ne.event_description) parts.push(`   Event Description: ${ne.event_description}`);
      if (ne.event_type) parts.push(`   Event Type: ${ne.event_type}`);
      if (ne.named_people && ne.named_people.length > 0) {
        parts.push(`   Named People: ${ne.named_people.map(p => p.name + (p.role ? ` (${p.role})` : '')).join(', ')}`);
      }
      if (ne.named_places && ne.named_places.length > 0) {
        parts.push(`   Named Places: ${ne.named_places.map(p => p.place + (p.context ? ` (${p.context})` : '')).join(', ')}`);
      }
      if (ne.chronicle_snippet) parts.push(`   ⚡ Chronicle Snippet: ${ne.chronicle_snippet}`);
    }
    if (item.publication_date || item.publication_location_name) {
      parts.push(`   Issued/Published: ${item.publication_date || ''}${item.publication_date && item.publication_location_name ? ', ' : ''}${item.publication_location_name || ''}`);
    }
    if (item.historical_background) parts.push(`   ⚡ AI-Researched Historical Background: ${item.historical_background.substring(0, 600)}`);
    if (item.transcribed_text) parts.push(`   Transcribed Text: ${item.transcribed_text.substring(0, 500)}`);
    if (commentText) parts.push(`   Family Discussion:\n${commentText}`);
    return parts.join('\n');
  }).join('\n\n');
}

// Branch-scoped chronicle generation
async function generateBranchChronicle(base44, branch, items, ancestors, commentsByItem) {
  const itemSummaries = buildItemSummaries(items, ancestors, commentsByItem);
  const story = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are the editor-in-chief of "The Freddi Family Chronicle," a chronicle for the Freddi family. Write an engaging, warm, and deeply contextual news story summarising the following discoveries and uploads from the ${branch.name} branch this period.

CRITICAL INSTRUCTION: For each event, use the uploader's historical context, family comments, and the tagged ancestor's biographical data to understand the BROADER SIGNIFICANCE of the event. Research the historical period, migration patterns, social conditions, and world events that shaped this ancestor's experience. Weave this wider context into the narrative so family members understand not just WHAT was uploaded, but WHY it matters in the arc of their family's history.

Write it as if you are a historian-journalist telling the story of what the ${branch.name} branch discovered this period — like a rich newspaper feature article that connects personal artifacts to the grand sweep of history. Use a warm, cinematic, archival tone. Address the reader as a family member.

Include:
1. A compelling headline
2. A short opening paragraph (2-3 sentences) that hooks the reader with the theme of the period's discoveries
3. 1-2 body sections, each covering a grouping of related items, with section subheadings. Keep each section to 3-4 sentences, weaving together the personal item with its broader historical context.
4. A short closing sentence reflecting on the growing archive and inviting members to contribute

Reference specific items by name where it makes the story richer. Use the uploader's historical context and family comments as primary sources. Use evocative, storytelling language — not dry summaries.

Here are the items added this period for the ${branch.name} branch (with full context):
${itemSummaries}

Return your response as JSON with this structure:
{ "headline": "...", "intro": "...", "sections": [ { "subheading": "...", "body": "..." } ], "closing": "..." }`,
    model: 'gemini_3_flash',
    add_context_from_internet: true,
    response_json_schema: {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        intro: { type: 'string' },
        sections: { type: 'array', items: { type: 'object', properties: { subheading: { type: 'string' }, body: { type: 'string' } } } },
        closing: { type: 'string' },
      },
    },
  });
  return story;
}

// A short, warm, AI-written unifying intro for a member who belongs to several branches —
// weaves their branches' chronicle headlines into one personal opening.
async function generateMultiBranchIntro(base44, user, branchChronicles) {
  const lines = branchChronicles.map(g => `${g.branch.name}: "${g.story.headline}"`).join('\n');
  const first = (user?.full_name || 'there').split(' ')[0];
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Write a warm, personal 2-3 sentence greeting to ${first}, a member of the Freddi family archive who belongs to several branches. This period each of their branches has a new chronicle. Weave the headlines below into a single opening that acknowledges their place across these lines and invites them to read on. Address them by first name. Plain prose, no headings.

${lines}`,
    model: 'gemini_3_flash',
  });
  return typeof result === 'string' ? result : (result?.text || result?.response || '');
}

function teaserHtml({ preheader, headline, body, periodLabel, itemCount, ctaUrl, ctaLabel, itemListHtml, accent }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D0B0A;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <p style="color:#C9913A;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">The Freddi Family Chronicle</p>
    <h1 style="color:#F5ECD7;font-size:24px;margin:0 0 4px;line-height:1.3;">${escapeHtml(headline)}</h1>
    <p style="color:#F5ECD7;opacity:0.5;font-size:13px;margin:0 0 24px;">${escapeHtml(periodLabel)}${itemCount > 0 ? ' &bull; ' + itemCount + ' new ' + (itemCount === 1 ? 'discovery' : 'discoveries') : ''}</p>
    ${preheader ? `<div style="background:#1A1614;border-left:3px solid #C9913A;border:1px solid rgba(201,145,58,0.15);border-radius:8px;padding:16px 18px;margin-bottom:20px;"><p style="color:#F5ECD7;font-size:15px;line-height:1.7;margin:0;font-style:italic;">${escapeHtml(preheader)}</p></div>` : ''}
    <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.2);border-radius:8px;padding:24px;margin-bottom:24px;">
      <p style="color:#F5ECD7;font-size:15px;line-height:1.8;margin:0 0 16px;font-style:italic;">${escapeHtml(body)}</p>
      <a href="${escapeHtml(ctaUrl)}" target="freddi_archive" rel="noopener noreferrer" style="display:inline-block;background:#C9913A;color:#0D0B0A;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">${escapeHtml(ctaLabel)} &rarr;</a>
    </div>
    ${itemListHtml || ''}
    <p style="color:#F5ECD7;opacity:0.3;font-size:11px;text-align:center;border-top:1px solid rgba(201,145,58,0.1);padding-top:20px;">This is an automated chronicle from the Freddi Ancestry Archive.</p>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const origin = (() => { try { return new URL(req.url).origin; } catch { return ''; } })();

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