import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { suggestion, category, current_page } = body;
    if (!suggestion?.trim()) {
      return Response.json({ error: 'Suggestion text is required' }, { status: 400 });
    }

    const creatorEmail = Deno.env.get('SHOP_CREATOR_EMAIL');
    if (!creatorEmail) {
      return Response.json({ error: 'Shop creator email not configured' }, { status: 500 });
    }

    const categoryLabel = category || 'General';
    const subject = `[App Suggestion] ${categoryLabel} — from ${user.full_name || user.email}`;
    const body_text = [
      `A user has submitted a suggestion to improve the app.`,
      ``,
      `From: ${user.full_name || 'Unknown'} (${user.email})`,
      `Category: ${categoryLabel}`,
      `Page when submitted: ${current_page || 'Unknown'}`,
      `Submitted: ${new Date().toISOString()}`,
      ``,
      `--- SUGGESTION ---`,
      suggestion.trim(),
      `--- END SUGGESTION ---`,
    ].join('\n');

    await base44.integrations.Core.SendEmail({
      to: creatorEmail,
      subject,
      body: body_text,
      from_name: `${user.full_name || 'App User'} (via App)`,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});