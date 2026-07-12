import React, { useState, useEffect } from 'react';
import { Edit3, X, Save, Loader2, MapPin, Users, Image as ImageIcon, FileText, Award, BookUser, IdCard, Mail, Newspaper, HelpCircle, Heart, Video, Music, MessageCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LocationPicker from '@/components/LocationPicker';
import CommentThread from '@/components/CommentThread';

const typeOptions = [
  { value: 'photo', label: 'Photo', icon: ImageIcon },
  { value: 'narrative', label: 'Narrative', icon: FileText },
  { value: 'correspondence', label: 'Letter', icon: Mail },
  { value: 'press_clipping', label: 'Press', icon: Newspaper },
  { value: 'certificate', label: 'Certificate', icon: Award },
  { value: 'passport', label: 'Passport', icon: BookUser },
  { value: 'identity_document', label: 'ID Doc', icon: IdCard },
  { value: 'memorial', label: 'Memorial', icon: Heart },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'audio', label: 'Audio', icon: Music },
  { value: 'uncategorized', label: 'Other', icon: HelpCircle },
];

export default function EditEventDialog({ item, onClose, onSubmitted }) {
  const [form, setForm] = useState({
    title: item.title || '',
    content_type: item.content_type || 'photo',
    description: item.description || '',
    date: item.date || '',
    location_name: item.location_name || '',
    latitude: item.latitude ? String(item.latitude) : '',
    longitude: item.longitude ? String(item.longitude) : '',
    era: item.era || '',
    transcribed_text: item.transcribed_text || '',
  });
  const [extractedFields, setExtractedFields] = useState(item.extracted_fields || {});
  const [ancestorIds, setAncestorIds] = useState(item.ancestor_ids || []);
  const [ancestors, setAncestors] = useState([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  useEffect(() => {
    base44.entities.Ancestor.list().then(setAncestors).catch(() => {});
  }, []);

  const handleFieldChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleExtractedFieldChange = (key, value) => {
    setExtractedFields(prev => ({ ...prev, [key]: value }));
  };

  const toggleAncestor = (id) => {
    setAncestorIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const currentUser = await base44.auth.me().catch(() => null);

      const proposed = {};
      const original = {};

      const fieldMap = [
        { key: 'title', original: item.title },
        { key: 'content_type', original: item.content_type },
        { key: 'description', original: item.description },
        { key: 'date', original: item.date },
        { key: 'location_name', original: item.location_name },
        { key: 'latitude', original: item.latitude ? String(item.latitude) : '' },
        { key: 'longitude', original: item.longitude ? String(item.longitude) : '' },
        { key: 'era', original: item.era },
        { key: 'transcribed_text', original: item.transcribed_text },
      ];

      for (const f of fieldMap) {
        const newVal = (form[f.key] ?? '').toString();
        const oldVal = (f.original ?? '').toString();
        if (newVal !== oldVal) {
          if (f.key === 'latitude' || f.key === 'longitude') {
            proposed[f.key] = form[f.key] ? parseFloat(form[f.key]) : null;
            original[f.key] = f.original ? parseFloat(f.original) : null;
          } else {
            proposed[f.key] = form[f.key] || null;
            original[f.key] = f.original || null;
          }
        }
      }

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

      const originalAncestorIds = item.ancestor_ids || [];
      const ancestorChanged = JSON.stringify([...ancestorIds].sort()) !== JSON.stringify([...originalAncestorIds].sort());
      if (ancestorChanged) {
        proposed.ancestor_ids = ancestorIds;
        original.ancestor_ids = originalAncestorIds;
      }

      if (Object.keys(proposed).length > 0) {
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
      }

      setSubmitted(true);
      if (onSubmitted) onSubmitted();
    } catch (e) {
      // error
    }
    setSaving(false);
  };

  const hasChanges = () => {
    if ((form.title ?? '') !== (item.title ?? '')) return true;
    if ((form.content_type ?? '') !== (item.content_type ?? '')) return true;
    if ((form.description ?? '') !== (item.description ?? '')) return true;
    if ((form.date ?? '') !== (item.date ?? '')) return true;
    if ((form.location_name ?? '') !== (item.location_name ?? '')) return true;
    if ((form.latitude ?? '') !== (item.latitude ? String(item.latitude) : '')) return true;
    if ((form.longitude ?? '') !== (item.longitude ? String(item.longitude) : '')) return true;
    if ((form.era ?? '') !== (item.era ?? '')) return true;
    if ((form.transcribed_text ?? '') !== (item.transcribed_text ?? '')) return true;
    const originalExtracted = item.extracted_fields || {};
    for (const [k, v] of Object.entries(extractedFields)) {
      if ((v ?? '').toString() !== (originalExtracted[k] ?? '').toString()) return true;
    }
    if (JSON.stringify([...ancestorIds].sort()) !== JSON.stringify([...(item.ancestor_ids || [])].sort())) return true;
    return false;
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
      <div className="aged-card rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(201,145,58,0.15)] flex items-center justify-between flex-shrink-0">
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
            <p className="text-parchment/50 text-sm mb-6">Your proposed edits have been sent to the admin. They'll be applied once approved. Your comments are already live.</p>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Info banner */}
              <p className="text-xs text-amber-light/70 bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.12)] rounded-lg px-3 py-2">
                Field changes are submitted for admin review. Comments posted below are live immediately.
              </p>

              {/* Content type selector */}
              <div>
                <label className="text-xs text-parchment/50 mb-1.5 block">Content Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {typeOptions.map(opt => {
                    const Icon = opt.icon;
                    const isActive = (form.content_type || 'photo') === opt.value;
                    return (
                      <button key={opt.value} onClick={() => handleFieldChange('content_type', opt.value)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-all ${isActive ? 'bg-[#C9913A] text-charcoal border-transparent font-medium' : 'border-[rgba(201,145,58,0.15)] text-parchment/60 hover:border-[rgba(201,145,58,0.3)]'}`}>
                        <Icon size={11} /> {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

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
                <div className="flex gap-2">
                  <input
                    value={form.location_name}
                    onChange={e => handleFieldChange('location_name', e.target.value)}
                    className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="Event location"
                  />
                  <button
                    type="button"
                    onClick={() => setLocationPickerOpen(true)}
                    className="flex items-center gap-1.5 px-3 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors flex-shrink-0"
                  >
                    <MapPin size={14} /> Map
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <input
                    value={form.latitude}
                    onChange={e => handleFieldChange('latitude', e.target.value)}
                    className="bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="Latitude"
                  />
                  <input
                    value={form.longitude}
                    onChange={e => handleFieldChange('longitude', e.target.value)}
                    className="bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="Longitude"
                  />
                </div>
              </div>

              {/* Ancestor tagging */}
              <div>
                <label className="text-xs text-parchment/50 mb-2 block flex items-center gap-1">
                  <Users size={12} /> Tagged Ancestors
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {ancestors.map(anc => {
                    const selected = ancestorIds.includes(anc.id);
                    return (
                      <button key={anc.id} onClick={() => toggleAncestor(anc.id)}
                        className={`px-2 py-0.5 rounded-full text-xs transition-all ${selected ? 'bg-[#C9913A] text-charcoal font-medium' : 'bg-[#0D0B0A] text-parchment/50 border border-[rgba(201,145,58,0.15)] hover:border-[rgba(201,145,58,0.3)]'}`}>
                        {anc.full_name}
                      </button>
                    );
                  })}
                </div>
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
                <label className="text-xs text-parchment/50 mb-1 block">Reason for changes (optional)</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="Explain why these changes are needed..."
                />
              </div>

              {/* Divider */}
              <div className="border-t border-[rgba(201,145,58,0.15)] pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle size={18} className="text-gold" />
                  <h4 className="font-display text-base text-parchment">Comments & Discussion</h4>
                  <span className="text-xs text-parchment/40">— permanently attached to this record</span>
                </div>
                <CommentThread entityType="ContentItem" entityId={item.id} fieldName="general_discussion" />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[rgba(201,145,58,0.15)] flex items-center justify-between flex-shrink-0">
              <button onClick={onClose} className="text-sm text-parchment/50 hover:text-parchment transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !hasChanges()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Submitting...' : 'Submit Changes for Review'}
              </button>
            </div>
          </>
        )}
        <LocationPicker
          open={locationPickerOpen}
          onClose={() => setLocationPickerOpen(false)}
          onPick={({ location_name, latitude, longitude }) => {
            setForm(prev => ({ ...prev, location_name, latitude, longitude }));
          }}
          initialLocation={form.location_name}
          initialLat={form.latitude}
          initialLng={form.longitude}
        />
      </div>
    </div>
  );
}