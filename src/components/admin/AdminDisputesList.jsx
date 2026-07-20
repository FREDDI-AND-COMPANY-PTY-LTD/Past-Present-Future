import React, { useState, useEffect } from 'react';
import { Flag, CheckCircle, XCircle, Pencil, ExternalLink, Loader2, MessageSquare, Mail, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const statusBadges = {
  open: { label: 'Open', class: 'bg-[#8B6914]/30 text-amber-light border-[rgba(201,145,58,0.3)]' },
  resolved: { label: 'Resolved', class: 'bg-green-900/20 text-green-400 border-green-800/30' },
  dismissed: { label: 'Dismissed', class: 'bg-[rgba(245,236,215,0.05)] text-parchment/40 border-[rgba(245,236,215,0.1)]' },
};

const FIELD_LABELS = {
  full_name: 'Full Name', birth_date: 'Date of Birth', birth_place: 'Place of Birth',
  death_date: 'Date of Death', death_place: 'Place of Death', nationality: 'Nationality',
  biography: 'Biography', bloodline: 'Bloodline', mother_id: 'Mother', father_id: 'Father',
  partner_id: 'Partner / Spouse',
  title: 'Title', date: 'Event Date', location_name: 'Event Location', description: 'Description',
  era: 'Era', transcribed_text: 'Transcribed Text', extracted_fields: 'Extracted Certificate Data',
  ancestor_ids: 'Tagged Ancestors', publication_date: 'Publication Date',
  publication_location_name: 'Publication Location', general: 'General / Other',
};

export default function AdminDisputesList({ flags, onResolved }) {
  const [admin, setAdmin] = useState(null);
  const [engaged, setEngaged] = useState({});
  const [engagingId, setEngagingId] = useState(null);
  const [notes, setNotes] = useState({});
  const [redirect, setRedirect] = useState({});
  const [resolvingId, setResolvingId] = useState(null);

  useEffect(() => { base44.auth.me().then(setAdmin).catch(() => {}); }, []);

  const editTarget = (flag) => {
    if (flag.content_item_id) return { path: `/content/${flag.content_item_id}?edit=1`, label: 'Edit event record' };
    if (flag.ancestor_id) return { path: `/ancestor/${flag.ancestor_id}?edit=1`, label: 'Edit ancestor profile' };
    return null;
  };

  const isEngaged = (flag) => !!engaged[flag.id] || !!flag.admin_engaged || !editTarget(flag);

  const handleEngage = async (flag) => {
    const target = editTarget(flag);
    setEngaged(prev => ({ ...prev, [flag.id]: true }));
    setEngagingId(flag.id);
    try { await base44.entities.ConflictFlag.update(flag.id, { admin_engaged: true }); } catch (e) {}
    setEngagingId(null);
    if (target) window.open(target.path, '_blank', 'noopener');
  };

  const handleResolve = async (flag, status) => {
    const note = (notes[flag.id] || '').trim();
    if (!note) return;
    setResolvingId(flag.id);
    try {
      await base44.entities.ConflictFlag.update(flag.id, {
        status,
        resolution_note: note,
        resolved_by_id: admin?.id || null,
      });

      const entityType = flag.content_item_id ? 'ContentItem' : (flag.ancestor_id ? 'Ancestor' : null);
      const entityId = flag.content_item_id || flag.ancestor_id;
      const doRedirect = !!redirect[flag.id] && entityType && entityId;

      // (b) Optional: preserve the disputed recollection as a comment on the form
      if (doRedirect) {
        const recollection = flag.competing_values?.correct_value
          ? `Alternate recollection (raised by ${flag.raised_by_name || 'a family member'}): "${flag.competing_values.correct_value}". ${flag.dispute_description || ''}`.trim()
          : `Alternate recollection (raised by ${flag.raised_by_name || 'a family member'}): ${flag.dispute_description || ''}`;
        try {
          await base44.entities.Comment.create({
            entity_type: entityType, entity_id: entityId,
            field_name: flag.field_name || 'general',
            author_id: admin?.id || null, author_name: admin?.full_name || 'Admin',
            content: recollection,
            tagged_user_ids: flag.raised_by_id ? [flag.raised_by_id] : [],
            is_query: false,
          });
        } catch (e) {}
      }

      // (a) Auto message to the raiser's inbox
      await notifyRaiser(flag, status, note, doRedirect);

      onResolved?.();
    } catch (e) {}
    setResolvingId(null);
  };

  const notifyRaiser = async (flag, status, note, redirected) => {
    const raiserId = flag.raised_by_id;
    if (!raiserId) return;
    const fieldLabel = FIELD_LABELS[flag.field_name] || flag.field_name || 'a data point';
    const entityLabel = flag.content_item_id ? 'an event record' : (flag.ancestor_id ? 'an ancestor profile' : 'a record');
    const decision = status === 'resolved' ? 'upheld and resolved' : 'dismissed';
    const subject = `Update on your dispute — ${fieldLabel}`;
    const body = `Hi ${flag.raised_by_name || 'Family Member'},\n\nYour dispute regarding "${fieldLabel}" on ${entityLabel} has been reviewed by ${admin?.full_name || 'the archive admin'}.\n\nDetermination: ${decision}.\nReason: ${note}${redirected ? '\n\nYour recollection has also been preserved as a comment on the record, so the differing memory remains part of the family archive.' : ''}\n\n— The ${flag.bloodline || 'Freddi'} Family Archive`;

    // Email (private inbox) — best effort
    try {
      const users = await base44.entities.User.list();
      const raiser = (users || []).find(u => u.id === raiserId);
      if (raiser?.email) {
        await base44.integrations.Core.SendEmail({ to: raiser.email, subject, body });
      }
    } catch (e) {}

    // In-app inbox (Tasks / notifications) — tagged comment on the record
    try {
      const entityType = flag.content_item_id ? 'ContentItem' : (flag.ancestor_id ? 'Ancestor' : null);
      const entityId = flag.content_item_id || flag.ancestor_id;
      if (entityType && entityId) {
        await base44.entities.Comment.create({
          entity_type: entityType, entity_id: entityId,
          field_name: flag.field_name || 'general',
          author_id: admin?.id || null, author_name: admin?.full_name || 'Admin',
          content: `Dispute determination for ${flag.raised_by_name || 'you'}: ${decision.toUpperCase()} — ${note}`,
          tagged_user_ids: [raiserId],
          is_query: false,
        });
      }
    } catch (e) {}
  };

  if (!flags || flags.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Flag size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50">No open disputes or flags.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flags.map(flag => {
        const target = editTarget(flag);
        const engagedNow = isEngaged(flag);
        const note = notes[flag.id] || '';
        const busy = resolvingId === flag.id;
        return (
          <div key={flag.id} className="aged-card rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Flag size={18} className="text-amber-light" />
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadges[flag.status]?.class || statusBadges.open.class}`}>
                  {statusBadges[flag.status]?.label || 'Open'}
                </span>
                {flag.flag_type && (
                  <span className="text-xs text-parchment/40 capitalize">{flag.flag_type.replace(/_/g, ' ')}</span>
                )}
                {flag.bloodline && <span className="text-xs text-parchment/40">· {flag.bloodline}</span>}
                {flag.raised_by_name && <span className="text-xs text-parchment/40">· raised by {flag.raised_by_name}</span>}
              </div>
              <span className="text-xs text-parchment/40 whitespace-nowrap">{flag.created_date ? new Date(flag.created_date).toLocaleString('en-AU') : ''}</span>
            </div>

            <div className="text-xs text-parchment/40 mb-2">
              Disputed field: <span className="text-amber-light">{FIELD_LABELS[flag.field_name] || flag.field_name || 'General'}</span>
            </div>
            <p className="text-sm text-parchment/70 mb-3 whitespace-pre-wrap">{flag.dispute_description}</p>

            {flag.supporting_file_url && (
              <a href={flag.supporting_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-amber-light hover:text-gold mb-3">
                <Paperclip size={12} /> View supporting document
              </a>
            )}

            <div className="flex flex-wrap gap-3 items-center">
              {target ? (
                <button onClick={() => handleEngage(flag)} disabled={engagingId === flag.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.12)] border border-[rgba(201,145,58,0.3)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.2)] transition-colors disabled:opacity-50">
                  {engagingId === flag.id ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                  {target.label} <ExternalLink size={12} />
                </button>
              ) : (
                <span className="text-xs text-parchment/40">No specific record linked to this dispute.</span>
              )}
              {target && (
                <a href={target.path} target="_blank" rel="noreferrer" className="text-xs text-parchment/40 hover:text-amber-light">Open record →</a>
              )}
            </div>

            {!engagedNow && target && (
              <p className="text-xs text-parchment/40 mt-3 italic">Review and edit the disputed record first — resolution options appear once you've opened the record.</p>
            )}

            {engagedNow && (
              <div className="mt-4 pt-4 border-t border-[rgba(201,145,58,0.15)] space-y-3">
                <div>
                  <label className="text-xs text-parchment/60 mb-1.5 block">Determination — how & why you decided <span className="text-red-400/70">*</span></label>
                  <textarea value={note} onChange={e => setNotes(prev => ({ ...prev, [flag.id]: e.target.value }))} rows={2}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                    placeholder="e.g. Checked the birth certificate on file; date confirms 1944, so the record stands. Dispute noted." />
                </div>
                <label className="flex items-start gap-2 text-xs text-parchment/60 cursor-pointer">
                  <input type="checkbox" checked={!!redirect[flag.id]} onChange={e => setRedirect(prev => ({ ...prev, [flag.id]: e.target.checked }))}
                    className="mt-0.5 accent-[#C9913A]" />
                  <span><MessageSquare size={11} className="inline mr-1 text-gold/60" />Redirect the disputed recollection to the comments section of this record (preserves the differing memory as a permanent family note).</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleResolve(flag, 'resolved')} disabled={!note.trim() || busy}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors disabled:opacity-50">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Resolve dispute
                  </button>
                  <button onClick={() => handleResolve(flag, 'dismissed')} disabled={!note.trim() || busy}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(245,236,215,0.05)] text-parchment/60 text-xs border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.08)] transition-colors disabled:opacity-50">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Dismiss (no change)
                  </button>
                </div>
                <p className="text-[11px] text-parchment/40 flex items-center gap-1"><Mail size={11} className="text-gold/50" /> The raiser will receive an inbox message with your determination.</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}