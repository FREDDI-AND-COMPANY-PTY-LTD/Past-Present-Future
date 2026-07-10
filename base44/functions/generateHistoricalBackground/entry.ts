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
    let ancestorSummaries = '';
    if (ancestorIds.length > 0) {
      const allAncestors = await base44.asServiceRole.entities.Ancestor.list();
      const tagged = allAncestors.filter(a => ancestorIds.includes(a.id));
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

The narrative should be 3-5 paragraphs, rich in historical detail researched from the web, but always anchored to the specific person, place, and time in the data.

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