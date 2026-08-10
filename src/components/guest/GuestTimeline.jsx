import React from 'react';
import { Clock } from 'lucide-react';

export default function GuestTimeline({ items, onSelect }) {
  const dated = (items || [])
    .filter((i) => i.date && !i.parent_content_item_id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (dated.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Clock size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50 text-sm">No dated records in the archive.</p>
      </div>
    );
  }
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-[rgba(201,145,58,0.2)]" />
      {dated.map((item) => (
        <button key={item.id} onClick={() => onSelect(item)} className="relative w-full text-left mb-4 group">
          <div className="absolute -left-[18px] top-3 w-3 h-3 rounded-full bg-[#C9913A] border-2 border-[#0D0B0A]" />
          <div className="aged-card rounded-lg p-4 ml-2 hover:border-[rgba(201,145,58,0.35)] transition-colors">
            <div className="flex items-center gap-3">
              {item.file_url && item.content_type === 'photo' && (
                <img src={item.file_url} className="w-14 h-14 rounded object-cover sepia-tint" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-gold">{new Date(item.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="font-display text-sm text-parchment group-hover:text-amber-light transition-colors">{item.title}</p>
                {item.location_name && <p className="text-xs text-parchment/40 truncate">{item.location_name}</p>}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}