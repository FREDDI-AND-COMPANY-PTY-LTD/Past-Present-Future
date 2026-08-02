// Shared duplicate-detection logic for ContentItems.
// Used by both the on-demand scanForDuplicates function and the scheduled
// branch duplicate-alert job so they detect duplicates identically.
//
// Returns { pairs, scanned } where `pairs` is an array of
//   { item_a, item_b, confidence, reason }
// and `scanned` is the number of candidate pairs compared.

export async function detectDuplicateContentPairs(base44, items) {
  // Group items by shared ancestor_ids so we only compare items that have at least one ancestor in common
  const groups = new Map(); // ancestorId -> [items]
  for (const item of items) {
    const aids = item.ancestor_ids || [];
    if (aids.length === 0) continue;
    for (const aid of aids) {
      if (!groups.has(aid)) groups.set(aid, []);
      groups.get(aid).push(item);
    }
  }

  // Deduplicate candidate pairs across ancestor groups
  const comparedPairs = new Set();
  const candidatePairs = [];
  for (const [, groupItems] of groups) {
    const sorted = [...groupItems].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (!a.file_url && !b.file_url) continue;
        const pairKey = `${a.id}|${b.id}`;
        if (comparedPairs.has(pairKey)) continue;
        comparedPairs.add(pairKey);
        candidatePairs.push({ itemA: a, itemB: b });
      }
    }
  }

  if (candidatePairs.length === 0) {
    return { pairs: [], scanned: 0 };
  }

  const allDuplicates = [];

  for (const pair of candidatePairs) {
    const itemA = pair.itemA;
    const itemB = pair.itemB;

    // Pre-filter: exact same file URL = definite duplicate, no AI needed
    if (itemA.file_url && itemB.file_url && itemA.file_url === itemB.file_url) {
      allDuplicates.push({
        item_a: { id: itemA.id, title: itemA.title, content_type: itemA.content_type, date: itemA.date, location_name: itemA.location_name, file_url: itemA.file_url, saved_at: itemA.created_date },
        item_b: { id: itemB.id, title: itemB.title, content_type: itemB.content_type, date: itemB.date, location_name: itemB.location_name, file_url: itemB.file_url, saved_at: itemB.created_date },
        confidence: 1.0,
        reason: 'Identical file URL — exact same file uploaded twice.',
      });
      continue;
    }

    // Pre-filter: skip if content types are different (a photo vs a certificate is not a duplicate)
    if (itemA.content_type && itemB.content_type && itemA.content_type !== itemB.content_type) {
      if (itemA.content_type !== 'uncategorized' && itemB.content_type !== 'uncategorized') {
        continue;
      }
    }

    const fileUrls = [itemA.file_url, itemB.file_url].filter(Boolean);
    const pairData = {
      item_a: {
        id: itemA.id, title: itemA.title, content_type: itemA.content_type,
        date: itemA.date, location_name: itemA.location_name, saved_at: itemA.created_date,
        transcribed_text: itemA.transcribed_text ? itemA.transcribed_text.substring(0, 400) : '',
        extracted_fields: itemA.extracted_fields || {},
      },
      item_b: {
        id: itemB.id, title: itemB.title, content_type: itemB.content_type,
        date: itemB.date, location_name: itemB.location_name, saved_at: itemB.created_date,
        transcribed_text: itemB.transcribed_text ? itemB.transcribed_text.substring(0, 400) : '',
        extracted_fields: itemB.extracted_fields || {},
      },
    };

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a genealogical archive analyst. You are comparing TWO items from a family history archive to determine if they are DUPLICATES of each other.

A duplicate means both items depict the SAME physical photograph or document — e.g. the same photo uploaded twice (even at different quality or cropping), or the same certificate scanned at different times. Minor differences in scan quality or cropping still count as duplicates.

${fileUrls.length === 2 ? 'You have been provided with 2 images. Image 1 is item_a. Image 2 is item_b. Compare them visually.' : 'No images provided — compare using text data only.'}

Item A:
${JSON.stringify(pairData.item_a, null, 2)}

Item B:
${JSON.stringify(pairData.item_b, null, 2)}

Consider:
- Do the images show the same photograph or document?${fileUrls.length === 2 ? '' : ' (no images)'}
- Same extracted names, dates, document numbers, registration numbers?
- Same or very similar transcription text?
- Same event date and location?

CRITICAL: These are TWO DIFFERENT items about the SAME family. Only return is_duplicate=true if they are literally the SAME image or document (possibly scanned at different quality). Different photos of the same person, or different documents about the same person, are NOT duplicates.

Return JSON:
{ "is_duplicate": true/false, "confidence": 0.0 to 1.0, "reason": "explanation" }
Only return is_duplicate=true if confidence >= 0.7.`,
      ...(fileUrls.length > 0 ? { file_urls: fileUrls } : {}),
      response_json_schema: {
        type: 'object',
        properties: {
          is_duplicate: { type: 'boolean' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
      },
    });

    if (result?.is_duplicate && (result.confidence || 0) >= 0.7) {
      const reasonLower = (result.reason || '').toLowerCase();
      if (reasonLower.includes('not a duplicate') || reasonLower.includes('not duplicates') || reasonLower.includes('different files') || reasonLower.includes('distinct document') || reasonLower.includes('not the same') || reasonLower.includes('different photo') || reasonLower.includes('different image')) {
        continue;
      }
      allDuplicates.push({
        item_a: {
          id: itemA.id, title: itemA.title, content_type: itemA.content_type,
          date: itemA.date, location_name: itemA.location_name, file_url: itemA.file_url, saved_at: itemA.created_date,
        },
        item_b: {
          id: itemB.id, title: itemB.title, content_type: itemB.content_type,
          date: itemB.date, location_name: itemB.location_name, file_url: itemB.file_url, saved_at: itemB.created_date,
        },
        confidence: result.confidence,
        reason: result.reason,
      });
    }
  }

  return { pairs: allDuplicates, scanned: candidatePairs.length };
}