import React, { useState, useEffect } from 'react';
import { Edit3, X, Save, Loader2, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function EditEventDialog({ item, onClose, onSubmitted }) {
  const [form, setForm] = useState({
    title: item.title || '',
    description: item.description || '',
    date: item.date || '',
    location_name: item.location_name || '',
    era: item.era || '',
    transcribed_text: item.transcribed_text || '',
  });
  const [extractedFields, setExtractedFields] = useState(item.extracted_fields || {});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleFieldChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleExtractedFieldChange = (key, value) => {
    setExtractedFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const currentUser = await base44.auth.me().catch(() => null);

      // Build proposed_changes — only include fields the user actually modified
      const proposed = {};
      const original = {};

      const fieldMap = [
        { key: 'title', original: item.title },
        { key: 'description', original: item.description },
        { key: 'date', original: item.date },
        { key: 'location_name', original: item.location_name },
        { key: 'era', original: item.era },
        { key: 'transcribed_text', original: item.transcribed_text },
      ];

      for (const f of fieldMap) {
        const newVal = (form[f.key] ?? '').toString();
        const oldVal = (f.original ?? '').toString();
        if (newVal !== oldVal) {
          proposed[f.key] = form[f.key] || null;
          original[f.key] = f.original || null;
        }
      }

      // Check extracted_fields for changes
      const originalExtracted = item.extracted_fields || {};
      const extractedChanged = {};
      let extractedModified = false;
      for (const [k, v] of Object.entries(extractedFields)) {
        const oldV = originalExtracted[k];
        if ((v ?? '').toString() !== (oldV ?? '').toString()) {
          extractedChanged[k] = v || '';
          extractedModified = true;
        }
      }
      if (extractedModified) {
        proposed.extracted_fields = { ...originalExtracted, ...extractedChanged };
        original.extracted_fields = originalExtracted;
      }

      if (Object.keys(proposed).length === 0) {
        setSaving(false);
        return;
      }

      await base44.entities.EditRequest.create({
        content_item_id: item.id,
        content_item_title: item.title,
        proposed_changes: proposed,
        original_values: original,
        reason: reason.trim() || null,
        status: 'pending',
        requested_by_id: currentUser?.id || null,
        requested_by_name: currentUser?.full_name || currentUser?.email || 'Family Member',
      });

      setSubmitted(true);
      if (onSubmitted) onSubmitted();
    } catch (e) {
      // error
    }
    setSaving(false);
  };

  const hasChanges = () => {
    if ((form.title ?? '') !== (item.title ?? '')) return true;
    if ((form.description ?? '') !== (item.description ?? '')) return true;
    if ((form.date ?? '') !== (item.date ?? '')) return true;
    if ((form.location_name ?? '') !== (item.location_name ?? '')) return true;
    if ((form.era ?? '') !== (item.era ?? '')) return true;
    if ((form.transcribed_text ?? '') !== (item.transcribed_text ?? '')) return true;
    const originalExtracted = item.extracted_fields || {};
    for (const [k, v] of Object.entries(extractedFields)) {
      if ((v ?? '').toString() !== (originalExtracted[k] ?? '').toString()) return true;
    }
    return false;
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
      <div className="aged-card rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(201,145,58,0.15)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Edit Event Details</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-4">
              <Save size={28} className="text-gold" />
            </div>
            <h4 className="font-display text-xl text-parchment mb-2">Changes Submitted for Review</h4>
            <p className="text-parchment/50 text-sm mb-6">Your proposed edits have been sent to the admin. They'll be applied once approved.</p>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <p className="text-xs text-amber-light/70 bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.12)] rounded-lg px-3 py-2">
                Your changes won't be applied immediately — they'll be reviewed by an admin before taking effect.
              </p>

              <div>
                <label className="text-xs text-parchment/50 mb-1 block">Title</label>
                <input
                  value={form.title}
                  onChange={e => handleFieldChange('title', e.target.value)}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                />
              </div>

              <div>
                <label className="text-xs text-parchment/50 mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => handleFieldChange('description', e.target.value)}
                  rows={3}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Date</label>
                  <input
                    type="text"
                    value={form.date}
                    onChange={e => handleFieldChange('date', e.target.value)}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="DD/MM/YYYY"
                  />
                </div>
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Era</label>
                  <input
                    value={form.era}
                    onChange={e => handleFieldChange('era', e.target.value)}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="e.g. circa 1950"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-parchment/50 mb-1 block">Location</label>
                <input
                  value={form.location_name}
                  onChange={e => handleFieldChange('location_name', e.target.value)}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="Event location"
                />
              </div>

              {form.transcribed_text !== undefined && item.transcribed_text && (
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Transcribed Text</label>
                  <textarea
                    value={form.transcribed_text}
                    onChange={e => handleFieldChange('transcribed_text', e.target.value)}
                    rows={5}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] leading-relaxed"
                  />
                </div>
              )}

              {extractedFields && Object.keys(extractedFields).length > 0 && (
                <div>
                  <label className="text-xs text-parchment/50 mb-2 block">Extracted Fields</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(extractedFields).map(([key, val]) => (
                      val !== null && val !== undefined && (
                        <div key={key}>
                          <label className="text-xs text-parchment/40 capitalize">{key.replace(/_/g, ' ')}</label>
                          <input
                            value={val}
                            onChange={e => handleExtractedFieldChange(key, e.target.value)}
                            className="w-full mt-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                          />
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1.5">
                  <MessageSquare size={12} /> Reason for changes (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="Explain why these changes are needed..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[rgba(201,145,58,0.15)] flex items-center justify-between">
              <button onClick={onClose} className="text-sm text-parchment/50 hover:text-parchment transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !hasChanges()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}