import React, { useState } from 'react';
import { MapPin, Users, ChevronDown, ChevronUp, Check, Loader2, Image as ImageIcon, FileText, Award, BookUser, IdCard, Mail, Newspaper, HelpCircle, Calendar, Video, Music } from 'lucide-react';
import LocationPicker from '@/components/LocationPicker';

const typeIcons = {
  photo: ImageIcon, narrative: FileText, correspondence: Mail, press_clipping: Newspaper,
  certificate: Award, passport: BookUser, identity_document: IdCard, uncategorized: HelpCircle,
  video: Video, audio: Music,
};

export default function BulkUploadItem({ item, ancestors, onFieldChange, onToggleAncestor, onLocationPick }) {
  const [expanded, setExpanded] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  const a = item.analysis || {};
  const form = item.form;
  const status = item.status;

  const Icon = typeIcons[a.type] || HelpCircle;

  return (
    <div className="aged-card rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#0D0B0A] flex-shrink-0 flex items-center justify-center">
          {item.file?.type?.startsWith('video/') ? (
            <Video size={20} className="text-gold/50" />
          ) : item.file?.type?.startsWith('audio/') ? (
            <Music size={20} className="text-gold/50" />
          ) : item.fileUrl ? (
            <img src={item.fileUrl} alt="" className="w-full h-full object-cover sepia-tint" />
          ) : (
            <ImageIcon size={20} className="text-parchment/30" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon size={14} className="text-gold flex-shrink-0" />
            <p className="text-sm text-parchment font-medium truncate">{form.title || item.file?.name || 'Untitled'}</p>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-parchment/40">
            {form.date && <span className="flex items-center gap-0.5"><Calendar size={10} /> {form.date}</span>}
            {form.location_name && <span className="truncate flex items-center gap-0.5"><MapPin size={10} /> {form.location_name}</span>}
            {form.ancestor_ids.length > 0 && <span className="flex items-center gap-0.5"><Users size={10} /> {form.ancestor_ids.length}</span>}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {status === 'uploading' && <Loader2 size={16} className="text-gold/50 animate-spin" />}
          {status === 'analysing' && <Loader2 size={16} className="text-gold animate-spin" />}
          {status === 'ready' && <span className="text-xs text-amber-light/70 px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.1)]">Ready</span>}
          {status === 'saving' && <Loader2 size={16} className="text-gold animate-spin" />}
          {status === 'saved' && <Check size={16} className="text-green-400" />}
          {status === 'error' && <span className="text-xs text-red-400">Error</span>}
          {(status === 'ready' || status === 'saved' || status === 'error') && (
            <button onClick={() => setExpanded(!expanded)} className="text-parchment/40 hover:text-parchment transition-colors">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[rgba(201,145,58,0.1)] p-4 space-y-3">
          <div>
            <label className="text-xs text-parchment/40 mb-1 block">Title</label>
            <input value={form.title} onChange={e => onFieldChange(item.id, 'title', e.target.value)}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-parchment/40 mb-1 block">Date</label>
              <input value={form.date} onChange={e => onFieldChange(item.id, 'date', e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="DD/MM/YYYY" />
            </div>
            <div>
              <label className="text-xs text-parchment/40 mb-1 block">Era</label>
              <input value={form.era} onChange={e => onFieldChange(item.id, 'era', e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="circa 1950" />
            </div>
          </div>

          <div>
            <label className="text-xs text-parchment/40 mb-1 block">Event Location</label>
            <div className="flex gap-2">
              <input value={form.location_name} onChange={e => onFieldChange(item.id, 'location_name', e.target.value)}
                className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="Where the event occurred" />
              <button type="button" onClick={() => setLocationPickerOpen(true)}
                className="flex items-center gap-1 px-2.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] flex-shrink-0">
                <MapPin size={12} /> Map
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-parchment/40 mb-1 block flex items-center gap-1"><Users size={10} /> Tag Ancestors</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {ancestors.map(anc => {
                const selected = form.ancestor_ids.includes(anc.id);
                return (
                  <button key={anc.id} onClick={() => onToggleAncestor(item.id, anc.id)}
                    className={`px-2 py-0.5 rounded-full text-xs transition-all ${selected ? 'bg-[#C9913A] text-charcoal font-medium' : 'bg-[#0D0B0A] text-parchment/50 border border-[rgba(201,145,58,0.15)] hover:border-[rgba(201,145,58,0.3)]'}`}>
                    {anc.full_name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-parchment/40 mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => onFieldChange(item.id, 'description', e.target.value)} rows={2}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
          </div>

          {a.suggested_tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {a.suggested_tags.map((t, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded-full text-xs bg-[rgba(201,145,58,0.06)] text-amber-light/60">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onPick={(loc) => onLocationPick(item.id, loc)}
        initialLocation={form.location_name}
        initialLat={form.latitude}
        initialLng={form.longitude}
      />
    </div>
  );
}