import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { keep_item_id, remove_item_id, field_resolutions, contested_fields, raised_queries } = body;

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

    // ── Build merged data from field-by-field resolutions ──
    const merged = { ...keepItem };

    const scalarFields = ['title', 'description', 'date', 'location_name', 'latitude', 'longitude', 'era', 'transcribed_text', 'external_url'];

    for (const [field, resolution] of Object.entries(field_resolutions || {})) {
      if (resolution.source === 'remove') {
        if (scalarFields.includes(field)) {
          merged[field] = removeItem[field];
        } else if (field.startsWith('extracted_fields.')) {
          const efKey = field.replace('extracted_fields.', '');
          const mergedEF = { ...(merged.extracted_fields || {}) };
          if (removeItem.extracted_fields?.[efKey] != null) {
            mergedEF[efKey] = removeItem.extracted_fields[efKey];
          }
          merged.extracted_fields = mergedEF;
        }
      }
      // 'keep' = use keepItem's value (already in merged)
    }

    // Always union ancestor_ids
    const ancestorSet = new Set([...(keepItem.ancestor_ids || []), ...(removeItem.ancestor_ids || [])]);
    merged.ancestor_ids = [...ancestorSet];

    // Always union tags
    const tagSet = new Set([...(keepItem.tags || []), ...(removeItem.tags || [])]);
    merged.tags = [...tagSet];

    // Use better AI confidence
    if (removeItem.ai_confidence != null && (merged.ai_confidence == null || removeItem.ai_confidence > merged.ai_confidence)) {
      merged.ai_confidence = removeItem.ai_confidence;
    }

    // Use better review status
    const statusRank = { reviewed: 3, pending: 2, flagged: 1 };
    if ((statusRank[removeItem.review_status] || 0) > (statusRank[merged.review_status] || 0)) {
      merged.review_status = removeItem.review_status;
    }

    // Update keep item with merged data
    await base44.asServiceRole.entities.ContentItem.update(keep_item_id, {
      title: merged.title,
      description: merged.description,
      date: merged.date,
      location_name: merged.location_name,
      latitude: merged.latitude,
      longitude: merged.longitude,
      era: merged.era,
      transcribed_text: merged.transcribed_text,
      external_url: merged.external_url,
      extracted_fields: merged.extracted_fields,
      ancestor_ids: merged.ancestor_ids,
      tags: merged.tags,
      ai_confidence: merged.ai_confidence,
      review_status: merged.review_status,
    });

    // ── Create contested field flags ──
    for (const cf of (contested_fields || [])) {
      await base44.asServiceRole.entities.ConflictFlag.create({
        content_item_id: keep_item_id,
        field_name: cf.field,
        flag_type: 'contested',
        dispute_description: cf.comment || `Field "${cf.field}" is contested between merged items`,
        competing_values: cf.competing_values || {},
        status: 'open',
        raised_by_id: user.id,
        raised_by_name: user.full_name,
      }).catch(() => {});
    }

    // ── Create raised queries as Comments (tagged user gets a task) ──
    for (const rq of (raised_queries || [])) {
      await base44.asServiceRole.entities.Comment.create({
        entity_type: 'ContentItem',
        entity_id: keep_item_id,
        field_name: rq.field,
        content: rq.query_text || `Please verify the correct value for this field — competing values exist between merged items.`,
        author_id: user.id,
        author_name: user.full_name,
        is_query: true,
        tagged_user_ids: rq.target_user_id ? [rq.target_user_id] : [],
        acknowledged_by: [],
      }).catch(() => {});
    }

    // ── Re-point all comments from remove item to keep item ──
    const comments = await base44.asServiceRole.entities.Comment.filter({ entity_type: 'ContentItem', entity_id: remove_item_id });
    for (const comment of (comments || [])) {
      await base44.asServiceRole.entities.Comment.update(comment.id, { entity_id: keep_item_id }).catch(() => {});
    }

    // ── Re-point conflict flags ──
    const flags = await base44.asServiceRole.entities.ConflictFlag.filter({ content_item_id: remove_item_id });
    for (const flag of (flags || [])) {
      await base44.asServiceRole.entities.ConflictFlag.update(flag.id, { content_item_id: keep_item_id }).catch(() => {});
    }

    // ── Re-point edit requests ──
    const editReqs = await base44.asServiceRole.entities.EditRequest.filter({ content_item_id: remove_item_id });
    for (const er of (editReqs || [])) {
      await base44.asServiceRole.entities.EditRequest.update(er.id, { content_item_id: keep_item_id }).catch(() => {});
    }

    // ── Re-point family links ──
    const familyLinks = await base44.asServiceRole.entities.FamilyLink.filter({ content_item_id: remove_item_id });
    for (const fl of (familyLinks || [])) {
      await base44.asServiceRole.entities.FamilyLink.update(fl.id, { content_item_id: keep_item_id }).catch(() => {});
    }

    // ── Delete the remove item ──
    await base44.asServiceRole.entities.ContentItem.delete(remove_item_id);

    // ── Log the merge activity ──
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'delete',
      user_id: user.id,
      user_name: user.full_name,
      content_item_id: keep_item_id,
      content_item_title: keepItem.title,
      description: `Resolved duplicate: merged "${removeItem.title}" into "${keepItem.title}" with field-by-field resolution (${(contested_fields || []).length} contested, ${(raised_queries || []).length} queries raised).`,
    }).catch(() => {});

    return Response.json({
      success: true,
      kept_item_id: keep_item_id,
      removed_item_id: remove_item_id,
      contested_count: (contested_fields || []).length,
      queries_count: (raised_queries || []).length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});