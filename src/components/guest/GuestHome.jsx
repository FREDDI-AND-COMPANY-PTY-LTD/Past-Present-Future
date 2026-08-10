import React from 'react';
import { Image as ImageIcon, FileText, Newspaper, Award, Calendar, MapPin } from 'lucide-react';

const typeIcons = {
  photo: ImageIcon, story: FileText, press_clipping: Newspaper, certificate: Award,
  video: ImageIcon, narrative: FileText, uncategorized: FileText,
};

export default function GuestHome({ items, onSelect }) {
  const standalone = (items || []).filter((i) => !i.parent_content_item_id);
  if (standalone.length === 0) {
    return <p className="text-parchment/50 text-sm">No stories in the archive yet.</p>;
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {standalone.map((item) => {
        const Icon = typeIcons[item.content_type] || FileText;
        return (
          <button key={item.id} onClick={() => onSelect(item)}
            className="aged-card rounded-xl overflow-hidden text-left hover:border-[rgba(201,145,58,0.4)] transition-colors group">
            {item.file_url && item.content_type === 'photo' ? (
              <div className="aspect-[4/3] overflow-hidden bg-[#0D0B0A]">
                <img src={item.file_url} alt={item.title} className="w-full h-full object-cover sepia-tint group-hover:scale-105 transition-transform duration-500"
                  style={{ objectPosition: `${(item.focal_point_x || 0.5) * 100}% ${(item.focal_point_y || 0.4) * 100}%` }} />
              </div>
            ) : item.thumbnail_url ? (
              <div className="aspect-[4/3] overflow-hidden bg-[#0D0B0A]">
                <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover sepia-tint" />
              </div>
            ) : (
              <div className="aspect-[4/3] bg-[rgba(201,145,58,0.06)] flex items-center justify-center">
                <Icon size={32} className="text-gold/40" />
              </div>
            )}
            <div className="p-4">
              <p className="text-xs text-gold/70 uppercase tracking-wider mb-1">{item.content_type}</p>
              <h3 className="font-display text-base text-parchment leading-snug group-hover:text-amber-light transition-colors">{item.title}</h3>
              <div className="flex items-center gap-3 mt-2 text-xs text-parchment/40">
                {item.date && <span className="flex items-center gap-1"><Calendar size={11} />{new Date(item.date).getFullYear()}</span>}
                {item.location_name && <span className="flex items-center gap-1 truncate"><MapPin size={11} />{item.location_name}</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}