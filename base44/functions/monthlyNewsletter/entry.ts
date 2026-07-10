import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const monthName = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

    // Calculate date range: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch content items from the last 30 days
    const allItems = await base44.asServiceRole.entities.ContentItem.list('-created_date', 200);
    const monthlyItems = (allItems || []).filter(item => {
      const itemDate = new Date(item.created_date);
      return itemDate >= thirtyDaysAgo;
    });

    const featuredIds = monthlyItems.map(i => i.id);
    const photoUrls = monthlyItems
      .filter(item => item.file_url && (item.content_type === 'photo' || item.content_type === 'press_clipping'))
      .slice(0, 6)
      .map(i => i.file_url);

    let story = null;
    let itemCount = monthlyItems.length;

    if (monthlyItems.length > 0) {
      // Fetch ancestors so we can include biographical context
      const ancestors = await base44.asServiceRole.entities.Ancestor.list();

      // Fetch comments for each featured item so the AI can learn from
      // family discussions, queries, and shared memories
      const allComments = await base44.asServiceRole.entities.Comment.list('-created_date', 200);
      const commentsByItem = {};
      for (const c of (allComments || [])) {
        if (c.entity_type === 'ContentItem' && c.entity_id) {
          if (!commentsByItem[c.entity_id]) commentsByItem[c.entity_id] = [];
          commentsByItem[c.entity_id].push({
            author: c.author_name || 'Family Member',
            content: c.content,
            is_query: c.is_query,
          });
        }
      }

      // Build rich summaries including historical context, comments, and ancestor data
      const itemSummaries = monthlyItems.map((item, i) => {
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
            if (a.occupation) bio.push(`Occupation: ${a.occupation}`);
            if (a.biography) bio.push(`Bio: ${a.biography}`);
            return bio.join(', ');
          })
          .join(' | ');

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
        if (item.historical_context) parts.push(`   ⚡ Uploader's Historical Context: ${item.historical_context}`);
        if (item.transcribed_text) parts.push(`   Transcribed Text: ${item.transcribed_text.substring(0, 500)}`);
        if (commentText) parts.push(`   Family Discussion:\n${commentText}`);
        return parts.join('\n');
      }).join('\n\n');

      // Use Gemini with web search so the AI can research wider historical
      // archives for relevant background on the events, places, and time periods
      story = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are the editor-in-chief of "The Freddi Family Chronicle," a monthly newsletter for the Freddi family. Write an engaging, warm, and deeply contextual news story summarising the following discoveries and uploads from the past month.

CRITICAL INSTRUCTION: For each event, use the uploader's historical context, family comments, and the tagged ancestor's biographical data to understand the BROADER SIGNIFICANCE of the event. Research the historical period, migration patterns, social conditions, and world events that shaped this ancestor's experience. Weave this wider context into the narrative so family members understand not just WHAT was uploaded, but WHY it matters in the arc of their family's history.

For example:
- If a military discharge certificate from WWI Italy appears, explain the broader context of Italian military service, the Alpine campaigns, and post-war emigration to Australia.
- If a passport from 1921 appears, discuss the post-WWI Italian emigration wave and what life was like for Italian migrants arriving in Australia in that era.
- If a photograph from Venice appears, provide context about what Venice was like in that period.

Write it as if you are a historian-journalist telling the story of what the family discovered this month — like a rich newspaper feature article that connects personal artifacts to the grand sweep of history. Use a warm, cinematic, archival tone. Address the reader as a family member.

Include:
1. A compelling headline
2. An opening paragraph that hooks the reader with the theme of the month's discoveries
3. 2-4 body sections, each covering a grouping of related items (e.g. certificates found, photographs shared, stories told), with section subheadings. Each section should weave together the personal item with its broader historical context.
4. A closing paragraph reflecting on the growing archive, the family's journey through history, and inviting members to contribute

