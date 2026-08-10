import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Public, token-gated endpoint: validates a guest trial token and, if valid,
// returns the full read-only archive snapshot as service role. The guest has
// no account — the token IS the automatic pass. All data is read-only by
// construction (this function only ever reads, never writes beyond access logging).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = (body.token || '').trim();
    if (!token) return Response.json({ valid: false, reason: 'Missing trial token.' });

    const trials = await base44.asServiceRole.entities.GuestTrial
      .filter({ token }).catch(() => []);
    const trial = (trials || [])[0];
    if (!trial) return Response.json({ valid: false, reason: 'This trial link is not valid.' });
    if (trial.status === 'revoked') {
      return Response.json({ valid: false, reason: 'This trial has been revoked by the family admin.' });
    }

    const now = Date.now();
    const expires = new Date(trial.expires_at).getTime();
    if (now > expires) {
      return Response.json({ valid: false, reason: 'This 14-day trial has expired.' });
    }

    const days_left = Math.max(0, Math.ceil((expires - now) / (24 * 60 * 60 * 1000)));

    // Log access (non-blocking).
    base44.asServiceRole.entities.GuestTrial.update(trial.id, {
      last_accessed_at: new Date().toISOString(),
      access_count: (trial.access_count || 0) + 1,
    }).catch(() => {});

    const [ancestors, allItems, branches, newsletters, migrationRoutes] = await Promise.all([
      base44.asServiceRole.entities.Ancestor.list('-created_date', 1000).catch(() => []),
      base44.asServiceRole.entities.ContentItem.list('-created_date', 1000).catch(() => []),
      base44.asServiceRole.entities.Branch.list().catch(() => []),
      base44.asServiceRole.entities.Newsletter.list('-created_date', 200).catch(() => []),
      base44.asServiceRole.entities.MigrationRoute.list().catch(() => []),
    ]);

    // Read-only visibility rules mirror the app: hide staged ancestors and
    // pending (not-yet-reviewed) uploads from the guest.
    const visibleAncestors = (ancestors || []).filter((a) => a.review_status !== 'staged');
    const visibleItems = (allItems || []).filter((i) => i.review_status !== 'pending');

    return Response.json({
      valid: true,
      viewer_email: trial.viewer_email,
      viewer_name: trial.viewer_name,
      expires_at: trial.expires_at,
      days_left,
      archive: {
        ancestors: visibleAncestors,
        contentItems: visibleItems,
        branches: branches || [],
        newsletters: newsletters || [],
        migrationRoutes: migrationRoutes || [],
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}