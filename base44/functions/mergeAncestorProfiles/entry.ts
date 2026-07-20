import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { keep_ancestor_id, remove_ancestor_id } = body;
    if (!keep_ancestor_id || !remove_ancestor_id) {
      return Response.json({ error: 'keep_ancestor_id and remove_ancestor_id are required' }, { status: 400 });
    }
    if (keep_ancestor_id === remove_ancestor_id) {
      return Response.json({ error: 'Cannot merge a profile with itself' }, { status: 400 });
    }

    const keep = await base44.asServiceRole.entities.Ancestor.get(keep_ancestor_id);
    const remove = await base44.asServiceRole.entities.Ancestor.get(remove_ancestor_id);
    if (!keep) return Response.json({ error: 'Keep profile not found' }, { status: 404 });
    if (!remove) return Response.json({ error: 'Remove profile not found' }, { status: 404 });

    const merged = { ...keep };
    const scalars = [
      'birth_date', 'birth_place', 'death_date', 'death_place',
      'nationality', 'biography', 'bloodline', 'era',
      'profile_photo', 'birth_certificate', 'marriage_certificate', 'passport_document',
    ];
    for (const f of scalars) {
      if ((!keep[f] || keep[f] === '') && remove[f]) merged[f] = remove[f];
    }
    // A deceased flag on either record wins.
    if (remove.living === false) merged.living = false;
    // Inherit a linked user account if the keep record lacks one.
    if (!keep.user_account_id && remove.user_account_id) merged.user_account_id = remove.user_account_id;
    // Inherit relationships from the removed record when keep lacks them (and they don't point at keep/remove).
    for (const f of ['mother_id', 'father_id', 'partner_id']) {
      if (!keep[f] && remove[f] && remove[f] !== keep.id && remove[f] !== remove.id) merged[f] = remove[f];
    }

    await base44.asServiceRole.entities.Ancestor.update(keep.id, {
      birth_date: merged.birth_date,
      birth_place: merged.birth_place,
      death_date: merged.death_date,
      death_place: merged.death_place,
      nationality: merged.nationality,
      biography: merged.biography,
      bloodline: merged.bloodline,
      era: merged.era,
      profile_photo: merged.profile_photo,
      birth_certificate: merged.birth_certificate,
      marriage_certificate: merged.marriage_certificate,
      passport_document: merged.passport_document,
      living: merged.living,
      user_account_id: merged.user_account_id,
      mother_id: merged.mother_id,
      father_id: merged.father_id,
      partner_id: merged.partner_id,
      review_status: 'admin_verified',
    });

    // Re-point family references on every other ancestor.
    const allAncestors = await base44.asServiceRole.entities.Ancestor.list('-created_date', 500);
    for (const a of (allAncestors || [])) {
      if (a.id === keep.id || a.id === remove.id) continue;
      const upd = {};
      if (a.mother_id === remove.id) upd.mother_id = keep.id;
      if (a.father_id === remove.id) upd.father_id = keep.id;
      if (a.partner_id === remove.id) upd.partner_id = keep.id;
      if (Object.keys(upd).length) {
        await base44.asServiceRole.entities.Ancestor.update(a.id, upd).catch(() => {});
      }
    }

    // Re-point ContentItems that tagged the removed ancestor.
    const items = await base44.asServiceRole.entities.ContentItem.list('-created_date', 500);
    for (const it of (items || [])) {
      const ids = it.ancestor_ids || [];
      if (!ids.includes(remove.id)) continue;
      const next = ids.filter((x) => x !== remove.id);
      if (!next.includes(keep.id)) next.push(keep.id);
      await base44.asServiceRole.entities.ContentItem.update(it.id, { ancestor_ids: next }).catch(() => {});
    }

    // Migration routes owned by the removed ancestor.
    const routes = await base44.asServiceRole.entities.MigrationRoute.list('-created_date', 200);
    for (const r of (routes || [])) {
      if (r.ancestor_id === remove.id) {
        await base44.asServiceRole.entities.MigrationRoute.update(r.id, { ancestor_id: keep.id }).catch(() => {});
      }
    }

    // Sources + comments attached to the removed ancestor profile.
    const sources = await base44.asServiceRole.entities.Source.filter({ entity_type: 'Ancestor', entity_id: remove.id });
    for (const s of (sources || [])) {
      await base44.asServiceRole.entities.Source.update(s.id, { entity_id: keep.id }).catch(() => {});
    }
    const comments = await base44.asServiceRole.entities.Comment.filter({ entity_type: 'Ancestor', entity_id: remove.id });
    for (const c of (comments || [])) {
      await base44.asServiceRole.entities.Comment.update(c.id, { entity_id: keep.id }).catch(() => {});
    }

    // Conflict flags raised against the removed ancestor.
    const flags = await base44.asServiceRole.entities.ConflictFlag.filter({ ancestor_id: remove.id });
    for (const f of (flags || [])) {
      await base44.asServiceRole.entities.ConflictFlag.update(f.id, { ancestor_id: keep.id }).catch(() => {});
    }

    // Family links referencing the removed ancestor in any role.
    const flFields = ['subject_ancestor_id', 'mother_ancestor_id', 'father_ancestor_id', 'partner_ancestor_id'];
    const allLinks = await base44.asServiceRole.entities.FamilyLink.list('-created_date', 500);
    for (const fl of (allLinks || [])) {
      const upd = {};
      for (const f of flFields) if (fl[f] === remove.id) upd[f] = keep.id;
      if (Object.keys(upd).length) {
        await base44.asServiceRole.entities.FamilyLink.update(fl.id, upd).catch(() => {});
      }
    }

    // Delete the merged-away profile.
    await base44.asServiceRole.entities.Ancestor.delete(remove.id);

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'edit',
      user_id: user.id,
      user_name: user.full_name,
      ancestor_id: keep.id,
      description: `Merged ancestor profile "${remove.full_name}" into "${keep.full_name}" and approved.`,
    }).catch(() => {});

    return Response.json({
      success: true,
      kept_ancestor_id: keep.id,
      removed_ancestor_id: remove.id,
      kept_name: keep.full_name,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});