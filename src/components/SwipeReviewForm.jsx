import React, { useState } from 'react';
import { MapPin, Award, FileText, Image as ImageIcon, Newspaper, BookUser, IdCard, Mail, Heart, HelpCircle, Calendar, Tag, X } from 'lucide-react';
import LocationPicker from '@/components/LocationPicker';

const typeOptions = [
  { value: 'photo', label: 'Photograph', icon: ImageIcon },
  { value: 'narrative', label: 'Narrative', icon: FileText },
  { value: 'correspondence', label: 'Correspondence', icon: Mail },
  { value: 'press_clipping', label: 'Press Clipping', icon: Newspaper },
  { value: 'certificate', label: 'Certificate', icon: Award },
  { value: 'passport', label: 'Passport', icon: BookUser },
  { value: 'identity_document', label: 'Identity Doc', icon: IdCard },
  { value: 'memorial', label: 'Memorial', icon: Heart },
  { value: 'uncategorized', label: 'Uncategorized', icon: HelpCircle },
];

export default function SwipeReviewForm({ item, formData, setFormData, ancestors }) {
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const setField = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const toggleAncestor = (id) => {
    setField('ancestor_ids', (formData.ancestor_ids || []).includes(id)
      ? (formData.ancestor_ids || []).filter(a => a !== id)
      : [...(formData.ancestor_ids || []), id]);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !(formData.tags || []).includes(t)) setField('tags', [...(formData.tags || []), t]);
    setTagInput('');
  };

  const removeTag = (t) => setField('tags', (formData.tags || []).filter(x => x !== t));

  const handleLocationPick = ({ location_name, latitude, longitude }) => {
    setFormData(f => ({ ...f, location_name, latitude, longitude }));
  };

  const inputClass = "w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]";

  return (
    <div className="p-4 space-y-3">
      {/* Title */}
      <div>
        <label className="text-xs text-parchment/50 mb-1 block">Title</label>
        <input value={formData.title || ''} onChange={e => setField('title', e.target.value)} className={inputClass} />
      </div>

      {/* Content type */}
      <div>
        <label className="text-xs text-parchment/50 mb-1 block">Content Type</label>
        <div className="flex flex-wrap gap-1.5">
          {typeOptions.map(opt => {
            const Icon = opt.icon;
            const isActive = formData.content_type === opt.value;
            return (
              <button key={opt.value} onClick={() => setField('content_type', opt.value)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${isActive ? 'bg-[#C9913A] text-charcoal border-transparent font-medium' : 'border-[rgba(201,145,58,0.15)] text-parchment/60 hover:border-[rgba(201,145,58,0.3)]'}`}>
                <Icon size={12} /> {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs text-parchment/50 mb-1 block">Description</label>
        <textarea value={formData.description || ''} onChange={e => setField('description', e.target.value)} rows={2} className={inputClass} />
      </div>

      {/* Date + Era */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1"><Calendar size={11} /> Date</label>
          <input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(formData.date) ? formData.date : ''} onChange={e => setField('date', e.target.value)} className={inputClass} style={{ colorScheme: 'dark' }} />
        </div>
        <div>
          <label className="text-xs text-parchment/50 mb-1 block">Era</label>
          <input value={formData.era || ''} onChange={e => setField('era', e.target.value)} className={inputClass} placeholder="circa 1950" />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1"><MapPin size={11} /> Location</label>
        <div className="flex gap-2">
          <input value={formData.location_name || ''} onChange={e => setField('location_name', e.target.value)} className={inputClass} placeholder="Where the event occurred" />
          <button type="button" onClick={() => setLocationPickerOpen(true)}
            className="flex items-center gap-1 px-3 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm hover:bg-[rgba(201,145,58,0.15)] flex-shrink-0">
            <MapPin size={14} /> Map
          </button>
        </div>
      </div>

      {/* Ancestor tags */}
      <div>
        <label className="text-xs text-parchment/50 mb-1.5 block">Tag Ancestors</label>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {(ancestors || []).map(a => {
            const isSelected = (formData.ancestor_ids || []).includes(a.id);
            return (
              <button key={a.id} onClick={() => toggleAncestor(a.id)}
                className={`px-2.5 py-1 rounded-full text-xs transition-all ${isSelected ? 'bg-[#C9913A] text-charcoal font-medium' : 'bg-[#0D0B0A] text-parchment/50 border border-[rgba(201,145,58,0.15)] hover:border-[rgba(201,145,58,0.3)]'}`}>
                {a.full_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1"><Tag size={11} /> Tags</label>
        <div className="flex gap-2">
          <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} className={inputClass} placeholder="Add tag..." />
          <button onClick={addTag} className="px-3 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm flex-shrink-0">Add</button>
        </div>
        {(formData.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(formData.tags || []).map(t => (
              <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)]">
                {t}<button onClick={() => removeTag(t)} className="text-parchment/30 hover:text-parchment"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Extracted fields */}
      {formData.extracted_fields && Object.keys(formData.extracted_fields).length > 0 && (
        <details className="border border-[rgba(201,145,58,0.15)] rounded-lg p-3">
          <summary className="text-xs text-parchment/50 cursor-pointer flex items-center gap-1"><Award size={12} /> Extracted Fields (tap to edit)</summary>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {Object.entries(formData.extracted_fields).map(([key, val]) => val && (
              <div key={key}>
                <label className="text-[10px] text-parchment/40 capitalize">{key.replace(/_/g, ' ')}</label>
                <input value={val} onChange={e => setField('extracted_fields', { ...formData.extracted_fields, [key]: e.target.value })}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded px-2 py-1 text-xs text-parchment focus:outline-none focus:border-[#C9913A]" />
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Transcribed text */}
      {formData.transcribed_text && (
        <details className="border border-[rgba(201,145,58,0.15)] rounded-lg p-3">
          <summary className="text-xs text-parchment/50 cursor-pointer flex items-center gap-1"><FileText size={12} /> Transcribed Text (tap to edit)</summary>
          <textarea value={formData.transcribed_text} onChange={e => setField('transcribed_text', e.target.value)} rows={4}
            className="w-full mt-2 bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded-lg px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A]" />
        </details>
      )}

      <LocationPicker open={locationPickerOpen} onClose={() => setLocationPickerOpen(false)} onPick={handleLocationPick}
        initialLocation={formData.location_name} initialLat={formData.latitude} initialLng={formData.longitude} />
    </div>
  );
}