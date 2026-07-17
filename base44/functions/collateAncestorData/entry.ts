import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Periodic collation: scans approved event uploads (ContentItems) tagged to each Ancestor,
// extracts certificate/text data from their `extracted_fields` data set, and funnels it into
// the Ancestor profile as Source records.
//   - Certificate / passport / identity document types → document-backed (validated) sources
//     that ALSO auto-populate empty Ancestor fields.
//   - All other text-bearing content (photos, narratives, press clippings, correspondence) →
//     hearsay sources recorded for admin/family confirmation (no auto-population).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const targetAncestorId = body?.ancestor_id || null;

    // Load ancestors
    let ancestors;
    if (targetAncestorId) {
      const a = await base44.asServiceRole.entities.Ancestor.get(targetAncestorId).catch(() => null);
      ancestors = a ? [a] : [];
    } else {
      ancestors = await base44.asServiceRole.entities.Ancestor.list();
    }
    if (!ancestors || ancestors.length === 0) {
      return Response.json({ message: 'No ancestors to process', ancestors_processed: 0 });
    }

    // Load all approved content items (the "data sets")
    const allItems = await base44.asServiceRole.entities.ContentItem.filter({ review_status: 'reviewed' });

    // Load existing Ancestor sources for idempotent dedup
    const existingSources = await base44.asServiceRole.entities.Source.filter({ entity_type: 'Ancestor' });
    const sourceKey = (s) => `${s.entity_id}|${s.field_name}|${s.content_item_id || ''}`;
    const existingKeys = new Set((existingSources || []).map(sourceKey));

    const summary = {
      ancestors_processed: 0,
      content_items_scanned: 0,
      sources_created: 0,
      fields_populated: 0,
      errors: [],
    };

    // Map extracted_fields keys (normalized) → Ancestor field name
    const fieldMapping = {
      'birth_date': 'birth_date', 'date_of_birth': 'birth_date', 'dob': 'birth_date',
      'birthdate': 'birth_date', 'born': 'birth_date', 'date_of_birth_': 'birth_date',
      'birth_place': 'birth_place', 'place_of_birth': 'birth_place', 'birthplace': 'birth_place',
      'born_at': 'birth_place', 'born_in': 'birth_place',
      'death_date': 'death_date', 'date_of_death': 'death_date', 'deathdate': 'death_date',
      'died': 'death_date',
      'death_place': 'death_place', 'place_of_death': 'death_place', 'deathplace': 'death_place',
      'died_at': 'death_place', 'died_in': 'death_place',
      'nationality': 'nationality', 'citizenship': 'nationality',
      'country_of_origin': 'nationality', 'country': 'nationality',
      'biography': 'biography', 'bio': 'biography',
      'occupation': 'biography', 'profession': 'biography',
    };

    const normalizeKey = (k) => String(k || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    const certificateTypes = ['certificate', 'passport', 'identity_document'];

    for (const ancestor of ancestors) {
      try {
        const taggedItems = (allItems || []).filter(item =>
          Array.isArray(item.ancestor_ids) && item.ancestor_ids.includes(ancestor.id)
        );

        for (const item of taggedItems) {
          summary.content_items_scanned++;
          const extracted = item.extracted_fields;
          if (!extracted || typeof extracted !== 'object' || Object.keys(extracted).length === 0) continue;

          const isCertificate = certificateTypes.includes(item.content_type);

          for (const [rawKey, rawValue] of Object.entries(extracted)) {
            const ancestorField = fieldMapping[normalizeKey(rawKey)];
            if (!ancestorField) continue;

            const value = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue || '').trim();
            if (!value) continue;

            const key = `${ancestor.id}|${ancestorField}|${item.id}`;
            if (existingKeys.has(key)) continue;
            existingKeys.add(key);

            await base44.asServiceRole.entities.Source.create({
              entity_type: 'Ancestor',
              entity_id: ancestor.id,
              field_name: ancestorField,
              source_type: isCertificate ? 'document' : 'hearsay',
              document_url: item.file_url || null,
              document_type: item.content_type || null,
              content_item_id: item.id,
              content_item_title: item.title || null,
              provided_by_id: item.uploaded_by_id || null,
              provided_by_name: null,
              notes: `Auto-collated from "${item.title}" — extracted field "${rawKey}"`,
              validation_status: isCertificate ? 'validated' : 'hearsay',
            }).catch(() => {});
            summary.sources_created++;

            // Auto-populate empty ancestor fields ONLY from document-backed (certificate) data.
            // Hearsay text is recorded as a source for confirmation, but does not overwrite the profile.
            if (isCertificate) {
              const currentValue = ancestor[ancestorField];
              if (!currentValue || String(currentValue).trim() === '') {
                let updateValue = value;
                if (ancestorField === 'biography' && currentValue) {
                  updateValue = currentValue + '\n' + value;
                }
                await base44.asServiceRole.entities.Ancestor.update(ancestor.id, {
                  [ancestorField]: updateValue,
                }).catch(() => {});
                ancestor[ancestorField] = updateValue;
                summary.fields_populated++;
              }
            }
          }
        }
        summary.ancestors_processed++;
      } catch (e) {
        summary.errors.push({ ancestor_id: ancestor.id, name: ancestor.full_name, error: e.message || String(e) });
      }
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});