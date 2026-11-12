import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { detectDuplicateContentPairs } from '../../shared/duplicateDetection.ts';

// Scheduled job: for each administered branch, scan that bloodline's content for
// duplicates and alert the branch admin by email when NEW duplicate pairs are
// found. New pairs are persisted as open ConflictFlags so the same pair is not
// re-reported on subsequent runs, and so they remain reviewable in the archive.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Scheduled runs carry no user session; the job operates as service role.
    // If invoked manually by a signed-in non-admin, deny.
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const [branches, allAncestors, allItems] = await Promise.all([
      base44.asServiceRole.entities.Branch.list().catch(() => []),
      base44.asServiceRole.entities.Ancestor.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.ContentItem.list('-created_date', 500).catch(() => []),
    ]);

    const administered = (branches || []).filter((b) => b.admin_user_id);

    // Pre-load existing open duplicate-upload flags so we only alert on genuinely new pairs.
    const existingFlags = await base44.asServiceRole.entities.ConflictFlag
      .filter({ flag_type: 'duplicate_upload', status: 'open' })
      .catch(() => []);
    const knownPairKeys = new Set();
    for (const f of (existingFlags || [])) {
      if (f.content_item_id && f.duplicate_of_content_item_id) {
        knownPairKeys.add(`${f.content_item_id}|${f.duplicate_of_content_item_id}`);
        knownPairKeys.add(`${f.duplicate_of_content_item_id}|${f.content_item_id}`);
      }
    }

    const results = [];
    let totalNew = 0;

    for (const branch of administered) {
      // Compute this branch's bloodline: descendants of the branch root + partners + direct-branch ancestors.
      const descIds = new Set(branch.ancestor_id ? [branch.ancestor_id] : []);
      let changed = true;
      while (changed) {
        changed = false;
        for (const a of (allAncestors || [])) {
          if (descIds.has(a.id)) continue;
          if ((a.mother_id && descIds.has(a.mother_id)) || (a.father_id && descIds.has(a.father_id))) {
            descIds.add(a.id);
            changed = true;
          }
        }
      }
      for (const a of (allAncestors || [])) {
        if (descIds.has(a.id) && a.partner_id) descIds.add(a.partner_id);
        if (a.branch_id && a.branch_id === branch.id) descIds.add(a.id);
      }

      const branchItems = (allItems || []).filter((i) =>
        (i.branch_id && i.branch_id === branch.id) ||
        (i.ancestor_ids || []).some((aid) => descIds.has(aid))
      );

      if (branchItems.length < 2) {
        results.push({ branch: branch.name, skipped: true, reason: 'fewer than 2 items' });
        continue;
      }

      const { pairs } = await detectDuplicateContentPairs(base44, branchItems, { skipPairKeys: knownPairKeys });

      const newPairs = [];
      const runSeen = new Set();
      for (const p of pairs) {
        const key = `${p.item_a.id}|${p.item_b.id}`;
        if (knownPairKeys.has(key) || runSeen.has(key)) continue;
        runSeen.add(key);
        knownPairKeys.add(key); // don't alert another branch / later run for the same pair
        newPairs.push(p);
      }

      if (newPairs.length === 0) {
        results.push({ branch: branch.name, newDuplicates: 0 });
        continue;
      }

      // Persist each new pair as an open ConflictFlag for tracking + dedup.
      for (const p of newPairs) {
        await base44.asServiceRole.entities.ConflictFlag.create({
          content_item_id: p.item_a.id,
          duplicate_of_content_item_id: p.item_b.id,
          duplicate_of_content_item_title: p.item_b.title,
          flag_type: 'duplicate_upload',
          status: 'open',
          duplicate_confidence: p.confidence,
          raised_by_id: null,
          raised_by_name: 'Automated Duplicate Scan',
          dispute_description: `Potential duplicate detected by automated archive scan: "${p.item_a.title}" and "${p.item_b.title}". ${p.reason || ''}`,
          bloodline: branch.name,
        }).catch(() => {});
      }

      // Send the branch admin a task (a Comment tagging them) so it surfaces in
      // their Tasks list and notification popup — no email for these minor conflicts.
      const list = newPairs
        .map((p) => `\u2022 "${p.item_a.title}" \u2194 "${p.item_b.title}" (${Math.round((p.confidence || 0) * 100)}%)`)
        .join('\n');
      await base44.asServiceRole.entities.Comment.create({
        entity_type: 'ContentItem',
        entity_id: newPairs[0].item_a.id,
        field_name: 'duplicate_review',
        author_id: null,
        author_name: 'Automated Duplicate Scan',
        content:
          `${newPairs.length} new potential duplicate ${newPairs.length > 1 ? 'entries were' : 'entry was'} detected in the ${branch.name} bloodline during the nightly archive scan:\n\n` +
          `${list}\n\n` +
          `Review and resolve them under Branch Admin \u2192 Branch Review \u2192 Duplicates (click "Scan for Duplicates").`,
        tagged_user_ids: [branch.admin_user_id],
        is_query: false,
      }).catch(() => {});

      totalNew += newPairs.length;
      results.push({ branch: branch.name, newDuplicates: newPairs.length, taskSent: true });
    }

    return Response.json({
      success: true,
      branchesScanned: administered.length,
      totalNewDuplicates: totalNew,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});