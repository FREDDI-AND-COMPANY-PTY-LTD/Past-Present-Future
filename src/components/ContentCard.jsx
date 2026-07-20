import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Flag, FileText, Image, Newspaper, Video, Award, BookUser, IdCard, Mail, Heart, HelpCircle, Play, Music } from 'lucide-react';
import CropImage from '@/components/CropImage';

const typeIcons = {
  photo: Image,
  story: FileText,
  press_clipping: Newspaper,
  video: Video,
  certificate: Award,
  narrative: FileText,
  passport: BookUser,
  identity_document: IdCard,
  correspondence: Mail,
  memorial: Heart,
  uncategorized: HelpCircle,
};

const typeLabels = {
  photo: 'Photograph',
  story: 'Story',
  press_clipping: 'Press Clipping',
  video: 'Video / Podcast',
  certificate: 'Certificate',
  narrative: 'Narrative',
  passport: 'Passport',
  identity_document: 'Identity Document',
  correspondence: 'Correspondence',
  memorial: 'Memorial',
  uncategorized: 'Uncategorized',
};

const imageTypes = ['photo', 'uncategorized', 'certificate', 'passport', 'identity_document', 'press_clipping', 'narrative', 'correspondence', 'memorial'];

export default function ContentCard({ item, ancestors = [] }) {
  const Icon = typeIcons[item.content_type] || FileText;
  const taggedAncestors = (item.ancestor_ids || [])
    .map(id => ancestors.find(a => a.id === id))
    .filter(Boolean);

  const showImage = item.file_url && imageTypes.includes(item.content_type);
  const isMedia = (item.content_type === 'audio' || item.content_type === 'video') && item.file_url && !item.external_url;

  return (
    <Link to={`/content/${item.id}`} className="block aged-card rounded-xl overflow-hidden hover:border-[rgba(201,145,58,0.4)] transition-all duration-300 group">
      {isMedia && (
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#1A1614] to-[#0D0B0A] flex items-center justify-center">
          <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(201,145,58,0.25) 0%, rgba(13,11,10,0) 70%)' }} />
          <div className="relative w-16 h-16 rounded-full bg-[rgba(201,145,58,0.15)] border border-[rgba(201,145,58,0.4)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300 gold-glow">
            {item.content_type === 'audio' ? <Music size={26} className="text-gold" /> : <Play size={26} className="text-gold ml-1" />}
          </div>
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
      {showImage && (
        <div className="relative h-48 overflow-hidden bg-black/40">
          <CropImage
            src={item.file_url}
            alt={item.title}
            focalX={item.focal_point_x}
            focalY={item.focal_point_y}
            cropBounds={item.crop_bounds}
            className="w-full h-full"
            imgClassName="sepia-tint"
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
        {!showImage && !isMedia ? (
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