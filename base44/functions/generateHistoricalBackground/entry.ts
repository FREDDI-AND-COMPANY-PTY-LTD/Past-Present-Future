import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { content_item_id } = body;
    if (!content_item_id) return Response.json({ error: 'content_item_id is required' }, { status: 400 });

    // Fetch the content item with all extracted data
    const item = await base44.asServiceRole.entities.ContentItem.get(content_item_id);
    if (!item) return Response.json({ error: 'Content item not found' }, { status: 404 });

    // Fetch tagged ancestors for biographical context
    const ancestorIds = item.ancestor_ids || [];
    const allAncestors = ancestorIds.length > 0
      ? await base44.asServiceRole.entities.Ancestor.list()
      : [];
    const tagged = allAncestors.filter(a => ancestorIds.includes(a.id));
    let ancestorSummaries = '';
    if (tagged.length > 0) {
      ancestorSummaries = tagged.map(a => {
        const parts = [`Name: ${a.full_name}`];
        if (a.birth_date) parts.push(`Born: ${a.birth_date}`);
        if (a.birth_place) parts.push(`Birthplace: ${a.birth_place}`);
        if (a.death_date) parts.push(`Died: ${a.death_date}`);
        if (a.death_place) parts.push(`Death place: ${a.death_place}`);
        if (a.nationality) parts.push(`Nationality: ${a.nationality}`);
        if (a.occupation) parts.push(`Occupation: ${a.occupation}`);
        if (a.biography) parts.push(`Biography: ${a.biography}`);
        return parts.join(', ');
      }).join('\n');
    }

    // Fetch other life events for the same ancestor(s) — chronological timeline
    let lifeEventsTimeline = '';
    if (ancestorIds.length > 0) {
      const allContentItems = await base44.asServiceRole.entities.ContentItem.list();
      const otherItems = allContentItems
        .filter(ci => ci.id !== content_item_id && (ci.ancestor_ids || []).some(aid => ancestorIds.includes(aid)))
        .sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : Infinity;
          const dateB = b.date ? new Date(b.date).getTime() : Infinity;
          return dateA - dateB;
        })
        .slice(0, 20);
      if (otherItems.length > 0) {
        lifeEventsTimeline = otherItems.map(ci => {
          const eventAncestors = (ci.ancestor_ids || [])
            .map(aid => allAncestors.find(an => an.id === aid)?.full_name)
            .filter(Boolean)
            .join(', ');
          const parts = [];
          if (ci.date) parts.push(ci.date);
          if (ci.location_name) parts.push(ci.location_name);
          if (ci.title) parts.push(`"${ci.title}"`);
          if (ci.content_type) parts.push(`(${ci.content_type})`);
          if (eventAncestors) parts.push(`Tagged: ${eventAncestors}`);
          if (ci.description) parts.push(`Summary: ${ci.description.substring(0, 150)}`);
          return parts.join(' — ');
        }).join('\n');
      }
    }

    // Fetch extended family context (mother, father, partner)
    let familyContext = '';
    if (tagged.length > 0) {
      const familyMembers = [];
      for (const a of tagged) {
        const relatives = [
          { id: a.mother_id, relation: 'Mother' },
          { id: a.father_id, relation: 'Father' },
          { id: a.partner_id, relation: 'Partner/Spouse' },
        ].filter(r => r.id);
        for (const rel of relatives) {
          const relative = allAncestors.find(an => an.id === rel.id);
          if (relative) {
            const parts = [`${rel.relation} of ${a.full_name}: ${relative.full_name}`];
            if (relative.birth_date) parts.push(`Born: ${relative.birth_date}`);
            if (relative.birth_place) parts.push(`Birthplace: ${relative.birth_place}`);
            if (relative.death_date) parts.push(`Died: ${relative.death_date}`);
            if (relative.nationality) parts.push(`Nationality: ${relative.nationality}`);
            if (relative.occupation) parts.push(`Occupation: ${relative.occupation}`);
            if (relative.biography) parts.push(`Bio: ${relative.biography}`);
            familyMembers.push(parts.join(', '));
          }
        }
      }
      if (familyMembers.length > 0) familyContext = familyMembers.join('\n');
    }

    // Fetch migration routes for the tagged ancestor(s)
    let migrationContext = '';
    if (ancestorIds.length > 0) {
      const allRoutes = await base44.asServiceRole.entities.MigrationRoute.list();
      const routes = allRoutes.filter(r => ancestorIds.includes(r.ancestor_id));
      if (routes.length > 0) {
        migrationContext = routes.map(r => {
          const wp = (r.waypoints || []).map(w => {
            const parts = [w.label || 'Unknown location'];
            if (w.date) parts.push(w.date);
            if (w.description) parts.push(w.description);
            return parts.join(' — ');
          }).join(' → ');
          return `${r.name}: ${wp}`;
        }).join('\n');
      }
    }

    // Build a comprehensive data profile from all extracted information
    const ef = item.extracted_fields || {};
    const ve = item.visual_elements || {};
    const dataPoints = [];

    if (item.title) dataPoints.push(`Item title: ${item.title}`);
    if (item.description) dataPoints.push(`Description: ${item.description}`);
    if (item.date) dataPoints.push(`Event date: ${item.date}`);
    if (item.era) dataPoints.push(`Era: ${item.era}`);
    if (item.location_name) dataPoints.push(`Location: ${item.location_name}`);
    if (item.content_type) dataPoints.push(`Document type: ${item.content_type}`);
    if (item.transcribed_text) dataPoints.push(`Transcribed text: ${item.transcribed_text.substring(0, 800)}`);

    // Extracted fields from certificates/documents
    const fieldLabels = {
      full_name: 'Person full name', date_of_birth: 'Date of birth', place_of_birth: 'Place of birth',
      date_of_death: 'Date of death', place_of_death: 'Place of death', mother_name: 'Mother name',
      father_name: 'Father name', spouse_name: 'Spouse name', witnesses: 'Witnesses',
      issuing_authority: 'Issuing authority', date_of_event: 'Date of event', place_of_event: 'Place of event',
      nationality: 'Nationality', religion: 'Religion', occupation: 'Occupation',
      document_number: 'Document number', registration_number: 'Registration number',
      ship_name: 'Ship name', port_of_departure: 'Port of departure', port_of_arrival: 'Port of arrival',
      military_unit: 'Military unit', rank: 'Rank', service_number: 'Service number',
      residence_address: 'Residence address', passport_number: 'Passport number',
      date_of_issue: 'Date of issue', date_of_expiry: 'Date of expiry', issuing_country: 'Issuing country',
      place_of_issue: 'Place of issue', surname: 'Surname', given_names: 'Given names',
      national_id_number: 'National ID number', sex: 'Sex', height: 'Height',
      profession: 'Profession', distinguishing_marks: 'Distinguishing marks',
      document_subtype: 'Document subtype'
    };
    for (const [key, val] of Object.entries(ef)) {
      if (val && fieldLabels[key]) dataPoints.push(`${fieldLabels[key]}: ${val}`);
    }

    // Visual elements
    if (ve.locations_visible?.length > 0) dataPoints.push(`Locations visible: ${ve.locations_visible.join(', ')}`);
    if (ve.dates_visible?.length > 0) dataPoints.push(`Dates visible: ${ve.dates_visible.join(', ')}`);
    if (ve.objects?.length > 0) dataPoints.push(`Objects visible: ${ve.objects.join(', ')}`);
    if (ve.era_indicators?.length > 0) dataPoints.push(`Era indicators: ${ve.era_indicators.join(', ')}`);
    if (ve.format_description) dataPoints.push(`Format: ${ve.format_description}`);

    if (ancestorSummaries) dataPoints.push(`\nTagged ancestor(s):\n${ancestorSummaries}`);
    if (lifeEventsTimeline) dataPoints.push(`\nOther life events for tagged ancestor(s) (chronological timeline):\n${lifeEventsTimeline}`);
    if (familyContext) dataPoints.push(`\nExtended family context:\n${familyContext}`);
    if (migrationContext) dataPoints.push(`\nMigration journey:\n${migrationContext}`);

    const dataProfile = dataPoints.join('\n');

    if (!dataProfile.trim()) {
      return Response.json({ error: 'Not enough data extracted from this item to generate a historical background' }, { status: 400 });
    }

    // Use Gemini with web search to research historical context
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a professional ghost writer specialising in personal histories and family biographies. You have been given data extracted from a historical family document or photograph. Your task is to research the broader historical context using web search and write a vivid, engaging historical background narrative — the kind a ghost writer would craft when constructing the biography of a person.

