import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ─────────────────────────────────────────────────────────────
// Archive core backfill — phase one.
//
// Builds the evidence and event layers over records that already
// exist, WITHOUT changing or deleting anything:
//   1. assigns permanent reference codes (F-xxxx, I-xxxxx, EV-xxxxx)
//   2. records each existing record value as an Assertion — the
//      value exactly as held, with its evidence grade and citation
//   3. groups dated archive items into canonical Events
//
// Idempotent: safe to run repeatedly; existing codes and assertions
// are never duplicated. Pass { content_item_id } to do one item.
// ─────────────────────────────────────────────────────────────

const ANCESTOR_FIELDS = [
  'full_name',
  'maiden_name',
  'birth_date',
  'birth_place',
  'death_date',
  'death_place',
  'residence_place',
  'nationality',
];

const SUBTYPE_TO_EVENT = {
  birth_certificate: 'birth',
  death_certificate: 'death',
  marriage_certificate: 'marriage',
  baptism_or_church_record: 'baptism',
  passenger_manifest_or_ship_record: 'arrival',
  passport_or_travel_document: 'travel',
  naturalization_or_citizenship: 'naturalisation',
  military_record: 'military',
  immigration_or_border_record: 'arrival',
};

const VALID_EVENT_TYPES = new Set([
  'birth', 'baptism', 'marriage', 'death', 'burial', 'migration', 'arrival',
  'departure', 'military', 'occupation', 'residence', 'naturalisation',
  'travel', 'family_gathering', 'milestone', 'other',
]);

const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
const pad = (n, size) => String(n).padStart(size, '0');

// Read every record of an entity. filter() is used when a query is given,
// list() otherwise — both return arrays on this client version.
async function loadAll(db, name, query = null) {
  const res = query ? await db[name].filter(query) : await db[name].list('-created_date', 500);
  return Array.isArray(res) ? res : (res?.items || []);
}

