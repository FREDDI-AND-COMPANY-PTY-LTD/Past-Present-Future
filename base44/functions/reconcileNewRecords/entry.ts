import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Fields this job is allowed to write on an accepted ancestor record.
const ADOPTABLE = ['birth_date', 'birth_place', 'death_date', 'death_place', 'residence_place', 'nationality', 'maiden_name'];
const ACCEPTED_STATUSES = ['admin_verified', 'auto_approved', 'overwritten'];

const isDateValue = (v) => /^\d{4}(-\d{2}-\d{2})?$/.test(v);
const clean = (v) => (typeof v === 'string' ? v.trim().slice(0, 200) : '');
const clip = (v, n = 500) => (typeof v === 'string' ? v.slice(0, n) : v);

function evidenceOf(item) {
  const m = /Evidence level:\s*([A-Za-z \/]+)/.exec(item.description || '');
  if (m) {
    const raw = m[1].toLowerCase();
    if (raw.includes('documented')) return 'documented';
    if (raw.includes('hypothesis') || raw.includes('inferred')) return 'hypothesis';
    return 'testimony';
  }
  if ((item.tags || []).includes('speculative')) return 'hypothesis';
  return 'unstated';
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const onlyIds = Array.isArray(body.content_item_ids) ? body.content_item_ids : null;

    // ── 1. Suggestions awaiting a decision ──────────────────────────────
    let pending = await base44.asServiceRole.entities.ContentItem.filter({ review_status: 'pending' });
    // Never reconcile something that holds an uploaded file, a related-event child, or an external link.
    pending = (pending || []).filter((i) => !i.file_url && !i.thumbnail_url && !i.external_url && !i.parent_content_item_id);
    if (onlyIds) pending = pending.filter((i) => onlyIds.includes(i.id));
    pending = pending.slice(0, 25);

    if (!pending.length) {
      return Response.json({ status: 'idle', message: 'No pending suggestions to reconcile.', checked: 0 });
    }

    // ── 2. What the archive already accepts as true ─────────────────────
    const ancestors = await base44.asServiceRole.entities.Ancestor.list('-updated_date', 400);
    const accepted = (ancestors || []).filter((a) => ACCEPTED_STATUSES.includes(a.review_status));
    const acceptedIds = new Set(accepted.map((a) => a.id));
    function a_name(id) {
      const a = accepted.find((x) => x.id === id);
      return a ? a.full_name : '';
    }
    const context = accepted.map((a) => ({
      id: a.id,
      name: a.full_name,
      sex: a.sex || '',
      birth_date: a.birth_date || '',
      birth_place: a.birth_place || '',
      death_date: a.death_date || '',
      death_place: a.death_place || '',
      residence_place: a.residence_place || '',
      nationality: a.nationality || '',
      maiden_name: a.maiden_name || '',
      review_status: a.review_status,
    }));

    const suggestions = pending.map((i) => ({
      id: i.id,
      title: clip(i.title, 200),
      date: i.date || '',
      location: i.location_name || '',
      description: clip(i.description, 600),
      evidence: evidenceOf(i),
      tagged_ancestor_ids: i.ancestor_ids || [],
      tags: (i.tags || []).slice(0, 12),
    }));

    // ── 3. Compare each suggestion with the accepted record ─────────────
    const verdicts = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are the reconciliation reviewer for a private family-history archive. A suggestion has been extracted from a document or letter. The archive also holds records a human has already accepted as true. Decide, for each suggestion, whether it agrees with the archive, adds something the archive is missing, contradicts it, or is clearly wrong.

EVIDENCE ORDER (highest first):
1. documented — a certificate, register or official record quoted or held in the archive
2. testimony — a family member's account or a hand-drawn chart
3. hypothesis — an explicit guess or reconstruction

RULES:
- "agrees": the accepted record already states the same fact (same person, same fact, equivalent date/place). Do not propose changes.
- "adopt": the accepted record has NO value for that field, or the record's value came from testimony while the suggestion is documented. Propose the field and value. Only these fields may be proposed: ${ADOPTABLE.join(', ')}. Dates must be ISO (YYYY-MM-DD) or a year (YYYY); never invent a day or month that the suggestion does not state.
- "conflict": the suggestion contradicts an accepted recorded value and the evidence does not clearly win (e.g. testimony against documented, or two documented sources disagreeing). Do not propose a change.
- "wrong": the suggestion is clearly, significantly wrong — it is factually impossible given the accepted records (a person born after their own death, a child born before their parent, an event dated after the person died, the wrong person entirely), and nothing in it is salvageable. It may then be removed.
- "skip": the suggestion is not a factual claim about a person in the archive (for example correspondence, a visit, or a note with no record impact).
- Always pick the tagged ancestor whose record the claim is about, by id. If none fits, use target_ancestor_id "" and verdict "skip".
- Be conservative: when in doubt between adopt and conflict, choose conflict. Never guess a precise date, place or name that the suggestion does not state.

ACCEPTED RECORDS (already in the archive — treat as true):
${JSON.stringify(context, null, 1)}

SUGGESTIONS TO RECONCILE:
${JSON.stringify(suggestions, null, 1)}

Return one entry per suggestion.`,
      response_json_schema: {
        type: 'object',
        properties: {
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_id: { type: 'string' },
                verdict: { type: 'string', enum: ['adopt', 'agrees', 'conflict', 'wrong', 'skip'] },
                target_ancestor_id: { type: 'string' },
                field: { type: 'string' },
                value: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['item_id', 'verdict', 'reason'],
            },
          },
        },
        required: ['actions'],
      },
    });

    const results = Array.isArray(verdicts?.actions) ? verdicts.actions : [];
    const byId = new Map(pending.map((p) => [p.id, p]));
    const summary = { checked: pending.length, adopted: 0, agreed: 0, conflicts: 0, deleted: 0, skipped: 0, dry_run: dryRun, actions: [] };

    // Only these may ever be deleted; check nothing hangs off them first.
    const wrongIds = results.filter((r) => r.verdict === 'wrong' && byId.has(r.item_id)).map((r) => r.item_id);
    let withChildren = new Set();
    if (wrongIds.length) {
      const kids = await base44.asServiceRole.entities.ContentItem.filter({ parent_content_item_id: { $in: wrongIds } });
      withChildren = new Set((kids || []).map((k) => k.parent_content_item_id));
    }

    for (const r of results) {
      const item = byId.get(r.item_id);
      if (!item) continue;
      const reason = clean(r.reason) || 'Reconciled against accepted records';
      const note = `Reconciled ${new Date().toISOString().slice(0, 10)}: ${r.verdict} — ${reason}`;
      const appendNote = [item.categorization_notes, note].filter(Boolean).join('\n');

      try {
        if (r.verdict === 'adopt') {
          const field = clean(r.field);
          const value = clean(r.value);
          const target = clean(r.target_ancestor_id);
          const okField = ADOPTABLE.includes(field);
          const okValue = field.endsWith('_date') ? isDateValue(value) : value.length > 0 && value.length <= 200;
          if (!okField || !okValue || !acceptedIds.has(target)) {
            summary.skipped += 1;
            summary.actions.push({ item_id: item.id, verdict: 'skipped', why: 'proposed change failed validation' });
            continue;
          }
          if (!dryRun) {
            await base44.asServiceRole.entities.Ancestor.update(target, { [field]: value });
            await base44.asServiceRole.entities.Source.create({
              entity_type: 'Ancestor',
              entity_id: target,
              field_name: field,
              source_type: item.description && /Evidence level:\s*Documented/i.test(item.description) ? 'document' : 'hearsay',
              document_url: item.file_url || '',
              document_type: 'Extracted suggestion',
              content_item_id: item.id,
              content_item_title: item.title,
              provided_by_name: user.full_name || user.email || 'Reconciliation',
              validation_status: /Evidence level:\s*Documented/i.test(item.description || '') ? 'validated' : 'hearsay',
              notes: reason,
            });
            await base44.asServiceRole.entities.ContentItem.update(item.id, {
              review_status: 'reviewed',
              categorization_notes: `${appendNote}\nAdopted into ${a_name(target)} → ${field}`,
            });
            await base44.asServiceRole.entities.ActivityLog.create({
              action_type: 'edit',
              user_id: user.id,
              user_name: user.full_name || user.email || 'Reconciliation',
              content_item_id: item.id,
              content_item_title: item.title,
              ancestor_id: target,
              description: `Reconciliation adopted "${value}" into ${a_name(target)}.${field}`,
            });
          }
          summary.adopted += 1;
        } else if (r.verdict === 'agrees') {
          if (!dryRun) {
            await base44.asServiceRole.entities.ContentItem.update(item.id, { review_status: 'reviewed', categorization_notes: appendNote });
          }
          summary.agreed += 1;
        } else if (r.verdict === 'conflict') {
          if (!dryRun) {
            await base44.asServiceRole.entities.ConflictFlag.create({
              flag_type: 'dispute',
              status: 'open',
              field_name: clean(r.field) || item.title,
              content_item_id: item.id,
              ancestor_id: acceptedIds.has(clean(r.target_ancestor_id)) ? clean(r.target_ancestor_id) : null,
              dispute_description: `Reconciliation between a new suggestion and the accepted record: ${reason}`,
              competing_values: { suggestion: item.title, suggestion_description: clip(item.description, 500) },
              raised_by_name: 'Reconciliation',
              bloodline: 'Freddi',
            });
            await base44.asServiceRole.entities.ContentItem.update(item.id, { review_status: 'flagged', categorization_notes: appendNote });
          }
          summary.conflicts += 1;
        } else if (r.verdict === 'wrong') {
          if (!dryRun && !withChildren.has(item.id)) {
            await base44.asServiceRole.entities.ContentItem.delete(item.id);
            await base44.asServiceRole.entities.ActivityLog.create({
              action_type: 'delete',
              user_id: user.id,
              user_name: user.full_name || user.email || 'Reconciliation',
              content_item_title: item.title,
              description: `Reconciliation removed a suggestion that is clearly wrong: ${reason}`,
            });
            summary.deleted += 1;
          } else {
            summary.skipped += 1;
          }
        } else {
          summary.skipped += 1;
        }
        summary.actions.push({ item_id: item.id, verdict: r.verdict, field: r.field || null, value: r.value || null });
      } catch (err) {
        summary.actions.push({ item_id: item.id, verdict: r.verdict, error: err.message });
      }
    }

    return Response.json({ status: 'success', ...summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}