Reference specific items by name where it makes the story richer. Use the uploader's historical context and family comments as primary sources. Use evocative, storytelling language — not dry summaries. The goal is to help the family SEE their ancestors as real people living through real historical moments.

Here are the items added this month (with full context):
${itemSummaries}

Return your response as JSON with this structure:
{
  "headline": "the main headline",
  "intro": "the opening paragraph(s) — can include multiple sentences",
  "sections": [
    { "subheading": "section subheading", "body": "the section body text" }
  ],
  "closing": "the closing paragraph"
}`,
        model: 'gemini_3_flash',
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            intro: { type: 'string' },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  subheading: { type: 'string' },
                  body: { type: 'string' }
                }
              }
            },
            closing: { type: 'string' }
          }
        }
      });
    }

    // Save newsletter as an in-app entity
    const newsletter = await base44.asServiceRole.entities.Newsletter.create({
      headline: story ? story.headline : 'A Quiet Month',
      intro: story ? story.intro : 'The archive rested quietly this month, with no new discoveries shared. But every family has its quiet seasons — and the stories already preserved await your revisit.',
      sections: story ? (story.sections || []) : [],
      closing: story ? story.closing : 'Perhaps next month will bring a new photograph, a certificate, or a long-forgotten letter to light up the chronicle once more.',
      month_label: monthName,
      item_count: itemCount,
      featured_item_ids: featuredIds,
      photo_urls: photoUrls,
    });

    // Get all users who opted in to the newsletter
    const users = await base44.asServiceRole.entities.User.list();
    const optedIn = users.filter(u => u.newsletter_opt_in === true && u.email);

    // Determine the app URL for the in-app link
    const origin = new URL(req.url).origin;
    const newsletterUrl = `${origin}/newsletter/${newsletter.id}`;

    // Send teaser emails
    for (const user of optedIn) {
      await sendTeaserEmail(base44, user, story, monthName, itemCount, newsletterUrl);
    }

    return Response.json({
      success: true,
      emailsSent: optedIn.length,
      itemCount,
      newsletterId: newsletter.id,
      headline: story ? story.headline : 'A Quiet Month',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function sendTeaserEmail(base44, user, story, monthName, itemCount, newsletterUrl) {
  const headline = story ? story.headline : 'A Quiet Month in the Archive';
  const teaser = story
    ? story.intro.substring(0, 220) + (story.intro.length > 220 ? '...' : '')
    : 'The archive rested quietly this month. Visit the Chronicle to revisit stories already preserved.';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D0B0A;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <p style="color:#C9913A;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">The Freddi Family Chronicle</p>
    <h1 style="color:#F5ECD7;font-size:24px;margin:0 0 4px;line-height:1.3;">${headline}</h1>
    <p style="color:#F5ECD7;opacity:0.5;font-size:13px;margin:0 0 32px;">${monthName}${itemCount > 0 ? ' &bull; ' + itemCount + ' new ' + (itemCount === 1 ? 'discovery' : 'discoveries') : ''}</p>

    <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.2);border-radius:8px;padding:24px;margin-bottom:24px;">
      <p style="color:#F5ECD7;font-size:15px;line-height:1.8;margin:0 0 16px;font-style:italic;">${teaser}</p>
      <a href="${newsletterUrl}" style="display:inline-block;background:#C9913A;color:#0D0B0A;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">Read the Full Chronicle &rarr;</a>
      <p style="color:#F5ECD7;opacity:0.4;font-size:12px;margin:12px 0 0;">Read the full story, browse featured uploads, and share your memories in the comments.</p>
    </div>

    <p style="color:#F5ECD7;opacity:0.3;font-size:11px;text-align:center;border-top:1px solid rgba(201,145,58,0.1);padding-top:20px;">This is an automated monthly newsletter from the Freddi Ancestry Archive.</p>
  </div>
</body>
</html>`;

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: user.email,
    from_name: 'Freddi Family Chronicle',
    subject: `The Freddi Family Chronicle — ${headline}`,
    body: html,
  });
}