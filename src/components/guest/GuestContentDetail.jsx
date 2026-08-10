import React from 'react';
import { X, Calendar, MapPin, Tag, Users, FileText, Globe, ExternalLink } from 'lucide-react';

const TYPE_LABELS = {
  photo: 'Photo', story: 'Story', press_clipping: 'Press Clipping', video: 'Video',
  audio: 'Audio', certificate: 'Certificate', narrative: 'Narrative', passport: 'Passport',
  identity_document: 'Identity Document', correspondence: 'Correspondence',
  memorial: 'Memorial', uncategorized: 'Uncategorized',
};

export default function GuestContentDetail({ item, ancestors, relatedItems, onClose }) {
  if (!item) return null;
  const ancestorName = (id) => ancestors?.find((a) => a.id === id)?.full_name;
  const related = relatedItems || [];

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1A1614] border border-[rgba(201,145,58,0.25)] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#1A1614]/95 backdrop-blur border-b border-[rgba(201,145,58,0.15)] px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs text-gold uppercase tracking-wider">{TYPE_LABELS[item.content_type] || 'Document'}</span>
            <h2 className="font-display text-2xl text-parchment leading-tight">{item.title}</h2>
          </div>
          <button onClick={onClose} className="text-parchment/60 hover:text-parchment flex-shrink-0"><X size={22} /></button>
        </div>

        <div className="p-6 space-y-5">
          {item.file_url && item.content_type === 'photo' && (
            <img src={item.file_url} alt={item.title} className="w-full rounded-lg sepia-tint" />
          )}
          {item.file_url && item.content_type === 'video' && (
            <video src={item.file_url} controls className="w-full rounded-lg" />
          )}
          {item.thumbnail_url && item.content_type !== 'photo' && (
            <img src={item.thumbnail_url} alt={item.title} className="w-full rounded-lg sepia-tint" />
          )}
          {item.external_url && (
            <a href={item.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-amber-light underline text-sm">
              <ExternalLink size={14} /> Open external media
            </a>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-parchment/70">
            {item.date && (
              <span className="flex items-center gap-1.5"><Calendar size={14} className="text-gold" />
                {new Date(item.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
            {item.location_name && (
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-gold" />{item.location_name}</span>
            )}
            {item.era && <span className="flex items-center gap-1.5"><Tag size={14} className="text-gold" />{item.era}</span>}
          </div>

          {item.ancestor_ids?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <Users size={14} className="text-gold" />
              {item.ancestor_ids.map(ancestorName).filter(Boolean).map((n, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.15)] text-amber-light text-xs">{n}</span>
              ))}
            </div>
          )}

          {item.description && <p className="text-parchment/80 text-sm leading-relaxed">{item.description}</p>}

          {item.historical_background && (
            <div className="aged-card rounded-lg p-4">
              <p className="text-xs text-gold uppercase tracking-wider mb-2 flex items-center gap-1.5"><Globe size={12} /> Historical Background</p>
              <p className="text-parchment/70 text-sm leading-relaxed whitespace-pre-wrap">{item.historical_background}</p>
            </div>
          )}

          {item.transcribed_text && (
            <div>
              <p className="text-xs text-gold uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={12} /> Transcription</p>
              <p className="text-parchment/70 text-sm leading-relaxed whitespace-pre-wrap font-mono">{item.transcribed_text}</p>
            </div>
          )}

          {item.english_translation && (
            <div className="border-l-2 border-[#C9913A] pl-4">
              <p className="text-xs text-amber-light uppercase tracking-wider mb-1">English Translation</p>
              <p className="text-parchment/70 text-sm leading-relaxed whitespace-pre-wrap">{item.english_translation}</p>
            </div>
          )}

          {item.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-[rgba(245,236,215,0.05)] text-parchment/50 text-xs">#{t}</span>
              ))}
            </div>
          )}

          {related.length > 0 && (
            <div>
              <p className="text-xs text-gold uppercase tracking-wider mb-2">Related Events</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {related.map((r) => (
                  <div key={r.id} className="aged-card rounded-lg p-3">
                    {r.file_url && r.content_type === 'photo' && <img src={r.file_url} className="w-full h-24 object-cover rounded sepia-tint mb-2" />}
                    <p className="text-sm text-parchment font-medium leading-snug">{r.title}</p>
                    {r.date && <p className="text-xs text-parchment/40 mt-1">{new Date(r.date).toLocaleDateString('en-AU')}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}