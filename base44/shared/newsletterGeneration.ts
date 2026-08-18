// Shared chronicle-generation helpers used by the scheduled monthlyNewsletter
// job and the on-demand sendTestNewsletter utility. Plain module — no handler.

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Breadth-first descendants of a branch root, following mother_id / father_id (+ partners)
export function computeDescendants(rootId, ancestors) {
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

// Build a rich, context-laden summary block per item (editorial inputs for the LLM)
export function buildItemSummaries(items, ancestors, commentsByItem) {
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
export async function generateBranchChronicle(base44, branch, items, ancestors, commentsByItem, windowLabel = 'this period') {
  const itemSummaries = buildItemSummaries(items, ancestors, commentsByItem);
  const story = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are the editor-in-chief of "The Freddi Family Chronicle," a chronicle for the Freddi family. Write an engaging, warm, and deeply contextual news story summarising the following discoveries and uploads from the ${branch.name} branch ${windowLabel}.

CRITICAL INSTRUCTION: For each event, use the uploader's historical context, family comments, and the tagged ancestor's biographical data to understand the BROADER SIGNIFICANCE of the event. Research the historical period, migration patterns, social conditions, and world events that shaped this ancestor's experience. Weave this wider context into the narrative so family members understand not just WHAT was uploaded, but WHY it matters in the arc of their family's history.

Write it as if you are a historian-journalist telling the story of what the ${branch.name} branch discovered ${windowLabel} — like a rich newspaper feature article that connects personal artifacts to the grand sweep of history. Use a warm, cinematic, archival tone. Address the reader as a family member.

Include:
1. A compelling headline
2. A short opening paragraph (2-3 sentences) that hooks the reader with the theme of the period's discoveries
3. 1-2 body sections, each covering a grouping of related items, with section subheadings. Keep each section to 3-4 sentences, weaving together the personal item with its broader historical context.
4. A short closing sentence reflecting on the growing archive and inviting members to contribute

Reference specific items by name where it makes the story richer. Use the uploader's historical context and family comments as primary sources. Use evocative, storytelling language — not dry summaries.

Here are the items added ${windowLabel} for the ${branch.name} branch (with full context):
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

// A short, warm, AI-written unifying intro for a member who belongs to several branches
export async function generateMultiBranchIntro(base44, user, branchChronicles) {
  const lines = branchChronicles.map(g => `${g.branch.name}: "${g.story.headline}"`).join('\n');
  const first = (user?.full_name || 'there').split(' ')[0];
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Write a warm, personal 2-3 sentence greeting to ${first}, a member of the Freddi family archive who belongs to several branches. This period each of their branches has a new chronicle. Weave the headlines below into a single opening that acknowledges their place across these lines and invites them to read on. Address them by first name. Plain prose, no headings.

${lines}`,
    model: 'gemini_3_flash',
  });
  return typeof result === 'string' ? result : (result?.text || result?.response || '');
}

export function teaserHtml({ preheader, headline, body, periodLabel, itemCount, ctaUrl, ctaLabel, itemListHtml, accent }) {
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