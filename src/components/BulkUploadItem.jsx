import React, { useState } from 'react';
import { MapPin, Users, ChevronDown, ChevronUp, Check, Loader2, Image as ImageIcon, FileText, Award, BookUser, IdCard, Mail, Newspaper, HelpCircle, Calendar, Video, Music, Eye, MessageSquare, UserPlus, AlertTriangle } from 'lucide-react';
import LocationPicker from '@/components/LocationPicker';
import NewAncestorDialog from '@/components/NewAncestorDialog';
import DuplicateResolutionDialog from '@/components/DuplicateResolutionDialog';

const typeIcons = {
  photo: ImageIcon, narrative: FileText, correspondence: Mail, press_clipping: Newspaper,
  certificate: Award, passport: BookUser, identity_document: IdCard, uncategorized: HelpCircle,
  video: Video, audio: Music,
};

export default function BulkUploadItem({ item, ancestors, onFieldChange, onToggleAncestor, onLocationPick, onCreateAncestor, user }) {
  const [expanded, setExpanded] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [newAncestorOpen, setNewAncestorOpen] = useState(false);
  const [dupDialogOpen, setDupDialogOpen] = useState(false);

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
          {item.duplicates && (
            <button
              onClick={() => setDupDialogOpen(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-light border border-amber-500/30 hover:bg-amber-500/15 transition-colors"
              title="Possible duplicate detected — click to review"
            >
              <AlertTriangle size={12} /> {item.duplicates.length} duplicate{item.duplicates.length !== 1 ? 's' : ''}
            </button>
          )}
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

          <div>
            <label className="text-xs text-parchment/40 mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => onFieldChange(item.id, 'description', e.target.value)} rows={2}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-parchment/40 mb-1 block">Latitude</label>
              <input value={form.latitude} onChange={e => onFieldChange(item.id, 'latitude', e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="-37.81" />
            </div>
            <div>
              <label className="text-xs text-parchment/40 mb-1 block">Longitude</label>
              <input value={form.longitude} onChange={e => onFieldChange(item.id, 'longitude', e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="144.96" />
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
              <button
                onClick={() => setNewAncestorOpen(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-[rgba(201,145,58,0.3)] text-amber-light/70 hover:border-[#C9913A] hover:text-gold transition-colors"
              >
                <UserPlus size={10} /> Enter New Ancestor
              </button>
            </div>
          </div>

          {a.extracted_fields && Object.keys(a.extracted_fields).filter(k => a.extracted_fields[k]).length > 0 && (
            <div className="p-3 bg-[#0D0B0A] rounded-lg border border-[rgba(201,145,58,0.1)]">
              <div className="flex items-center gap-1.5 mb-2">
                <Award size={12} className="text-gold" />
                <p className="text-xs text-parchment/50 font-medium">Extracted Data — verify and edit</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(a.extracted_fields).filter(([, v]) => v).map(([key, val]) => (
                  <div key={key}>
                    <label className="text-[10px] text-parchment/30 capitalize">{key.replace(/_/g, ' ')}</label>
                    <input
                      value={String(val)}
                      onChange={e => {
                        const updated = { ...a.extracted_fields, [key]: e.target.value };
                        onFieldChange(item.id, '_extracted_fields', updated);
                      }}
                      className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded px-2 py-1 text-xs text-parchment focus:outline-none focus:border-[#C9913A]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {a.transcription && (
            <div className="p-3 bg-[#0D0B0A] rounded-lg border border-[rgba(201,145,58,0.1)]">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText size={12} className="text-gold" />
                <p className="text-xs text-parchment/50 font-medium">Transcribed Text — edit if needed</p>
              </div>
              <textarea
                value={a.transcription}
                onChange={e => onFieldChange(item.id, '_transcription', e.target.value)}
                rows={4}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded px-2 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A] leading-relaxed"
              />
            </div>
          )}

          {a.ai_confidence !== undefined && (
            <div className="flex items-center gap-2">
              <Eye size={12} className="text-gold" />
              <span className="text-[10px] text-parchment/40">AI Confidence</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${a.ai_confidence >= 0.7 ? 'bg-green-500/10 text-green-300' : a.ai_confidence >= 0.4 ? 'bg-[rgba(201,145,58,0.1)] text-amber-light' : 'bg-red-500/10 text-red-300'}`}>
                {Math.round(a.ai_confidence * 100)}%
              </span>
              {a.categorization_notes && (
                <p className="text-[10px] text-parchment/30 truncate flex-1">{a.categorization_notes}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-parchment/40 mb-1 block flex items-center gap-1"><MessageSquare size={10} /> Comment / Query</label>
            <textarea
              value={item.form.comment || ''}
              onChange={e => onFieldChange(item.id, 'comment', e.target.value)}
              rows={2}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded px-2 py-1.5 text-xs text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
              placeholder="Add a comment or raise a query about this event..."
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={() => onFieldChange(item.id, 'is_query', !item.form.is_query)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-colors ${item.form.is_query ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70'}`}
              >
                <HelpCircle size={10} /> {item.form.is_query ? 'Query' : 'Comment'}
              </button>
            </div>
          </div>
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

      <NewAncestorDialog
        open={newAncestorOpen}
        onClose={() => setNewAncestorOpen(false)}
        onCreated={(newAncestor) => {
          onCreateAncestor?.(newAncestor);
          onToggleAncestor(item.id, newAncestor.id);
        }}
        user={user}
      />

      {item.duplicates && dupDialogOpen && (
        <DuplicateResolutionDialog
          duplicates={item.duplicates}
          newItemId={item.savedItemId}
          newItemTitle={form.title}
          user={user}
          onClose={() => setDupDialogOpen(false)}
          onRemoved={() => {
            setDupDialogOpen(false);
            setExpanded(false);
          }}
          onMerged={() => {
            setDupDialogOpen(false);
            setExpanded(false);
          }}
        />
      )}
    </div>
  );
}