Using the extracted data below, research and write about the RELEVANT historical context. Focus on:

1. **Locations** — The city, region, and country where the event took place. What was this place like during that era? What was its significance — was it a port city, an industrial centre, a rural village? What was daily life like there?

2. **Institutions** — Any institutions mentioned (military units, churches, government offices, hospitals, schools, shipping companies). What role did they play? What was their history?

3. **Countries and political context** — What was happening in the country at that time? Wars, political changes, economic conditions, social movements, immigration policies.

4. **Migration and travel** — If migration is implied (ports, ships, passports, border crossings), discuss the broader migration patterns of that era. Who was leaving? Why? What were the conditions of the journey?

5. **Occupations and employment** — What did this type of work involve in that era? What were the working conditions, wages, social status? How did the profession shape daily life?

6. **Daily life and culture** — What was everyday life like for someone in this person's position during this period? Clothing, food, housing, transport, social customs.

7. **Broader significance** — How does this single document or photo connect to the larger sweep of history? What does it tell us about the ancestor's experience of their times?

Write as a ghost writer crafting a biography — not an encyclopedia entry. Use vivid, evocative prose that helps the reader SEE the ancestor as a real person living through a specific historical moment. Address the family reader directly with warmth. Connect the personal details from the document to the wider historical currents that shaped this ancestor's life.

If a chronological timeline of other life events is provided, weave this event into the ancestor's broader life story — referencing what came before and after, showing how this moment fits into the arc of their life. If the same ancestor appears in multiple events, build a sense of continuity and development across time. Do not list events mechanically — integrate them naturally into the narrative flow.

If extended family context is provided (parents, spouse), bring these family members into the narrative where relevant — show how family relationships shaped the ancestor's journey, and how this event connects to the broader family story.

If a migration journey is provided, discuss the ancestor's movement across places and time — the push and pull factors, the experience of leaving one world and entering another, and how this event fits into that journey.

The narrative should be 2-3 paragraphs — roughly half the length of a typical feature — concise but rich in the most relevant historical detail researched from the web, always anchored to the specific person, place, and time in the data, and connected to the broader family and life story. Be economical with words; favour the most telling details over exhaustive coverage.

If you cannot find specific historical information about a place or institution, provide the best general context you can for the era and region, and note that specifics may require further research.

Here is the extracted data:
${dataProfile}`,
      model: 'gemini_3_flash',
      add_context_from_internet: true,
    });

    const narrative = typeof result === 'string' ? result : (result?.text || result?.response || JSON.stringify(result));

    // Save the narrative to the content item
    await base44.asServiceRole.entities.ContentItem.update(content_item_id, {
      historical_background: narrative,
      historical_background_generated_at: new Date().toISOString(),
    });

    return Response.json({ success: true, historical_background: narrative });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});