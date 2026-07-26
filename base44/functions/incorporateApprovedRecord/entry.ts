import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Triggered by entity automations whenever an admin approves or edits a
// ContentItem (event) or Ancestor. Incorporates the record into the app's
// interactive features:
//   - ContentItem (reviewed): geocodes the event location → appears on the Map;
//     certificate-type items also get a FamilyLink generated → flows into the
//     Family Tree review queue.
//   - Ancestor (approved/edited): collates data from tagged, reviewed content
//     items into the profile (document-backed fields auto-populate, hearsay
//     recorded as sources) → shows in the Family Tree with sourced data.
//
// Accepts the automation payload shape ({ event, data, old_data, changed_fields })
// or a direct admin call ({ entity_name, entity_id }). All writes use the
// service role so incorporation works regardless of which admin triggered it.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const event = body?.event;
    const entityName = event?.entity_name || body?.entity_name;
    const entityId = event?.entity_id || body?.entity_id;
    const changedFields = Array.isArray(body?.changed_fields) ? body.changed_fields : [];

    if (!entityName || !entityId) {
      return Response.json({ error: 'entity_name and entity_id required' }, { status: 400 });
    }

    const asRole = base44.asServiceRole;
    const steps = [];

    if (entityName === 'ContentItem') {
      const item = body?.data || await asRole.entities.ContentItem.get(entityId);
      if (!item) return Response.json({ error: 'ContentItem not found' }, { status: 404 });

      // Only incorporate items the admin has approved (reviewed).
      if (item.review_status !== 'reviewed') {
        return Response.json({ message: 'Item not yet reviewed — skipping incorporation', entity_id: entityId });
      }

      // 1. Geocode the event location so the item appears on the Map.
      const hasCoords = item.latitude != null && item.longitude != null;
      const locChanged = changedFields.includes('location_name') || changedFields.includes('publication_location_name');
      if ((item.location_name && !hasCoords) || (locChanged && item.location_name)) {
        try {
          const apiKey = Deno.env.get('APIKeyGoogleMaps');
          if (apiKey) {
            const q = item.location_name;
            const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${apiKey}`);
            const j = await r.json();
            if (j.results && j.results.length > 0) {
              const { lat, lng } = j.results[0].geometry.location;
              await asRole.entities.ContentItem.update(entityId, { latitude: lat, longitude: lng });
              steps.push({ step: 'geocode', ok: true, lat, lng });
            } else {
              steps.push({ step: 'geocode', ok: false, reason: 'no results', query: q });
            }
          } else {
            steps.push({ step: 'geocode', ok: false, reason: 'APIKeyGoogleMaps not set' });
          }
        } catch (e) {
          steps.push({ step: 'geocode', ok: false, error: e.message || String(e) });
        }
      }

      // 2. Certificate-type documents → generate/update a FamilyLink so the
      //    extracted relationships flow into the Family Tree review queue.
      const certTypes = ['certificate', 'passport', 'identity_document'];
      if (certTypes.includes(item.content_type)) {
        try {
          const allAncestors = await asRole.entities.Ancestor.list();
          const ef = item.extracted_fields || {};

          const findByName = (name) => {
            if (!name || !name.trim()) return null;
            const lower = name.toLowerCase().trim();
            let m = (allAncestors || []).find(a => (a.full_name || '').toLowerCase().trim() === lower);
            if (m) return m;
            const parts = lower.split(/\s+/);
            if (parts.length >= 2) {
              m = (allAncestors || []).find(a => {
                const ap = (a.full_name || '').toLowerCase().trim().split(/\s+/);
                return ap.length >= 2 && ap[0] === parts[0] && ap[ap.length - 1] === parts[parts.length - 1];
              });
            }
            return m || null;
          };

          const subjectName = ef.full_name || [ef.given_names, ef.surname].filter(Boolean).join(' ').trim();
          let subject = (item.ancestor_ids && item.ancestor_ids.length > 0)
            ? (allAncestors || []).find(a => a.id === item.ancestor_ids[0])
            : null;
          if (!subject && subjectName) subject = findByName(subjectName);
          const mother = ef.mother_name ? findByName(ef.mother_name) : null;
          const father = ef.father_name ? findByName(ef.father_name) : null;
          const partner = ef.spouse_name ? findByName(ef.spouse_name) : null;

          const linkData = {
            content_item_id: entityId,
            content_item_title: item.title,
            document_subtype: ef.document_subtype || '',
            subject_ancestor_id: subject ? subject.id : null,
            subject_name: subjectName || (subject ? subject.full_name : ''),
            subject_is_new: false,
            mother_ancestor_id: mother ? mother.id : null,
            mother_name: ef.mother_name || '',
            mother_is_new: false,
            father_ancestor_id: father ? father.id : null,
            father_name: ef.father_name || '',
            father_is_new: false,
            partner_ancestor_id: partner ? partner.id : null,
            partner_name: ef.spouse_name || '',
            partner_is_new: false,
            extracted_data: ef,
            status: 'pending',
          };

          const existing = await asRole.entities.FamilyLink.filter({ content_item_id: entityId });
          if (existing && existing.length > 0) {
            await asRole.entities.FamilyLink.update(existing[0].id, linkData);
            steps.push({ step: 'family_link', ok: true, action: 'updated' });
          } else {
            await asRole.entities.FamilyLink.create(linkData);
            steps.push({ step: 'family_link', ok: true, action: 'created' });
          }
        } catch (e) {
          steps.push({ step: 'family_link', ok: false, error: e.message || String(e) });
        }
      }

    } else if (entityName === 'Ancestor') {
      // Ancestor approved or edited → collate data from tagged, reviewed content
      // items into the profile (document-backed fields auto-populate, hearsay
      // recorded as sources).
      try {
        const ancestor = body?.data || await asRole.entities.Ancestor.get(entityId);
        if (!ancestor) return Response.json({ error: 'Ancestor not found' }, { status: 404 });

        const allItems = await asRole.entities.ContentItem.filter({ review_status: 'reviewed' });
        const tagged = (allItems || []).filter(i => Array.isArray(i.ancestor_ids) && i.ancestor_ids.includes(entityId));

        const fieldMap = {
          'birth_date': 'birth_date', 'date_of_birth': 'birth_date', 'dob': 'birth_date',
          'birth_place': 'birth_place', 'place_of_birth': 'birth_place', 'born_in': 'birth_place',
          'death_date': 'death_date', 'date_of_death': 'death_date',
          'death_place': 'death_place', 'place_of_death': 'death_place',
          'nationality': 'nationality', 'country': 'nationality',
        };
        const norm = (k) => String(k || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
        const certTypes = ['certificate', 'passport', 'identity_document'];

        const existingSources = await asRole.entities.Source.filter({ entity_type: 'Ancestor', entity_id: entityId });
        const keyOf = (s) => `${s.entity_id}|${s.field_name}|${s.content_item_id || ''}`;
        const keys = new Set((existingSources || []).map(keyOf));

        let sourcesCreated = 0;
        let fieldsPopulated = 0;

        for (const item of tagged) {
          const ef = item.extracted_fields;
          if (!ef || typeof ef !== 'object' || Object.keys(ef).length === 0) continue;
          const isCert = certTypes.includes(item.content_type);
          for (const [rawKey, rawValue] of Object.entries(ef)) {
            const f = fieldMap[norm(rawKey)];
            if (!f) continue;
            const val = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue || '').trim();
            if (!val) continue;
            const key = `${entityId}|${f}|${item.id}`;
            if (keys.has(key)) continue;
            keys.add(key);
            await asRole.entities.Source.create({
              entity_type: 'Ancestor',
              entity_id: entityId,
              field_name: f,
              source_type: isCert ? 'document' : 'hearsay',
              document_url: item.file_url || null,
              document_type: item.content_type || null,
              content_item_id: item.id,
              content_item_title: item.title || null,
              notes: `Auto-collated from "${item.title}" — "${rawKey}"`,
              validation_status: isCert ? 'validated' : 'hearsay',
            }).catch(() => {});
            sourcesCreated++;
            if (isCert && !ancestor[f]) {
              await asRole.entities.Ancestor.update(entityId, { [f]: val }).catch(() => {});
              ancestor[f] = val;
              fieldsPopulated++;
            }
          }
        }
        steps.push({ step: 'collate_ancestor', ok: true, sources_created: sourcesCreated, fields_populated: fieldsPopulated });
      } catch (e) {
        steps.push({ step: 'collate_ancestor', ok: false, error: e.message || String(e) });
      }

    } else {
      return Response.json({ error: `Unsupported entity: ${entityName}` }, { status: 400 });
    }

    return Response.json({ success: true, entity_name: entityName, entity_id: entityId, steps });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});