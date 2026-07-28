import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ancestor_id } = body;
    if (!ancestor_id) return Response.json({ error: 'ancestor_id is required' }, { status: 400 });

    const ancestor = await base44.asServiceRole.entities.Ancestor.get(ancestor_id);
    if (!ancestor) return Response.json({ error: 'Ancestor not found' }, { status: 404 });

    // Gather every content item tagged to this ancestor (exclude "related event" attachments
    // that belong to a parent event — those are not standalone life events).
    const allItems = await base44.asServiceRole.entities.ContentItem.list();
    const tagged = (allItems || [])
      .filter(ci => (ci.ancestor_ids || []).includes(ancestor_id) && !ci.parent_content_item_id)
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : Infinity;
        const db = b.date ? new Date(b.date).getTime() : Infinity;
        return da - db;
      });

    // Family context (parents / spouse)
    const allAncestors = await base44.asServiceRole.entities.Ancestor.list();
    const mother = allAncestors.find(a => a.id === ancestor.mother_id);
    const father = allAncestors.find(a => a.id === ancestor.father_id);
    const partner = allAncestors.find(a => a.id === ancestor.partner_id);

    // Migration routes
    const allRoutes = await base44.asServiceRole.entities.MigrationRoute.list();
    const routes = (allRoutes || []).filter(r => r.ancestor_id === ancestor_id);

    // --- Known facts about the ancestor ---
    const facts = [];
    if (ancestor.full_name) facts.push(`Name: ${ancestor.full_name}`);
    if (ancestor.sex) facts.push(`Sex: ${ancestor.sex}`);
    if (ancestor.birth_date) facts.push(`Born: ${ancestor.birth_date}`);
    if (ancestor.birth_place) facts.push(`Birthplace: ${ancestor.birth_place}`);
    if (ancestor.death_date) facts.push(`Died: ${ancestor.death_date}`);
    if (ancestor.death_place) facts.push(`Death place: ${ancestor.death_place}`);
    if (ancestor.living) facts.push('Currently living');
    if (ancestor.nationality) facts.push(`Nationality: ${ancestor.nationality}`);
    if (ancestor.bloodline) facts.push(`Bloodline: ${ancestor.bloodline}`);
    if (ancestor.maiden_name) facts.push(`Maiden name: ${ancestor.maiden_name}`);
    if (ancestor.era) facts.push(`Era: ${ancestor.era}`);
    if (ancestor.biography) facts.push(`Existing biography notes: ${ancestor.biography}`);

    // --- Family ---
    const familyLines = [];
    if (mother) familyLines.push(`Mother: ${mother.full_name}${mother.birth_place ? ` (born ${mother.birth_place})` : ''}${mother.birth_date ? `, ${mother.birth_date}` : ''}`);
    if (father) familyLines.push(`Father: ${father.full_name}${father.birth_place ? ` (born ${father.birth_place})` : ''}${father.birth_date ? `, ${father.birth_date}` : ''}`);
    if (partner) familyLines.push(`Husband/Wife: ${partner.full_name}${partner.birth_date ? ` (born ${partner.birth_date})` : ''}${partner.birth_place ? `, ${partner.birth_place}` : ''}`);

    // --- Life events (chronological), enriched with per-item historical background already researched ---
    const eventLines = tagged.map(ci => {
      const parts = [];
      if (ci.date) parts.push(ci.date);
      if (ci.location_name) parts.push(ci.location_name);
      if (ci.publication_date && ci.publication_date !== ci.date) parts.push(`published ${ci.publication_date}`);
      parts.push(`"${ci.title}"`);
      if (ci.content_type) parts.push(`(${ci.content_type})`);
      if (ci.description) parts.push(ci.description.substring(0, 200));
      if (ci.transcribed_text) parts.push(`Transcribed: ${ci.transcribed_text.substring(0, 300)}`);
      if (ci.historical_background) parts.push(`Historical context: ${ci.historical_background.substring(0, 400)}`);
      if (ci.narrative_extraction?.chronicle_snippet) parts.push(`Chronicle note: ${ci.narrative_extraction.chronicle_snippet}`);
      return parts.join(' — ');
    });

    // --- Migration journey ---
    const routeLines = routes.map(r => {
      const wp = (r.waypoints || []).map(w => {
        const p = [w.label || 'Unknown location'];
        if (w.date) p.push(w.date);
        if (w.description) p.push(w.description);
        return p.join(' — ');
      }).join(' → ');
      return `${r.name}: ${wp}`;
    });

    const dataProfile = [
      `KNOWN FACTS:\n${facts.join('\n')}`,
      familyLines.length ? `\nFAMILY:\n${familyLines.join('\n')}` : '',
      eventLines.length ? `\nLIFE EVENTS (chronological — each may carry its own researched historical context):\n${eventLines.join('\n')}` : '',
      routeLines.length ? `\nMIGRATION JOURNEY:\n${routeLines.join('\n')}` : '',
    ].filter(Boolean).join('\n');

    if (!dataProfile.trim()) {
      return Response.json({ error: 'Not enough data is known about this ancestor to compose a biography' }, { status: 400 });
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a professional ghost writer composing a short biographical overview for a private family history archive. Using the known facts, family context, life events, and migration details below, write a warm, engaging 2-3 paragraph overview of what is known about this ancestor.

Your task:
1. Synthesise the documented facts and life events into a coherent life narrative — where they were born, who their family was, the arc of their life across places and time, and (if deceased) how their story concluded.
2. Use web search to enrich the overview with relevant GENERAL historical background for the eras, places, and (if discernible) occupations involved — what life was like in those locations at those times, the broader currents (migration, war, economic change, social conditions) that shaped this person's experience.
3. Where individual life events already carry their own researched historical context (provided below), weave that context in rather than repeating it verbatim — integrate, don't list.
4. If information is thin, say so gracefully and focus on what can be reasonably inferred from the era and places; do not invent specific facts, dates, or names not present in the data.
5. Write as a ghost writer crafting a family biography — vivid, warm, addressed to a family reader — not an encyclopedia entry. Connect the personal details to the wider historical currents.

Keep it to 2-3 paragraphs. Be economical and rich; favour the most telling details over exhaustive coverage. Anchor everything to the specific person, places, and times in the data.

Here is everything known about this ancestor:
${dataProfile}`,
      model: 'gemini_3_flash',
      add_context_from_internet: true,
    });

    const narrative = typeof result === 'string' ? result : (result?.text || result?.response || JSON.stringify(result));

    const generatedAt = new Date().toISOString();
    await base44.asServiceRole.entities.Ancestor.update(ancestor_id, {
      ai_biography: narrative,
      ai_biography_generated_at: generatedAt,
    });

    return Response.json({ success: true, ai_biography: narrative, ai_biography_generated_at: generatedAt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});