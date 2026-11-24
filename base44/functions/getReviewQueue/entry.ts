import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireReviewer } from '../../shared/reviewAccess.ts';

// Unified, normalised review queue across every task-shaped entity.
// Non-destructive: reads only; the parallel `review_state` lifecycle decides
// what shows, and nothing here touches the entities' legacy `status` values.

const TYPES = ['duplicate', 'conflict', 'familylink', 'editrequest', 'problemreport', 'tag'];
const STATES = ['open', 'later', 'resolved', 'dismissed'];
const ESCALATED_CATEGORIES = ['dispute_between_bloodlines', 'dispute_branch_authority', 'appeal_global_admin'];

const short = (v, n = 160) => {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

const fmt = (v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') {
    try { return short(JSON.stringify(v), 120); } catch { return '[value]'; }
  }
  return short(v, 120);
};

const markOf = (left, right) => {
  if (right === '—') return 'new';
  if (left === '—') return 'diff';
  return left === right ? 'same' : 'diff';
};

const row = (label, left, right) => {
  const l = fmt(left);
  const r = fmt(right);
  return { label, left: l, right: r, mark: markOf(l, r) };
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await requireReviewer(base44);
    if (access.error) return Response.json({ error: access.error }, { status: access.status });

    const body = await req.json().catch(() => ({}));
    const scopeMode = body.scope === 'global' ? 'global' : 'branch';
    const typeFilter = TYPES.includes(body.type) ? body.type : null;
    const stateFilter = STATES.includes(body.status) ? body.status : 'open';

    const [flags, links, edits, problems, assertions, comments] = await Promise.all([
      base44.asServiceRole.entities.ConflictFlag.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.FamilyLink.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.EditRequest.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.ProblemReport.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.Assertion.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.Comment.list('-created_date', 500).catch(() => []),
    ]);

    const ancestorsById = new Map((access.ancestors || []).map((a) => [a.id, a]));
    const itemsById = new Map((access.items || []).map((i) => [i.id, i]));
    const ancestorName = (id) => (id && ancestorsById.get(id)?.full_name) || '—';
    const itemTitle = (id) => (id && itemsById.get(id)?.title) || '—';
    const inContent = (id) => !!id && access.contentItemIds.has(id);
    const inAncestors = (id) => !!id && access.ancestorIds.has(id);

    // ── Branch scope predicates (same derivation as BranchAdminDashboard) ──
    const flagInBranch = (f) => inAncestors(f.ancestor_id) || inContent(f.content_item_id) || inContent(f.duplicate_of_content_item_id);
    const linkInBranch = (l) => inContent(l.content_item_id) ||
      [l.subject_ancestor_id, l.mother_ancestor_id, l.father_ancestor_id, l.partner_ancestor_id].some(inAncestors);
    const editInBranch = (r) => inContent(r.content_item_id);
    const problemInBranch = (p) => !!p.branch_id && access.adminBranchIds.has(p.branch_id);
    const assertionInBranch = (a) => (!!a.branch_id && access.adminBranchIds.has(a.branch_id)) ||
      (a.subject_type === 'ancestor' && inAncestors(a.subject_id)) ||
      (a.subject_type === 'content_item' && inContent(a.subject_id));
    const commentInBranch = (c) =>
      (c.entity_type === 'ContentItem' && inContent(c.entity_id)) ||
      (c.entity_type === 'Ancestor' && inAncestors(c.entity_id));

    const isEscalated = (p) => p.source === 'branch_admin_request' || ESCALATED_CATEGORIES.includes(p.category);

    // Global scope for a branch admin = cross-branch items plus escalations;
    // a global admin sees everything.
    const select = (records, inBranch, escalated = null) => {
      if (access.isGlobalAdmin) return records;
      if (scopeMode === 'branch') return records.filter(inBranch);
      if (escalated) return records.filter(escalated);
      return records.filter((r) => !inBranch(r));
    };

    // ── Normalisers: one shape for every source entity ──
    const normaliseFlag = (f) => {
      const isDuplicate = f.flag_type === 'duplicate_upload' || f.flag_type === 'duplicate_ancestor';
      let title = `Disputed: ${f.field_name || 'record'}`;
      let compare = [row('Field', f.field_name, '')];
      let where = 'Archive record';
      let survivor_options = null;

      if (f.flag_type === 'duplicate_upload') {
        const a = itemsById.get(f.content_item_id);
        const b = itemsById.get(f.duplicate_of_content_item_id);
        title = `${itemTitle(f.content_item_id)} ↔ ${f.duplicate_of_content_item_title || itemTitle(f.duplicate_of_content_item_id)}`;
        compare = [
          row('Title', a?.title, b?.title),
          row('Date', a?.date, b?.date),
          row('Location', a?.location_name, b?.location_name),
          row('Scan filed', a?.file_url ? 'yes' : 'no', b?.file_url ? 'yes' : 'no'),
        ];
        where = a?.location_name || b?.location_name || 'Archive item';
        survivor_options = [
          { id: f.content_item_id, label: itemTitle(f.content_item_id) },
          { id: f.duplicate_of_content_item_id, label: f.duplicate_of_content_item_title || itemTitle(f.duplicate_of_content_item_id) },
        ].filter((o, i, arr) => o.id && arr.findIndex((x) => x.id === o.id) === i);
      } else if (f.flag_type === 'duplicate_ancestor') {
        const a = ancestorsById.get(f.ancestor_id);
        const b = ancestorsById.get(f.duplicate_of_ancestor_id);
        title = `${ancestorName(f.ancestor_id)} ↔ ${f.duplicate_of_ancestor_name || ancestorName(f.duplicate_of_ancestor_id)}`;
        compare = [
          row('Name', a?.full_name, b?.full_name),
          row('Born', a?.birth_date, b?.birth_date),
          row('Birth place', a?.birth_place, b?.birth_place),
          row('Died', a?.death_date, b?.death_date),
        ];
        where = a?.bloodline || b?.bloodline || 'Ancestor profiles';
        survivor_options = [
          { id: f.ancestor_id, label: ancestorName(f.ancestor_id) },
          { id: f.duplicate_of_ancestor_id, label: f.duplicate_of_ancestor_name || ancestorName(f.duplicate_of_ancestor_id) },
        ].filter((o, i, arr) => o.id && arr.findIndex((x) => x.id === o.id) === i);
      } else {
        if (f.content_item_id) title = `Disputed: ${itemTitle(f.content_item_id)}`;
        where = f.content_item_id ? itemTitle(f.content_item_id) : (f.bloodline || 'Archive record');
        const competing = f.competing_values || {};
        const keys = Object.keys(competing);
        if (keys.length) {
          compare = keys.map((k) => row(k.replace(/_/g, ' '), competing[k], ''));
        }
      }

      return {
        source_entity: 'ConflictFlag',
        id: f.id,
        type: isDuplicate ? 'duplicate' : 'conflict',
        scope: flagInBranch(f) ? 'branch' : 'global',
        title,
        subtitle: short(f.dispute_description, 220),
        where,
        survivor_options,
        confidence: f.duplicate_confidence ?? null,
        priority: isDuplicate && (f.duplicate_confidence || 0) >= 0.85 ? 'high' : 'medium',
        created_date: f.created_date,
        review_state: f.review_state || 'open',
        compare,
      };
    };

    const normaliseLink = (l) => ({
      source_entity: 'FamilyLink',
      id: l.id,
      type: 'familylink',
      scope: linkInBranch(l) ? 'branch' : 'global',
      title: `${l.subject_name || ancestorName(l.subject_ancestor_id)} — family link`,
      subtitle: short(l.content_item_title || 'Relationships extracted from a certificate', 220),
      where: l.content_item_title || 'Certificate upload',
      confidence: null,
      priority: 'medium',
      created_date: l.created_date,
      review_state: l.review_state || 'open',
      compare: [
        row('Subject', l.subject_name, ancestorName(l.subject_ancestor_id)),
        row('Mother', l.mother_name, ancestorName(l.mother_ancestor_id)),
        row('Father', l.father_name, ancestorName(l.father_ancestor_id)),
        row('Spouse', l.partner_name, ancestorName(l.partner_ancestor_id)),
      ],
    });

    const normaliseEdit = (r) => {
      const original = r.original_values || {};
      const proposed = r.proposed_changes || {};
      return {
        source_entity: 'EditRequest',
        id: r.id,
        type: 'editrequest',
        scope: editInBranch(r) ? 'branch' : 'global',
        title: r.content_item_title || 'Edit request',
        subtitle: short(r.reason || 'Proposed changes to this record', 220),
        where: r.content_item_title || 'Archive record',
        confidence: null,
        priority: 'medium',
        created_date: r.created_date,
        review_state: r.review_state || 'open',
        compare: Object.keys(proposed).map((k) => row(k.replace(/_/g, ' '), original[k], proposed[k])),
      };
    };

    const normaliseProblem = (p) => ({
      source_entity: 'ProblemReport',
      id: p.id,
      type: 'problemreport',
      scope: problemInBranch(p) ? 'branch' : 'global',
      title: p.title || 'Problem report',
      subtitle: short(p.description, 220),
      where: p.branch_name || 'Archive-wide',
      confidence: null,
      priority: p.priority || 'medium',
      created_date: p.created_date,
      review_state: p.review_state || 'open',
      compare: [
        row('Category', p.category || 'general_problem', p.source || 'user_report'),
        row('Branch', p.branch_name, p.connected_branch_name),
      ],
    });

    const normaliseAssertion = (a) => {
      const competing = (assertions || []).find((x) =>
        x.id !== a.id && x.subject_id === a.subject_id && x.field_name === a.field_name &&
        x.status === 'active' && x.value !== a.value
      );
      return {
        source_entity: 'Assertion',
        id: a.id,
        type: 'conflict',
        scope: assertionInBranch(a) ? 'branch' : 'global',
        title: `${a.subject_label || ancestorName(a.subject_id)} — ${a.field_name || 'claim'}`,
        subtitle: short(a.value_display || a.value, 220),
        where: a.source_label || ancestorName(a.subject_id),
        confidence: null,
        priority: a.conflict ? 'high' : 'medium',
        created_date: a.created_date,
        review_state: a.review_state || 'open',
        compare: [
          row(a.field_name || 'Value', a.value, competing ? competing.value : ''),
          row('Grade', a.grade, competing ? competing.grade : ''),
        ],
      };
    };

    const normaliseComment = (c) => ({
      source_entity: 'Comment',
      id: c.id,
      type: 'tag',
      scope: commentInBranch(c) ? 'branch' : 'global',
      title: `Tagged by ${c.author_name || 'a family member'}`,
      subtitle: short(c.content, 220),
      where: c.entity_type === 'Ancestor' ? ancestorName(c.entity_id) : itemTitle(c.entity_id),
      confidence: null,
      priority: c.is_query ? 'high' : 'medium',
      created_date: c.created_date,
      review_state: c.review_state || 'open',
      compare: [
        row('On', c.entity_type === 'Ancestor' ? ancestorName(c.entity_id) : itemTitle(c.entity_id), c.field_name),
        { label: 'Kind', left: c.is_query ? 'Query' : 'Comment', right: '—', mark: 'new' },
      ],
    });

    // ── Scoped sets, then normalise ──
    const scoped = [
      ...select(flags || [], flagInBranch).map(normaliseFlag),
      ...select(links || [], linkInBranch).map(normaliseLink),
      ...select(edits || [], editInBranch).map(normaliseEdit),
      ...select(problems || [], problemInBranch, isEscalated).map(normaliseProblem),
      ...select(assertions || [], assertionInBranch).map(normaliseAssertion),
      ...select((comments || []).filter((c) => (c.tagged_user_ids || []).includes(access.user.id)), commentInBranch).map(normaliseComment),
    ];

    const by_type = {};
    for (const t of TYPES) by_type[t] = 0;
    const by_state = {};
    for (const s of STATES) by_state[s] = 0;
    for (const item of scoped) {
      if (by_type[item.type] != null) by_type[item.type] += 1;
      if (by_state[item.review_state] != null) by_state[item.review_state] += 1;
    }

    const items = scoped
      .filter((i) => (typeFilter ? i.type === typeFilter : true))
      .filter((i) => i.review_state === stateFilter)
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));

    return Response.json({
      scope: scopeMode,
      status: stateFilter,
      type: typeFilter,
      total: scoped.length,
      items,
      counts: { by_type, by_state },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}