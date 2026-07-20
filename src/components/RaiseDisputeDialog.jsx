import React, { useState, useEffect } from 'react';
import { Flag, X, Loader2, Check, Upload, FileText, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ANCESTOR_FIELDS = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'birth_date', label: 'Date of Birth' },
  { key: 'birth_place', label: 'Place of Birth' },
  { key: 'death_date', label: 'Date of Death' },
  { key: 'death_place', label: 'Place of Death' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'biography', label: 'Biography' },
  { key: 'bloodline', label: 'Bloodline' },
  { key: 'mother_id', label: 'Mother' },
  { key: 'father_id', label: 'Father' },
  { key: 'partner_id', label: 'Partner / Spouse' },
  { key: 'general', label: 'General / Other' },
];

const CONTENT_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'date', label: 'Event Date' },
  { key: 'location_name', label: 'Event Location' },
  { key: 'description', label: 'Description' },
  { key: 'era', label: 'Era' },
  { key: 'transcribed_text', label: 'Transcribed Text' },
  { key: 'extracted_fields', label: 'Extracted Certificate Data' },
  { key: 'ancestor_ids', label: 'Tagged Ancestors' },
  { key: 'publication_date', label: 'Publication Date' },
  { key: 'publication_location_name', label: 'Publication Location' },
  { key: 'general', label: 'General / Other' },
];

export default function RaiseDisputeDialog({ entityType, entityId, ancestorId, bloodline, onClose, onSubmitted }) {
  const fields = entityType === 'Ancestor' ? ANCESTOR_FIELDS : CONTENT_FIELDS;
  const [fieldName, setFieldName] = useState('general');
  const [correctValue, setCorrectValue] = useState('');
  const [explanation, setExplanation] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    if (!explanation.trim()) return;
    setSubmitting(true);
    try {
      let supportingUrl = '';
      if (file) {
        setUploading(true);
        const up = await base44.integrations.Core.UploadFile({ file });
        supportingUrl = up.file_url;
        setUploading(false);
      }

      const description = correctValue.trim()
        ? `${explanation.trim()}\n\nCorrect value as I know it: ${correctValue.trim()}`
        : explanation.trim();

      const payload = {
        dispute_description: description,
        status: 'open',
        flag_type: 'dispute',
        field_name: fieldName,
        raised_by_id: currentUser?.id || null,
        raised_by_name: currentUser?.full_name || currentUser?.email || 'Family Member',
        competing_values: correctValue.trim() ? { correct_value: correctValue.trim() } : {},
        bloodline: bloodline || '',
      };
      if (supportingUrl) payload.supporting_file_url = supportingUrl;
      if (entityType === 'Ancestor') {
        payload.ancestor_id = entityId;
      } else {
        payload.content_item_id = entityId;
        if (ancestorId) payload.ancestor_id = ancestorId;
      }

      await base44.entities.ConflictFlag.create(payload);
      setSubmitted(true);
      setExplanation('');
      setCorrectValue('');
      setFile(null);
      onSubmitted?.();
    } catch (e) {}
    setSubmitting(false);
  };

  const isBusy = submitting || uploading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
          <div className="flex items-center gap-2">
            <Flag size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Raise a Dispute</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-gold" />
            </div>
            <p className="text-parchment text-sm mb-1">Dispute submitted for review.</p>
            <p className="text-parchment/40 text-xs">The Elder of this bloodline and the Admin will review your evidence and resolve it.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-xs text-parchment/50">
              {entityType === 'Ancestor'
                ? "Challenge a piece of this ancestor's data. Your identity and any supporting document are attached as evidence."
                : 'Challenge a piece of data on this event. Your identity and any supporting document are attached as evidence.'}
            </p>

            <div>
              <label className="text-sm text-parchment/60 mb-2 block">Which field is disputed?</label>
              <select
                value={fieldName}
                onChange={e => setFieldName(e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              >
                {fields.map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-parchment/60 mb-2 block">The correct value as you know it <span className="text-parchment/30">(optional)</span></label>
              <input
                value={correctValue}
                onChange={e => setCorrectValue(e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                placeholder="e.g. 14 March 1945"
              />
            </div>

            <div>
              <label className="text-sm text-parchment/60 mb-2 block">Explain your reasoning</label>
              <textarea
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                rows={3}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-parchment text-sm focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                placeholder="e.g. The birth certificate I hold shows 1945, not 1944 as recorded here..."
              />
            </div>

            <div>
              <label className="text-sm text-parchment/60 mb-2 flex items-center gap-1.5">
                <Paperclip size={14} /> Supporting document <span className="text-parchment/30">(optional)</span>
              </label>
              {file ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)]">
                  <FileText size={16} className="text-gold" />
                  <span className="text-sm text-parchment truncate flex-1">{file.name}</span>
                  <button onClick={() => setFile(null)} className="text-parchment/40 hover:text-parchment transition-colors">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-[rgba(201,145,58,0.3)] text-amber-light text-sm cursor-pointer hover:bg-[rgba(201,145,58,0.06)] transition-colors">
                  <Upload size={16} />
                  Attach a document (certificate, letter, photo...)
                  <input type="file" onChange={handleFile} className="hidden" accept="image/*,application/pdf" />
                </label>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-[rgba(245,236,215,0.15)] text-parchment/60 text-sm hover:bg-[rgba(245,236,215,0.05)] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!explanation.trim() || isBusy}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
                {uploading ? 'Uploading...' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}