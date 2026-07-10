import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { content_item_id } = body;
    if (!content_item_id) return Response.json({ error: 'content_item_id required' }, { status: 400 });

    const item = await base44.asServiceRole.entities.ContentItem.get(content_item_id);
    if (!item) return Response.json({ error: 'Content item not found' }, { status: 404 });

    // Only process certificate-type documents
    const certificateTypes = ['certificate', 'passport', 'identity_document'];
    if (!certificateTypes.includes(item.content_type)) {
      return Response.json({ message: 'Not a certificate-type document — no family links generated' });
    }

    const ef = item.extracted_fields || {};
    const subtype = ef.document_subtype || '';

    // Gather all ancestors for name matching
    const allAncestors = await base44.asServiceRole.entities.Ancestor.list();

    // Helper: find ancestor by name (exact, then given+surname)
    const findByName = (name) => {
      if (!name || !name.trim()) return null;
      const lower = name.toLowerCase().trim();
      let match = allAncestors.find(a => (a.full_name || '').toLowerCase().trim() === lower);
      if (match) return match;
      const parts = lower.split(/\s+/);
      if (parts.length >= 2) {
        const given = parts[0];
        const surname = parts[parts.length - 1];
        match = allAncestors.find(a => {
          const aParts = (a.full_name || '').toLowerCase().trim().split(/\s+/);
          return aParts.length >= 2 && aParts[0] === given && aParts[aParts.length - 1] === surname;
        });
        if (match) return match;
      }
      return null;
    };

    // Helper: create placeholder ancestor (staged)
    const createPlaceholder = async (name, data = {}) => {
      if (!name || !name.trim()) return null;
      const hasDeath = !!data.death_date;
      const created = await base44.asServiceRole.entities.Ancestor.create({
        full_name: name.trim(),
        birth_date: data.birth_date || null,
        birth_place: data.birth_place || null,
        death_date: data.death_date || null,
        death_place: data.death_place || null,
        nationality: data.nationality || null,
        living: !hasDeath,
        review_status: 'staged',
        created_by_id: user.id,
        created_by_name: user.full_name || user.email,
      });
      return created;
    };

    // Determine subject ancestor
    const subjectName = ef.full_name || [ef.given_names, ef.surname].filter(Boolean).join(' ').trim();
    let subjectAncestor = null;
    let subjectIsNew = false;

    // First: try from tagged ancestors on the content item
    if (item.ancestor_ids && item.ancestor_ids.length > 0) {
      subjectAncestor = allAncestors.find(a => a.id === item.ancestor_ids[0]);
    }
    // Then: try name match
    if (!subjectAncestor && subjectName) {
      subjectAncestor = findByName(subjectName);
    }
    // Create placeholder if no match
    if (!subjectAncestor && subjectName) {
      subjectAncestor = await createPlaceholder(subjectName, {
        birth_date: ef.date_of_birth,
        birth_place: ef.place_of_birth,
        death_date: ef.date_of_death,
        death_place: ef.place_of_death,
        nationality: ef.nationality,
        occupation: ef.occupation,
      });
      subjectIsNew = !!subjectAncestor;
    }

    // Determine mother
    let motherAncestor = null;
    let motherIsNew = false;
    if (ef.mother_name) {
      motherAncestor = findByName(ef.mother_name);
      if (!motherAncestor) {
        motherAncestor = await createPlaceholder(ef.mother_name, { nationality: ef.nationality });
        motherIsNew = !!motherAncestor;
      }
    }

    // Determine father
    let fatherAncestor = null;
    let fatherIsNew = false;
    if (ef.father_name) {
      fatherAncestor = findByName(ef.father_name);
      if (!fatherAncestor) {
        fatherAncestor = await createPlaceholder(ef.father_name, { nationality: ef.nationality });
        fatherIsNew = !!fatherAncestor;
      }
    }

    // Determine partner/spouse
    let partnerAncestor = null;
    let partnerIsNew = false;
    if (ef.spouse_name) {
      partnerAncestor = findByName(ef.spouse_name);
      if (!partnerAncestor) {
        partnerAncestor = await createPlaceholder(ef.spouse_name, { nationality: ef.nationality });
        partnerIsNew = !!partnerAncestor;
      }
    }

    // Build the FamilyLink data
    const linkData = {
      content_item_id,
      content_item_title: item.title,
      document_subtype: subtype,
      subject_ancestor_id: subjectAncestor?.id || null,
      subject_name: subjectName || subjectAncestor?.full_name || '',
      subject_is_new: subjectIsNew,
      mother_ancestor_id: motherAncestor?.id || null,
      mother_name: ef.mother_name || '',
      mother_is_new: motherIsNew,
      father_ancestor_id: fatherAncestor?.id || null,
      father_name: ef.father_name || '',
      father_is_new: fatherIsNew,
      partner_ancestor_id: partnerAncestor?.id || null,
      partner_name: ef.spouse_name || '',
      partner_is_new: partnerIsNew,
      extracted_data: ef,
      status: 'pending',
      created_by_id: user.id,
      created_by_name: user.full_name || user.email,
    };

    // Check if a FamilyLink already exists for this content item
    const existing = await base44.asServiceRole.entities.FamilyLink.filter({ content_item_id });
    if (existing && existing.length > 0) {
      const updated = await base44.asServiceRole.entities.FamilyLink.update(existing[0].id, linkData);
      return Response.json({ family_link: updated, message: 'Family link updated — pending admin approval' });
    }

    const familyLink = await base44.asServiceRole.entities.FamilyLink.create(linkData);
    return Response.json({ family_link: familyLink, message: 'Family link created — pending admin approval' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});