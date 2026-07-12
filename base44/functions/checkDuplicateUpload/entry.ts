import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { content_item_id, item_data } = body;

    let newItem;
    if (item_data) {
      newItem = item_data;
    } else {
      if (!content_item_id) return Response.json({ error: 'content_item_id or item_data is required' }, { status: 400 });
      newItem = await base44.asServiceRole.entities.ContentItem.get(content_item_id);
      if (!newItem) return Response.json({ error: 'Content item not found' }, { status: 404 });
    }

    const ancestorIds = newItem.ancestor_ids || [];
    if (ancestorIds.length === 0) {
      return Response.json({ potential_duplicates: [] });
    }

    // Gather all content items tagged to the same ancestor(s), excluding the new item
    const candidateMap = new Map();
    for (const ancestorId of ancestorIds) {
      const items = await base44.asServiceRole.entities.ContentItem.filter({ ancestor_ids: ancestorId });
      for (const i of items) {
        if (i.id !== content_item_id) candidateMap.set(i.id, i);
      }
    }

    const candidates = [...candidateMap.values()];
    if (candidates.length === 0) {
      return Response.json({ potential_duplicates: [] });
    }

    // Cap at 10 candidates to keep the LLM comparison manageable
    const topCandidates = candidates.slice(0, 10);

    // Build file URL list — new item first, then candidates (for visual comparison)
    const fileUrls = [newItem.file_url, ...topCandidates.map(c => c.file_url)].filter(Boolean);

    // Build text data summaries for comparison
    const newSummary = {
      title: newItem.title,
      content_type: newItem.content_type,
      date: newItem.date,
      location_name: newItem.location_name,
      transcribed_text: newItem.transcribed_text ? newItem.transcribed_text.substring(0, 500) : '',
      extracted_fields: newItem.extracted_fields || {},
    };

    const candidateSummaries = topCandidates.map((c, idx) => ({
      image_index: idx + 2, // image 1 is the new item
      id: c.id,
      title: c.title,
      content_type: c.content_type,
      date: c.date,
      location_name: c.location_name,
      transcribed_text: c.transcribed_text ? c.transcribed_text.substring(0, 500) : '',
      extracted_fields: c.extracted_fields || {},
    }));

    // If the new item has no file_url (e.g. external video), skip visual comparison — text only
    const hasNewFile = !!newItem.file_url;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a genealogical archive analyst. A new item has just been uploaded to a family history archive. Your job is to compare it against existing items tagged to the same ancestor(s) and identify potential DUPLICATES.

A duplicate is when two items represent the SAME document, photograph, or event — e.g. the same photo uploaded twice (even at different quality/cropping), the same certificate scanned at different times, or the same event with identical extracted data. Minor differences in scan quality or cropping still count as duplicates.

The NEW item${hasNewFile ? ' (image 1)' : ''} data:
${JSON.stringify(newSummary, null, 2)}

EXISTING items to compare against${hasNewFile ? ' (images 2, 3, 4... correspond to the image_index below)' : ''}:
${JSON.stringify(candidateSummaries, null, 2)}

${hasNewFile ? 'You have been provided with images. Image 1 is the newly uploaded item. Images 2+ are the existing items (matching the image_index above). Compare them visually AND using the text data.' : 'No images provided — compare using the text data only (titles, dates, locations, extracted fields, transcribed text).'}

For each existing item, assess whether it is likely a duplicate of the new item. Consider:
- Visual similarity (same photo, same document layout, same handwriting)${hasNewFile ? '' : ' (N/A — no images)'}
- Same extracted names, dates, document numbers, registration numbers
- Same or very similar transcription text
- Same event date and location
- Same content type (e.g. both birth certificates for same person)

Return ONLY items with confidence >= 0.5. Be conservative — when in genuine doubt, do not flag.

Return JSON:
{
  "duplicates": [
    {
      "content_item_id": "existing item ID",
      "title": "existing item title",
      "confidence": 0.0 to 1.0,
      "reason": "why you believe this is a duplicate — be specific about what matches"
    }
  ]
}
If no duplicates found, return { "duplicates": [] }.`,
      ...(hasNewFile ? { file_urls: fileUrls } : {}),
      response_json_schema: {
        type: 'object',
        properties: {
          duplicates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content_item_id: { type: 'string' },
                title: { type: 'string' },
                confidence: { type: 'number' },
                reason: { type: 'string' }
              }
            }
          }
        }
      }
    });

    const duplicates = result?.duplicates || [];
    return Response.json({ potential_duplicates: duplicates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});