import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json();
    const { family_link_id } = body;
    if (!family_link_id) return Response.json({ error: 'family_link_id required' }, { status: 400 });

    const link = await base44.asServiceRole.entities.FamilyLink.get(family_link_id);
    if (!link) return Response.json({ error: 'Family link not found' }, { status: 404 });
    if (link.status === 'integrated') return Response.json({ error: 'Already integrated' }, { status: 400 });

    const ef = link.extracted_data || {};

    // 1. Update subject: set mother_id, father_id, partner_id + enrich dates/places
    if (link.subject_ancestor_id) {
      const updates = {};
      if (link.mother_ancestor_id) updates.mother_id = link.mother_ancestor_id;
      if (link.father_ancestor_id) updates.father_id = link.father_ancestor_id;
      if (link.partner_ancestor_id) updates.partner_id = link.partner_ancestor_id;
      if (ef.date_of_birth) updates.birth_date = ef.date_of_birth;
      if (ef.place_of_birth) updates.birth_place = ef.place_of_birth;
      if (ef.date_of_death) updates.death_date = ef.date_of_death;
      if (ef.place_of_death) updates.death_place = ef.place_of_death;
      if (ef.nationality) updates.nationality = ef.nationality;
      if (ef.occupation) updates.biography = ef.occupation;
      updates.review_status = 'admin_verified';
      updates.living = !ef.date_of_death;
      await base44.asServiceRole.entities.Ancestor.update(link.subject_ancestor_id, updates);
    }

    // 2. Update mother: set partner_id to father, promote from staged
    if (link.mother_ancestor_id) {
      const updates = { review_status: 'admin_verified' };
      if (link.father_ancestor_id) updates.partner_id = link.father_ancestor_id;
      await base44.asServiceRole.entities.Ancestor.update(link.mother_ancestor_id, updates);
    }

    // 3. Update father: set partner_id to mother, promote from staged
    if (link.father_ancestor_id) {
      const updates = { review_status: 'admin_verified' };
      if (link.mother_ancestor_id) updates.partner_id = link.mother_ancestor_id;
      await base44.asServiceRole.entities.Ancestor.update(link.father_ancestor_id, updates);
    }

    // 4. Update partner: set partner_id to subject, promote from staged
    if (link.partner_ancestor_id && link.subject_ancestor_id) {
      const updates = { partner_id: link.subject_ancestor_id, review_status: 'admin_verified' };
      await base44.asServiceRole.entities.Ancestor.update(link.partner_ancestor_id, updates);
    }

    // 5. Mark family link as integrated
    await base44.asServiceRole.entities.FamilyLink.update(family_link_id, {
      status: 'integrated',
      reviewed_by_id: user.id,
      reviewed_by_name: user.full_name || user.email,
    });

    // 6. Mark content item as reviewed (visible in tree/map/timeline)
    if (link.content_item_id) {
      await base44.asServiceRole.entities.ContentItem.update(link.content_item_id, {
        review_status: 'reviewed',
      });
    }

    return Response.json({ message: 'Family link integrated — relationships applied to ancestor records and family tree' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});