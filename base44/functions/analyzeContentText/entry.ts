import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Normalise a free-text date string (e.g. "14 March 1956", "circa 1948",
// "summer of 1953") into an ISO date string when possible. Returns null when
// the text cannot be confidently resolved to a calendar date.
function normaliseToDate(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Already ISO?
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;
  // Year-only or "circa YYYY" -> null (keep as display text, not a date field)
  const yearOnly = trimmed.match(/\b(\d{4})\b/);
  const date = new Date(trimmed);
  if (!isNaN(date.getTime()) && trimmed.match(/\d{1,2}\s/) ) {
    return date.toISOString().split('T')[0];
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const contentItemId = body.content_item_id;
    if (!contentItemId) return Response.json({ error: 'content_item_id is required' }, { status: 400 });

    const item = await base44.asServiceRole.entities.ContentItem.get(contentItemId);
    if (!item) return Response.json({ error: 'Content item not found' }, { status: 404 });

    const text = (item.transcribed_text || item.english_translation || '').trim();
    if (!text) {
      return Response.json({ success: true, skipped: true, reason: 'No transcribed text to analyse' });
    }

    const extractedFields = item.extracted_fields || {};

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a genealogical narrative analyst working on a private family history archive. You are given the transcribed body of text from a family archive item (a diary entry, letter, newspaper clipping, certificate, interview transcript, or narrative). Your job is to extract structured, chronicle-ready information about the EVENT the text describes \u2014 not the document itself.

--- ITEM CONTEXT ---
Title: ${item.title || ''}
Content type: ${item.content_type || ''}
Event date (as recorded): ${item.date || ''}
Event location (as recorded): ${item.location_name || ''}
Description (as recorded): ${item.description || ''}
Extracted certificate fields: ${JSON.stringify(extractedFields)}
--- END ITEM CONTEXT ---

--- TEXT BODY ---
${text.substring(0, 6000)}
--- END TEXT BODY ---

Analyse the text body and extract:
1. event_date \u2014 the date the described event actually occurred (ISO date when determinable, otherwise empty string)
2. event_date_display \u2014 a human-readable label (e.g. "14 March 1956", "circa 1948", "summer of 1953", "around 1960")
3. event_description \u2014 a 1-3 sentence plain-English summary of what the text says HAPPENED (the event itself, written for a family chronicle)
4. event_type \u2014 one of: birth, marriage, death, migration, arrival, military, occupation, family gathering, travel, milestone, other
5. named_people \u2014 every person named in the text (ancestors AND others). For each, give name, role (e.g. "subject", "author", "mother", "witness", "recipient"), and relationship to the subject if stated.
6. named_places \u2014 every place named in the text. For each, give the place name and context (e.g. "born in", "arrived at", "married in", "departed from").
7. chronicle_snippet \u2014 a ready-to-paste 1-2 sentence line summarising this item for a monthly family newsletter/chronicle entry. Warm, specific, referencing the people and place. Do not use generic filler.

Also extract, when present in the text:
8. publication_date \u2014 the date the document/record was issued or published (e.g. a newspaper masthead date, a registry date of issue, an interview recording date). ISO date when determinable, otherwise empty string. Only if clearly distinct from the event date.
9. publication_location \u2014 the place where the document was issued or published (e.g. the newspaper's city, the registry office city). Only if clearly distinct from the event location.

Return JSON with this structure:
{
  "event_date": "",
  "event_date_display": "",
  "event_description": "",
  "event_type": "",
  "named_people": [{ "name": "", "role": "", "relationship": "" }],
  "named_places": [{ "place": "", "context": "" }],
  "chronicle_snippet": "",
  "publication_date": "",
  "publication_location": ""
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          event_date: { type: 'string' },
          event_date_display: { type: 'string' },
          event_description: { type: 'string' },
          event_type: { type: 'string' },
          named_people: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                role: { type: 'string' },
                relationship: { type: 'string' },
              },
            },
          },
          named_places: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                place: { type: 'string' },
                context: { type: 'string' },
              },
            },
          },
          chronicle_snippet: { type: 'string' },
          publication_date: { type: 'string' },
          publication_location: { type: 'string' },
        },
      },
    });

    const narrativeExtraction = {
      event_date: result.event_date || '',
      event_date_display: result.event_date_display || '',
      event_description: result.event_description || '',
      event_type: result.event_type || '',
      named_people: result.named_people || [],
      named_places: result.named_places || [],
      chronicle_snippet: result.chronicle_snippet || '',
      generated_at: new Date().toISOString(),
    };

    // Build the update payload. Always persist narrative_extraction.
    const update = { narrative_extraction: narrativeExtraction };

    // Only fill publication_* from the text analysis when the user hasn't
    // already set them on the item (don't overwrite user-provided values).
    if (!item.publication_date) {
      const pubDate = normaliseToDate(result.publication_date);
      if (pubDate) update.publication_date = pubDate;
    }
    if (!item.publication_location_name && result.publication_location) {
      update.publication_location_name = result.publication_location;
    }

    await base44.asServiceRole.entities.ContentItem.update(contentItemId, update);

    return Response.json({ success: true, narrative_extraction: narrativeExtraction, updated_publication: update });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});