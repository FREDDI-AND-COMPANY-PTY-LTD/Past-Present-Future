import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Applies an AI-assistant / user-submitted RELATIONSHIP proposal to the family
// tree on admin approval — eliminating the manual "move the text into the right
// fields" step. For a proposal whose proposed_changes contains a new_mother /
// new_father / new_partner key (each { full_name, birth_place?, birth_date?,
// sex?, maiden_name? }), this creates the new ancestor profile(s), links them
// onto the target ancestor (mother_id / father_id / partner_id), and marks the
// proposal 'applied'. Any plain field:value keys in proposed_changes are also
// applied to the target ancestor. Admin-only.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const proposalId = body.proposal_id;
    if (!proposalId) return Response.json({ error: 'proposal_id is required' }, { status: 400 });

    const asRole = base44.asServiceRole;
    const proposal = await asRole.entities.Proposal.get(proposalId);
    if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });
    if (proposal.status !== 'pending') return Response.json({ error: `Proposal is ${proposal.status}, not pending` }, { status: 400 });
    if (proposal.target_type !== 'ancestor' || !proposal.target_id) {
      return Response.json({ error: 'Proposal must target an ancestor profile' }, { status: 400 });
    }

    const target = await asRole.entities.Ancestor.get(proposal.target_id);
    if (!target) return Response.json({ error: 'Target ancestor not found' }, { status: 404 });

    const changes = proposal.proposed_changes || {};
    const created = [];
    const linkUpdates = {};

    const relationFields = [
      { key: 'new_mother', linkField: 'mother_id', sex: 'female' },
      { key: 'new_father', linkField: 'father_id', sex: 'male' },
      { key: 'new_partner', linkField: 'partner_id', sex: null },
    ];

    for (const rel of relationFields) {
      const def = changes[rel.key];
      if (!def || typeof def !== 'object' || !def.full_name) continue;

      // Sex: explicit > inferred (opposite of target) > leave unset.
      let sex = def.sex || null;
      if (!sex && rel.linkField === 'partner_id' && target.sex) {
        sex = target.sex === 'male' ? 'female' : 'male';
      }
      if (!sex) sex = rel.sex;

      const newAncestor = await asRole.entities.Ancestor.create({
        full_name: def.full_name,
        sex,
        maiden_name: def.maiden_name || (sex === 'female' ? def.maiden_name : undefined) || null,
        birth_date: def.birth_date || null,
        birth_place: def.birth_place || null,
        living: def.living == null ? true : def.living,
        branch_id: target.branch_id || null,
        bloodline: target.bloodline || null,
        review_status: 'admin_verified',
        created_by_id: user.id,
        created_by_name: user.full_name || user.email,
      });
      created.push({ role: rel.key, ancestor_id: newAncestor.id, full_name: newAncestor.full_name });

      linkUpdates[rel.linkField] = newAncestor.id;
      // Bi-directional partner link.
      if (rel.linkField === 'partner_id') {
        await asRole.entities.Ancestor.update(newAncestor.id, { partner_id: target.id }).catch(() => {});
      }
    }

    // Apply any plain scalar field:value keys directly onto the target (e.g. a
    // birth_date correction accompanying the relationship change).
    const scalarKeys = Object.keys(changes).filter(
      (k) => !relationFields.some((r) => r.key === k)
    );
    const scalarUpdates = {};
    for (const k of scalarKeys) {
      const v = changes[k];
      if (v != null && typeof v !== 'object') scalarUpdates[k] = v;
    }

    const finalUpdates = { ...linkUpdates, ...scalarUpdates };
    if (Object.keys(finalUpdates).length > 0) {
      await asRole.entities.Ancestor.update(target.id, { ...finalUpdates, review_status: 'admin_verified' });
    }

    await asRole.entities.Proposal.update(proposalId, {
      status: 'applied',
      review_note: body.review_note || 'Approved & applied to the family tree.',
      reviewed_by_id: user.id,
      reviewed_by_name: user.full_name || user.email,
    });

    await asRole.entities.ActivityLog.create({
      action_type: 'edit',
      user_id: user.id,
      user_name: user.full_name,
      ancestor_id: target.id,
      description: `Applied relationship proposal "${proposal.summary}" — ${created.map((c) => `${c.role.replace('new_', '')}: ${c.full_name}`).join(', ') || 'no new relations'} linked to ${target.full_name}.`,
    }).catch(() => {});

    return Response.json({
      success: true,
      target_ancestor_id: target.id,
      created_ancestors: created,
      applied_fields: Object.keys(finalUpdates),
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});