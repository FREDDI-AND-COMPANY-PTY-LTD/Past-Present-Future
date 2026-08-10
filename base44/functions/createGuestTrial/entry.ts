import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Creates a 14-day read-only guest trial tied to a viewer's email.
// The returned token forms the share URL (/trial/:token) — the guest's
// automatic pass; no account or password is required to open it.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const viewer_email = (body.viewer_email || '').trim().toLowerCase();
    const viewer_name = (body.viewer_name || '').trim();
    const note = (body.note || '').trim();
    if (!viewer_email || !viewer_email.includes('@')) {
      return Response.json({ error: 'A valid viewer email is required' }, { status: 400 });
    }

    // Cryptographically random token (24 bytes → 48 hex chars)
    const buf = new Uint8Array(24);
    crypto.getRandomValues(buf);
    const token = Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');

    const now = new Date();
    const expires_at = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const trial = await base44.entities.GuestTrial.create({
      token,
      viewer_email,
      viewer_name,
      note,
      created_by_id: user.id,
      created_by_name: user.full_name || user.email,
      expires_at,
      status: 'active',
      access_count: 0,
    });

    return Response.json({
      token,
      trial_id: trial.id,
      viewer_email,
      viewer_name,
      expires_at,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}