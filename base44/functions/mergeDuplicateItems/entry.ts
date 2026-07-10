import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { keep_item_id, remove_item_id } = body;
    if (!keep_item_id || !remove_item_id) {
      return Response.json({ error: 'keep_item_id and remove_item_id are required' }, { status: 400 });
    }
    if (keep_item_id === remove_item_id) {
      return Response.json({ error: 'Cannot merge an item with itself' }, { status: 400 });
    }

    const keepItem = await base44.asServiceRole.entities.ContentItem.get(keep_item_id);
    const removeItem = await base44.asServiceRole.entities.ContentItem.get(remove_item_id);
    if (!keepItem) return Response.json({ error: 'Keep item not found' }, { status: 404 });
    if (!removeItem) return Response.json({ error: 'Remove item not found' }, { status: 404 });

    // Determine which was saved first — the earliest-saved becomes the primary (keep)
    const keepDate = new Date(keepItem.created_date);
    const removeDate = new Date(removeItem.created_date);
    let primary = keepItem;
    let secondary = removeItem;
    let primaryIsEarliest = true;

    if (removeDate < keepDate) {
      // The user chose to keep the later one — swap so we merge INTO the earliest-saved,
      // then update the keep_item_id reference at the end.
      primary = removeItem;
      secondary = keepItem;
      primaryIsEarliest = false;
    }

    // ── Merge data: fill missing fields on primary with values from secondary ──
    const merged = { ...primary };

    // Merge ancestor_ids (union)
    const primaryAncestors = new Set(primary.ancestor_ids || []);
    for (const aid of (secondary.ancestor_ids || [])) primaryAncestors.add(aid);
    merged.ancestor_ids = [...primaryAncestors];

    // Fill in missing scalar fields from secondary
    const scalarFields = ['title', 'description', 'date', 'location_name', 'latitude', 'longitude', 'era', 'transcribed_text', 'external_url', 'historical_background'];
    for (const field of scalarFields) {
      if ((!primary[field] || primary[field] === '') && secondary[field]) {
        merged[field] = secondary[field];
      }
    }

    // Merge extracted_fields — fill missing keys from secondary
    if (secondary.extracted_fields) {
      const mergedEF = { ...(primary.extracted_fields || {}) };
      for (const [key, val] of Object.entries(secondary.extracted_fields)) {
        if ((!mergedEF[key] || mergedEF[key] === '') && val) {
          mergedEF[key] = val;
        }
      }
      merged.extracted_fields = mergedEF;
    }

    // Merge visual_elements — fill missing arrays from secondary
    if (secondary.visual_elements) {
      const mergedVE = { ...(primary.visual_elements || {}) };
      for (const [key, val] of Object.entries(secondary.visual_elements)) {
        if (Array.isArray(val) && val.length > 0) {
          const existing = new Set(mergedVE[key] || []);
          for (const v of val) existing.add(v);
          mergedVE[key] = [...existing];
        } else if ((!mergedVE[key] || mergedVE[key] === '') && val) {
          mergedVE[key] = val;
        }
      }
      merged.visual_elements = mergedVE;
    }

    // Merge tags (union)
    const primaryTags = new Set(primary.tags || []);
    for (const tag of (secondary.tags || [])) primaryTags.add(tag);
    merged.tags = [...primaryTags];

    // Use the better AI confidence (higher of the two)
    if (secondary.ai_confidence != null && (merged.ai_confidence == null || secondary.ai_confidence > merged.ai_confidence)) {
      merged.ai_confidence = secondary.ai_confidence;
    }

    // Use the better review status (reviewed > pending > flagged)
    const statusRank = { reviewed: 3, pending: 2, flagged: 1 };
    if ((statusRank[secondary.review_status] || 0) > (statusRank[merged.review_status] || 0)) {
      merged.review_status = secondary.review_status;
    }

    // Update the primary item with merged data
    await base44.asServiceRole.entities.ContentItem.update(primary.id, {
      ancestor_ids: merged.ancestor_ids,
      title: merged.title,
      description: merged.description,
      date: merged.date,
      location_name: merged.location_name,
      latitude: merged.latitude,
      longitude: merged.longitude,
      era: merged.era,
      transcribed_text: merged.transcribed_text,
      external_url: merged.external_url,
      historical_background: merged.historical_background,
      extracted_fields: merged.extracted_fields,
      visual_elements: merged.visual_elements,
      tags: merged.tags,
      ai_confidence: merged.ai_confidence,
      review_status: merged.review_status,
    });

    // ── Re-point all comments from the secondary item to the primary ──
    const comments = await base44.asServiceRole.entities.Comment.filter({ entity_type: 'ContentItem', entity_id: secondary.id });
    for (const comment of (comments || [])) {
      await base44.asServiceRole.entities.Comment.update(comment.id, { entity_id: primary.id }).catch(() => {});
    }

    // ── Re-point conflict flags from secondary to primary ──
    const flags = await base44.asServiceRole.entities.ConflictFlag.filter({ content_item_id: secondary.id });
    for (const flag of (flags || [])) {
      await base44.asServiceRole.entities.ConflictFlag.update(flag.id, { content_item_id: primary.id }).catch(() => {});
    }

    // ── Re-point edit requests from secondary to primary ──
    const editReqs = await base44.asServiceRole.entities.EditRequest.filter({ content_item_id: secondary.id });
    for (const er of (editReqs || [])) {
      await base44.asServiceRole.entities.EditRequest.update(er.id, { content_item_id: primary.id }).catch(() => {});
    }

    // ── Re-point family links from secondary to primary ──
    const familyLinks = await base44.asServiceRole.entities.FamilyLink.filter({ content_item_id: secondary.id });
    for (const fl of (familyLinks || [])) {
      await base44.asServiceRole.entities.FamilyLink.update(fl.id, { content_item_id: primary.id }).catch(() => {});
    }

    // ── Delete the secondary item ──
    await base44.asServiceRole.entities.ContentItem.delete(secondary.id);

    // ── Log the merge activity ──
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'delete',
      user_id: user.id,
      user_name: user.full_name,
      content_item_id: primary.id,
      content_item_title: primary.title,
      description: `Merged duplicate "${secondary.title}" into "${primary.title}" (earliest-saved kept as primary).`,
    }).catch(() => {});

    return Response.json({
      success: true,
      kept_item_id: primary.id,
      removed_item_id: secondary.id,
      kept_item_is_earliest: primaryIsEarliest,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});