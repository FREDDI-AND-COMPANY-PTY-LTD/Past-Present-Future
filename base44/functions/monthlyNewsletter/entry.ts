import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all users who opted in to the newsletter
    const users = await base44.asServiceRole.entities.User.list();
    const optedIn = users.filter(u => u.newsletter_opt_in === true && u.email);
    if (optedIn.length === 0) {
      return Response.json({ success: true, message: 'No opted-in users', emailsSent: 0 });
    }

    // Calculate date range: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch content items from the last 30 days
    const allItems = await base44.asServiceRole.entities.ContentItem.list('-created_date', 200);
    const monthlyItems = (allItems || []).filter(item => {
      const itemDate = new Date(item.created_date);
      return itemDate >= thirtyDaysAgo;
    });

    if (monthlyItems.length === 0) {
      // Send a "quiet month" email
      for (const user of optedIn) {
        await sendNewsletter(base44, user, [], []);
      }
      return Response.json({ success: true, emailsSent: optedIn.length, itemCount: 0 });
    }

    // Build a summary of items for the LLM
    const itemSummaries = monthlyItems.map((item, i) => {
      const date = new Date(item.created_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
      return `${i + 1}. [${item.content_type}] "${item.title}" — ${item.description || 'no description'} (added ${date}${item.location_name ? ', location: ' + item.location_name : ''})`;
    }).join('\n');

    // Use InvokeLLM to generate a news-story narrative
    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are the editor-in-chief of "The Freddi Family Chronicle," a monthly newsletter for the Freddi family. Write an engaging, warm, and enjoyable news story summarising the following discoveries and uploads from the past month. 

Write it as if you are a journalist telling the story of what the family discovered this month — like a newspaper feature article. Use a warm, cinematic, archival tone. Address the reader as a family member. Include:

1. A compelling headline
2. An opening paragraph that hooks the reader with the theme of the month's discoveries
3. 2-4 body sections, each covering a grouping of related items (e.g. certificates found, photographs shared, stories told), with section subheadings
4. A closing paragraph reflecting on the growing archive and inviting members to contribute

Reference specific items by name where it makes the story richer. Use evocative, storytelling language — not dry summaries.

Here are the items added this month:
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

    // Collect photos to include in the email
    const photos = monthlyItems
      .filter(item => item.file_url && (item.content_type === 'photo' || item.content_type === 'press_clipping'))
      .slice(0, 6);

    for (const user of optedIn) {
      await sendNewsletter(base44, user, monthlyItems, photos, llmResult);
    }

    return Response.json({
      success: true,
      emailsSent: optedIn.length,
      itemCount: monthlyItems.length,
      headline: llmResult.headline
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function sendNewsletter(base44, user, items, photos, story) {
  const monthName = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  const html = buildHtml(monthName, items, photos, story);

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: user.email,
    from_name: 'Freddi Family Chronicle',
    subject: story ? `The Freddi Family Chronicle — ${story.headline}` : `The Freddi Family Chronicle — ${monthName}`,
    body: html,
  });
}

function buildHtml(monthName, items, photos, story) {
  const itemCount = items.length;

  const photoGallery = photos.length > 0
    ? `<div style="margin:24px 0;">
        <p style="color:#C9913A;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">Glimpses from the Archive</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            ${photos.slice(0, 3).map(p => `
              <td style="width:33%;padding:4px;">
                <img src="${p.file_url}" alt="${p.title}" style="width:100%;border-radius:6px;border:1px solid rgba(201,145,58,0.2);display:block;" />
              </td>
            `).join('')}
          </tr>
          ${photos.length > 3 ? `<tr>
            ${photos.slice(3, 6).map(p => `
              <td style="width:33%;padding:4px;padding-top:0;">
                <img src="${p.file_url}" alt="${p.title}" style="width:100%;border-radius:6px;border:1px solid rgba(201,145,58,0.2);display:block;" />
              </td>
            `).join('')}
          </tr>` : ''}
        </table>
      </div>`
    : '';

  if (!story) {
    // Quiet month
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D0B0A;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <p style="color:#C9913A;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">The Freddi Family Chronicle</p>
    <h1 style="color:#F5ECD7;font-size:26px;margin:0 0 4px;">A Quiet Month</h1>
    <p style="color:#F5ECD7;opacity:0.5;font-size:14px;margin:0 0 32px;">${monthName}</p>
    <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.2);border-radius:8px;padding:24px;">
      <p style="color:#F5ECD7;font-size:15px;line-height:1.7;margin:0;">The archive rested quietly this month, with no new discoveries shared. But every family has its quiet seasons — and the stories already preserved await your revisit. Perhaps next month will bring a new photograph, a certificate, or a long-forgotten letter to light up the chronicle once more.</p>
      <p style="color:#C9913A;font-size:14px;margin:16px 0 0;">Have something to share? Visit the archive and upload your piece of family history.</p>
    </div>
    <p style="color:#F5ECD7;opacity:0.3;font-size:11px;text-align:center;margin-top:40px;border-top:1px solid rgba(201,145,58,0.1);padding-top:20px;">This is an automated monthly newsletter from the Freddi Ancestry Archive.</p>
  </div>
</body></html>`;
  }

  const sectionsHtml = (story.sections || []).map(s => `
    <div style="margin-bottom:24px;">
      <h3 style="color:#E8C97A;font-size:16px;margin:0 0 8px;">${s.subheading}</h3>
      <p style="color:#F5ECD7;font-size:15px;line-height:1.7;margin:0;">${s.body}</p>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D0B0A;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <p style="color:#C9913A;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">The Freddi Family Chronicle</p>
    <h1 style="color:#F5ECD7;font-size:26px;margin:0 0 4px;line-height:1.3;">${story.headline}</h1>
    <p style="color:#F5ECD7;opacity:0.5;font-size:14px;margin:0 0 32px;">${monthName} &bull; ${itemCount} new ${itemCount === 1 ? 'discovery' : 'discoveries'}</p>

    <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.2);border-radius:8px;padding:24px;margin-bottom:24px;">
      <p style="color:#F5ECD7;font-size:16px;line-height:1.8;margin:0;font-style:italic;">${story.intro}</p>
    </div>

    ${photoGallery}

    <div style="margin-bottom:24px;">
      ${sectionsHtml}
    </div>

    <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.12);border-radius:8px;padding:20px;margin-bottom:32px;">
      <p style="color:#F5ECD7;font-size:15px;line-height:1.7;margin:0;">${story.closing}</p>
    </div>

    <p style="color:#F5ECD7;opacity:0.3;font-size:11px;text-align:center;border-top:1px solid rgba(201,145,58,0.1);padding-top:20px;">This is an automated monthly newsletter from the Freddi Ancestry Archive.</p>
  </div>
</body>
</html>`;
}