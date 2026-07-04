import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Flag, FileText, Image, Newspaper, Video, Award } from 'lucide-react';

const typeIcons = {
  photo: Image,
  story: FileText,
  press_clipping: Newspaper,
  video: Video,
  certificate: Award,
  narrative: FileText,
};

const typeLabels = {
  photo: 'Photograph',
  story: 'Story',
  press_clipping: 'Press Clipping',
  video: 'Video / Podcast',
  certificate: 'Certificate',
  narrative: 'Narrative',
};

export default function ContentCard({ item, ancestors = [] }) {
  const Icon = typeIcons[item.content_type] || FileText;
  const taggedAncestors = (item.ancestor_ids || [])
    .map(id => ancestors.find(a => a.id === id))
    .filter(Boolean);

  return (
    <Link to={`/content/${item.id}`} className="block aged-card rounded-xl overflow-hidden hover:border-[rgba(201,145,58,0.4)] transition-all duration-300 group">
      {item.file_url && item.content_type === 'photo' && (
        <div className="relative h-48 overflow-hidden bg-black/40">
          <img
            src={item.file_url}
            alt={item.title}
            className="w-full h-full object-cover sepia-tint group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-3 right-3 bg-charcoal/80 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-[rgba(201,145,58,0.2)]">
            <Icon size={12} className="text-gold" />
            <span className="text-xs text-parchment/80">{typeLabels[item.content_type]}</span>
          </div>
          {item.conflict_flag_status === 'open' && (
            <div className="absolute top-3 left-3 bg-[#8B6914]/90 px-2 py-1 rounded-full flex items-center gap-1">
              <Flag size={12} className="text-amber-light" />
              <span className="text-xs text-amber-light">Flagged</span>
            </div>
          )}
        </div>
      )}
      <div className="p-5">
        {!item.file_url || item.content_type !== 'photo' ? (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[rgba(201,145,58,0.1)] flex items-center justify-center border border-[rgba(201,145,58,0.15)]">
              <Icon size={16} className="text-gold" />
            </div>
            <span className="text-xs text-parchment/50 uppercase tracking-wider">{typeLabels[item.content_type]}</span>
            {item.conflict_flag_status === 'open' && (
              <span className="ml-auto flex items-center gap-1 text-xs text-amber-light">
                <Flag size={12} /> Flagged
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-parchment/50 uppercase tracking-wider">{typeLabels[item.content_type]}</span>
            {item.conflict_flag_status === 'open' && (
              <span className="flex items-center gap-1 text-xs text-amber-light">
                <Flag size={12} /> Flagged
              </span>
            )}
          </div>
        )}
        <h3 className="font-display text-lg text-parchment mb-2 group-hover:text-gold transition-colors">{item.title}</h3>
        {item.description && (
          <p className="text-sm text-parchment/60 line-clamp-2 mb-3">{item.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-parchment/50">
          {item.date && (
            <span className="flex items-center gap-1">
              <Calendar size={12} className="text-gold/70" />
              {new Date(item.date).toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          )}
          {item.location_name && (
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-gold/70" />
              {item.location_name}
            </span>
          )}
        </div>
        {taggedAncestors.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[rgba(201,145,58,0.1)] flex flex-wrap gap-1.5">
            {taggedAncestors.map(a => (
              <span key={a.id} className="text-xs text-amber-light/80 bg-[rgba(201,145,58,0.08)] px-2 py-0.5 rounded-full">
                {a.full_name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}