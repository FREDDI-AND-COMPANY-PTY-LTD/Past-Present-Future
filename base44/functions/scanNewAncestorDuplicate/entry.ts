import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Triggered by an entity automation whenever a new Ancestor record is created
// (e.g. a placeholder generated from a certificate upload). Scans the existing
// archive for ancestors who share the same family (surname) line and a matching
// given name, asks the LLM to confirm they are the same person, and — when
// confirmed — raises a `duplicate_ancestor` ConflictFlag so the reviewer is
// presented with a Merge / Add New (keep both) choice in the merge-review queue.
//
// Payload: automation shape ({ event, data }) or direct call ({ ancestor_id }).
// All reads/writes use the service role so the scan works regardless of caller.

const norm = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function parseName(full) {
  const tokens = norm(full).split(' ').filter(Boolean);
  if (tokens.length === 0) return { given: '', surname: '', tokens: [] };
  return {
    given: tokens[0],
    surname: tokens.length >= 2 ? tokens[tokens.length - 1] : tokens[0],
    tokens,
  };
}

// Family-name duplication candidate: same surname AND the first given name
// matches (so "Elijah Freddi" vs "Elijah Jack Freddi" pair, but siblings
// "Elijah Freddi" vs "Jack Freddi" do not).
function isFamilyNameCandidate(a, b) {
  const na = parseName(a.full_name);
  const nb = parseName(b.full_name);
  if (!na.surname || !nb.surname) return false;
  if (na.surname !== nb.surname) return false;
  // Exact normalised name match is always a candidate.
  if (norm(a.full_name) === norm(b.full_name)) return true;
  // Same first given name.
  if (na.given && na.given === nb.given) return true;
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const event = body?.event;
    const entityId = event?.entity_id || body?.ancestor_id;
    if (!entityId) {
      return Response.json({ error: 'ancestor_id required' }, { status: 400 });
    }

    const asRole = base44.asServiceRole;
    const newAncestor = body?.data || await asRole.entities.Ancestor.get(entityId);
    if (!newAncestor) {
      return Response.json({ error: 'Ancestor not found' }, { status: 404 });
    }
    // Only scan real profiles with a parseable surname.
    if (!parseName(newAncestor.full_name).surname) {
      return Response.json({ message: 'No surname to scan — skipping', ancestor_id: entityId });
    }

    const all = await asRole.entities.Ancestor.list('-created_date', 500);
    const ancestors = (all || []).filter((a) => a.id !== newAncestor.id);

    // Candidate existing ancestors by family-name similarity.
    const candidates = ancestors.filter((a) => isFamilyNameCandidate(a, newAncestor));
    if (candidates.length === 0) {
      return Response.json({ message: 'No family-name duplicates found', ancestor_id: entityId, candidates: 0 });
    }

    // Avoid re-flagging a pair that already has an open duplicate_ancestor flag.
    const existingFlags = await asRole.entities.ConflictFlag.filter({ flag_type: 'duplicate_ancestor', status: 'open' });
    const pairAlreadyFlagged = (xId, yId) => (existingFlags || []).some((f) =>
      (f.ancestor_id === xId && f.duplicate_of_ancestor_id === yId) ||
      (f.ancestor_id === yId && f.duplicate_of_ancestor_id === xId)
    );

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

    const flagged = [];
    for (const candidate of candidates) {
      if (pairAlreadyFlagged(newAncestor.id, candidate.id)) continue;

      const result = await asRole.integrations.Core.InvokeLLM({
        prompt: `You are a genealogist comparing TWO ancestor profiles from a private family history archive. One is a newly added profile (often a placeholder from a certificate upload), the other is an existing profile. Decide whether they are the SAME PERSON (duplicates) or DIFFERENT people.

New profile:
${JSON.stringify(slim(newAncestor), null, 2)}

Existing profile:
${JSON.stringify(slim(candidate), null, 2)}

Consider:
- Same given name AND same surname/family line?
- Compatible birth date / birth place?
- Compatible parents or partner?
- Could plausibly be the same individual recorded twice (e.g. a short placeholder name "Elijah Freddi" plus a fuller verified name "Elijah Jack Freddi")?
- One marked living, one deceased (strong conflict)?

Return JSON:
{ "is_duplicate": boolean, "confidence": 0.0-1.0, "reason": "short explanation", "conflict_fields": ["field names where the two disagree"] }

Only set is_duplicate=true when confidence >= 0.6.`,
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
      if (!isDup) continue;

      await asRole.entities.ConflictFlag.create({
        dispute_description: `Auto-detected: ${result.reason || 'Likely the same person recorded twice.'}`,
        status: 'open',
        flag_type: 'duplicate_ancestor',
        field_name: 'duplicate_profile',
        ancestor_id: newAncestor.id,
        duplicate_of_ancestor_id: candidate.id,
        duplicate_of_ancestor_name: candidate.full_name,
        duplicate_confidence: result.confidence,
        raised_by_name: 'Duplicate Scan',
        bloodline: newAncestor.bloodline || candidate.bloodline || '',
      }).catch(() => {});

      flagged.push({
        duplicate_of_ancestor_id: candidate.id,
        duplicate_of_ancestor_name: candidate.full_name,
        confidence: result.confidence,
        reason: result.reason,
      });
    }

    return Response.json({
      ancestor_id: entityId,
      candidates: candidates.length,
      flagged: flagged.length,
      flags: flagged,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});