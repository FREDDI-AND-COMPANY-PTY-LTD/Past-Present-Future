import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const norm = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scopeAncestorIds = Array.isArray(body?.ancestor_ids) && body.ancestor_ids.length > 0 ? new Set(body.ancestor_ids) : null;

    const all = await base44.asServiceRole.entities.Ancestor.list('-created_date', 500);
    const ancestors = scopeAncestorIds ? (all || []).filter(a => scopeAncestorIds.has(a.id)) : (all || []);

    // Candidate pairs: share a normalised name, or share birth date + birth place.
    const byName = new Map();
    const byBirth = new Map();
    for (const a of ancestors) {
      const n = norm(a.full_name);
      if (n) {
        if (!byName.has(n)) byName.set(n, []);
        byName.get(n).push(a);
      }
      if (a.birth_date) {
        const key = `${a.birth_date}|${norm(a.birth_place || '')}`;
        if (!byBirth.has(key)) byBirth.set(key, []);
        byBirth.get(key).push(a);
      }
    }

    const seen = new Set();
    const candidates = [];
    const addPair = (x, y) => {
      const k = x.id < y.id ? `${x.id}|${y.id}` : `${y.id}|${x.id}`;
      if (seen.has(k)) return;
      seen.add(k);
      candidates.push([x, y]);
    };
    for (const list of byName.values()) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) addPair(list[i], list[j]);
    }
    for (const list of byBirth.values()) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) addPair(list[i], list[j]);
    }

    if (candidates.length === 0) {
      return Response.json({ duplicate_pairs: [], scanned: ancestors.length, candidates: 0 });
    }

    const slim = (a) => ({
      id: a.id,
      full_name: a.full_name,
      birth_date: a.birth_date,
      birth_place: a.birth_place,
      death_date: a.death_date,
      death_place: a.death_place,
      nationality: a.nationality,
      bloodline: a.bloodline,
      biography: a.biography ? a.biography.substring(0, 300) : '',
      mother_id: a.mother_id,
      father_id: a.father_id,
      partner_id: a.partner_id,
      user_account_id: a.user_account_id,
      living: a.living,
      review_status: a.review_status,
      created_date: a.created_date,
    });

    const pairs = [];
    for (const [a, b] of candidates) {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a genealogist comparing TWO ancestor profiles from a private family history archive. Decide whether they are the SAME PERSON (duplicates), or DIFFERENT people who happen to share a name/birthplace but have CONFLICTING data worth flagging.

Profile A:
${JSON.stringify(slim(a), null, 2)}

Profile B:
${JSON.stringify(slim(b), null, 2)}

Consider:
- Same full name (or obvious variants / misspellings of the same name)?
- Same birth date and birth place?
- Compatible parents/partner references?
- Same nationality / bloodline?
- One marked living, one deceased (strong conflict)?
- Could plausibly be the same individual recorded twice (e.g. a placeholder plus a verified record)?

Return JSON:
{ "is_duplicate": boolean, "confidence": 0.0-1.0, "reason": "short explanation", "conflict_fields": ["field names where A and B disagree, e.g. birth_date, nationality, living"] }

Only set is_duplicate=true when confidence >= 0.6. Include conflict_fields even for non-duplicates if the two records disagree on material facts. Return is_duplicate=false and empty conflict_fields when these are clearly two different people.`,
        response_json_schema: {
          type: 'object',
          properties: {
            is_duplicate: { type: 'boolean' },
            confidence: { type: 'number' },
            reason: { type: 'string' },
            conflict_fields: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      const isDup = result?.is_duplicate && (result.confidence || 0) >= 0.6;
      const conflicts = (result?.conflict_fields || []).filter((f) => f && f.length > 0);
      if (!isDup && conflicts.length === 0) continue;
      if ((result.confidence || 0) < 0.5) continue;

      pairs.push({
        ancestor_a: slim(a),
        ancestor_b: slim(b),
        confidence: result.confidence,
        reason: result.reason,
        conflict_fields: conflicts,
        is_duplicate: isDup,
      });
    }

    pairs.sort((x, y) => y.confidence - x.confidence);
    return Response.json({ duplicate_pairs: pairs, scanned: ancestors.length, candidates: candidates.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});