function nextNumber(codes, prefix, size) {
  let max = 0;
  for (const code of codes) {
    if (!code || !code.startsWith(prefix)) continue;
    const n = parseInt(code.slice(prefix.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

// Datable? Returns the best date string and how precise it is.
function readDate(item) {
  const extracted = item.narrative_extraction || {};
  const raw = item.date || '';
  const display = extracted.event_date_display || raw;
  const iso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

  if (iso(raw)) return { event_date: raw, date_display: display, date_certainty: 'day' };
  if (extracted.event_date && iso(extracted.event_date)) {
    return { event_date: extracted.event_date, date_display: display, date_certainty: 'day' };
  }
  if (/^\d{4}-\d{2}$/.test(raw)) return { event_date: '', date_display: display, date_certainty: 'month' };
  if (/^\d{4}$/.test(raw)) return { event_date: '', date_display: display, date_certainty: 'year' };
  if (/circa|around|about|approx/i.test(display)) {
    return { event_date: '', date_display: display, date_certainty: 'circa' };
  }
  // Ignore placeholder values — an undated item is not an event.
  if (display && !/^(unknown|undated|n\/a|none|-+|\?)$/i.test(display.trim())) {
    return { event_date: '', date_display: display, date_certainty: 'unknown' };
  }
  return null;
}

function eventTypeFor(item) {
  const declared = norm(item.narrative_extraction?.event_type);
  if (VALID_EVENT_TYPES.has(declared)) return declared;
  const subtype = item.extracted_fields?.document_subtype;
  if (subtype && SUBTYPE_TO_EVENT[subtype]) return SUBTYPE_TO_EVENT[subtype];
  if (item.content_type === 'memorial') return 'death';
  return 'other';
}

Deno.serve(async (req) => {
  let step = 'start';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const singleItemId = body.content_item_id || null;
    if (!singleItemId && user.role !== 'admin') {
      return Response.json({ error: 'Only a global admin can run the full backfill' }, { status: 403 });
    }

    const db = base44.asServiceRole.entities;
    const now = new Date().toISOString();

    step = 'load-ancestors';
    const ancestors = await loadAll(db, 'Ancestor');
    const ancestorById = new Map(ancestors.map((a) => [a.id, a]));
    const ancestorByName = new Map();
    for (const a of ancestors) if (a.full_name) ancestorByName.set(norm(a.full_name), a);

    step = 'load-assertions';
    const existingAssertions = await loadAll(db, 'Assertion');
    const assertionKeys = new Set(
      existingAssertions.map((a) => `${a.subject_id}|${a.field_name}|${norm(a.value)}`)
    );
    const newAssertions = [];
    const queueAssertion = (payload) => {
      const key = `${payload.subject_id}|${payload.field_name}|${norm(payload.value)}`;
      if (assertionKeys.has(key)) return;
      assertionKeys.add(key);
      newAssertions.push(payload);
    };

    // ── Reference codes for ancestors and archive items ──
    let codesAssigned = 0;
    const uncodedAncestors = ancestors
      .filter((a) => !a.ref_code)
      .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
    if (uncodedAncestors.length) {
      let n = nextNumber(ancestors.map((a) => a.ref_code), 'F-', 4);
      const updates = uncodedAncestors.map((a) => ({ id: a.id, ref_code: `F-${pad(n++, 4)}` }));
      for (const u of updates) {
        const record = ancestorById.get(u.id);
        if (record) record.ref_code = u.ref_code;
      }
      step = 'code-ancestors';
      await db.Ancestor.bulkUpdate(updates);
      codesAssigned += updates.length;
    }

    step = 'load-items';
    const items = singleItemId
      ? [await db.ContentItem.get(singleItemId)]
      : await loadAll(db, 'ContentItem');
    const liveItems = items.filter(Boolean);

    let itemCodes = 0;
    if (!singleItemId) {
      const uncoded = liveItems
        .filter((i) => !i.ref_code)
        .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
      if (uncoded.length) {
        let n = nextNumber(liveItems.map((i) => i.ref_code), 'I-', 6);
        const updates = uncoded.map((i) => ({ id: i.id, ref_code: `I-${pad(n++, 6)}` }));
        for (const u of updates) {
          const record = liveItems.find((i) => i.id === u.id);
          if (record) record.ref_code = u.ref_code;
        }
        step = 'code-items';
        await db.ContentItem.bulkUpdate(updates);
        itemCodes = updates.length;
        codesAssigned += updates.length;
      }
    }

    // ── Assertions from the values the records already hold ──
    step = 'load-sources';
    const sources = !singleItemId
      ? await loadAll(db, 'Source', { entity_type: 'Ancestor' })
      : [];
    const sourceMap = new Map();
    for (const s of sources) {
      const key = `${s.entity_id}|${s.field_name}`;
      const prior = sourceMap.get(key);
      const strong = s.source_type === 'document' || s.validation_status === 'validated';
      const priorStrong = prior && (prior.source_type === 'document' || prior.validation_status === 'validated');
      if (!prior || (strong && !priorStrong)) sourceMap.set(key, s);
    }

    if (!singleItemId) {
      for (const a of ancestors) {
        for (const field of ANCESTOR_FIELDS) {
          const raw = a[field];
          if (raw === undefined || raw === null || String(raw).trim() === '') continue;
          const source = sourceMap.get(`${a.id}|${field}`);
          const documented = !!source && (source.source_type === 'document' || source.validation_status === 'validated');
          queueAssertion({
            subject_type: 'ancestor',
            subject_id: a.id,
            subject_label: a.full_name || '',
            field_name: field,
            value: String(raw).trim(),
            grade: documented ? 'documented' : 'testimony',
            source_type: documented ? 'document' : 'testimony',
            source_content_item_id: source?.content_item_id || null,
            source_label: source?.content_item_title || source?.document_type || '',
            asserted_by_id: a.created_by_id || null,
            asserted_by_name: a.created_by_name || 'Archive record',
            asserted_at: a.created_date || now,
            status: 'active',
            accepted: true,
            branch_id: a.branch_id || null,
            notes: source ? '' : 'Carried forward from the existing record; no source document attached',
          });
        }
      }
    }

    // ── Assertions from graded statements on a citing item ──
    const statementsFor = (item) => {
      const fromText = item.raw_ai_analysis?.text_analysis?.statements || [];
      const fromImage = item.raw_ai_analysis?.claims || [];
      return [...fromText, ...fromImage].filter((s) => s && s.person && s.field && s.value);
    };

    for (const item of liveItems) {
      for (const st of statementsFor(item)) {
        const ancestor = ancestorByName.get(norm(st.person));
        if (!ancestor) continue;
        const grade = ['documented', 'testimony', 'hypothesis'].includes(st.grade) ? st.grade : 'testimony';
        queueAssertion({
          subject_type: 'ancestor',
          subject_id: ancestor.id,
          subject_label: ancestor.full_name || '',
          field_name: st.field,
          value: String(st.value).trim(),
          grade,
          source_type: grade === 'documented' ? 'document' : grade === 'hypothesis' ? 'inference' : 'testimony',
          source_content_item_id: item.id,
          source_label: item.title || '',
          source_excerpt: st.claim || '',
          asserted_by_id: item.uploaded_by_id || null,
          asserted_by_name: 'Reading of a source',
          asserted_at: item.created_date || now,
          status: 'active',
          accepted: false,
          branch_id: item.branch_id || ancestor.branch_id || null,
        });
      }
    }

    if (newAssertions.length) {
      step = 'create-assertions';
      for (let i = 0; i < newAssertions.length; i += 100) {
        await db.Assertion.bulkCreate(newAssertions.slice(i, i + 100));
      }
    }

    // ── Flag fields where the archive now holds competing values ──
    const allAssertions = await loadAll(db, 'Assertion');
    const byField = new Map();
    for (const a of allAssertions) {
      if (a.status !== 'active') continue;
      const key = `${a.subject_id}|${a.field_name}`;
      if (!byField.has(key)) byField.set(key, new Set());
      byField.get(key).add(norm(a.value));
    }
    const conflictUpdates = allAssertions
      .filter((a) => a.status === 'active')
      .map((a) => {
        const contested = (byField.get(`${a.subject_id}|${a.field_name}`)?.size || 0) > 1;
        return contested !== !!a.conflict ? { id: a.id, conflict: contested } : null;
      })
      .filter(Boolean);
    if (conflictUpdates.length) {
      step = 'flag-conflicts';
      for (let i = 0; i < conflictUpdates.length; i += 100) {
        await db.Assertion.bulkUpdate(conflictUpdates.slice(i, i + 100));
      }
    }

    // ── Canonical events from dated archive items ──
    step = 'load-events';
    const events = singleItemId ? [] : await loadAll(db, 'Event');
    const eventByItem = new Map(events.filter((e) => e.derived_from_content_item_id).map((e) => [e.derived_from_content_item_id, e]));
    let eventNumber = nextNumber(events.map((e) => e.ref_code), 'EV-', 6);
    const newEvents = [];

    for (const item of liveItems) {
      if (!item || item.parent_content_item_id) continue;
      if (eventByItem.has(item.id)) continue;
      const dateInfo = readDate(item);
      if (!dateInfo) continue;

      const participants = (item.ancestor_ids || [])
        .map((aid) => ancestorById.get(aid))
        .filter(Boolean)
        .map((a) => ({ ancestor_id: a.id, name: a.full_name || '', role: 'subject' }));

      const documentedTypes = ['certificate', 'passport', 'identity_document', 'press_clipping'];
      newEvents.push({
        ref_code: `EV-${pad(eventNumber++, 6)}`,
        event_type: eventTypeFor(item),
        event_date: dateInfo.event_date || '',
        date_display: dateInfo.date_display || '',
        date_certainty: dateInfo.date_certainty,
        place_name: item.location_name || '',
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        description: item.narrative_extraction?.event_description || item.description || '',
        participants,
        certainty: documentedTypes.includes(item.content_type) ? 'documented' : 'testimony',
        evidence_item_ids: [item.id],
        derived_from_content_item_id: item.id,
        source_count: 1,
        branch_id: item.branch_id || null,
        status: 'active',
      });
    }

    if (newEvents.length) {
      step = 'create-events';
      for (let i = 0; i < newEvents.length; i += 100) {
        await db.Event.bulkCreate(newEvents.slice(i, i + 100));
      }
    }

    return Response.json({
      success: true,
      scope: singleItemId ? `item ${singleItemId}` : 'full archive',
      codes_assigned: codesAssigned,
      item_codes_assigned: itemCodes,
      assertions_created: newAssertions.length,
      assertions_flagged_conflicting: conflictUpdates.length,
      events_created: newEvents.length,
      totals: {
        ancestors: ancestors.length,
        items: liveItems.length,
        assertions: allAssertions.length,
        events: events.length + newEvents.length,
      },
    });
  } catch (error) {
    return Response.json({
      error: error.message,
      step,
      detail: error?.response?.data ?? null,
    }, { status: 500 });
  }
});