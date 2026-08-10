import React, { useState, useEffect } from 'react';
import { ChevronRight, MapPin, Clock, Users, Sparkles } from 'lucide-react';
import GuestContentCard from '@/components/guest/GuestContentCard';
import CropImage from '@/components/CropImage';

// Mirrors the real Home page: full hero, quick-nav cards, recent items grid.
// Quick-nav cards switch the guest view instead of routing.
export default function GuestHome({ items, ancestors, onSelect, onNavigate }) {
  const [heroIdx, setHeroIdx] = useState(null);
  const photos = (items || []).filter(
    (i) => i.file_url && i.content_type === 'photo' && !i.parent_content_item_id
  );

  useEffect(() => {
    if (photos.length > 0 && heroIdx === null) {
      setHeroIdx(Math.floor(Math.random() * photos.length));
    }
  }, [photos.length]);

  const heroPhoto = heroIdx !== null ? photos[heroIdx] : null;
  const standalone = (items || []).filter((i) => !i.parent_content_item_id);
  const recent = standalone.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="relative h-[70vh] min-h-[500px] flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          {heroPhoto ? (
            <CropImage
              src={heroPhoto.file_url}
              alt={heroPhoto.title || 'Family archive'}
              focalX={heroPhoto.focal_point_x}
              focalY={heroPhoto.focal_point_y}
              cropBounds={heroPhoto.crop_bounds}
              className="w-full h-full"
              imgClassName="sepia-tint"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background:
                  'radial-gradient(ellipse at 30% 20%, rgba(201,145,58,0.18), transparent 55%),' +
                  'radial-gradient(ellipse at 75% 80%, rgba(232,201,122,0.10), transparent 60%),' +
                  'linear-gradient(135deg, #1A1614 0%, #0D0B0A 70%)',
              }}
            />
          )}
          <div className="absolute inset-0 hero-overlay" />
        </div>
        <div className="relative z-10 text-center px-6 max-w-3xl animate-fade-in-up">
          <p className="text-amber-light/60 text-sm tracking-[0.3em] uppercase mb-4">The Freddi Family Archive</p>
          <h1 className="font-display text-5xl md:text-7xl text-parchment leading-tight mb-6">
            Where bloodlines<br />become stories
          </h1>
          <p className="text-parchment/60 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            A private archive of the Freddi family — photographs, stories, and the journey of generations across the world to Victoria, Australia.
          </p>
        </div>
      </section>

      {/* Quick navigation cards */}
      <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Ancestors', desc: 'Browse family profiles', view: 'ancestors', icon: Users },
            { label: 'Interactive Map', desc: 'Trace migration routes', view: 'map', icon: MapPin },
            { label: 'Timeline', desc: 'Journey through eras', view: 'timeline', icon: Clock },
          ].map(card => {
            const Icon = card.icon;
            return (
              <button key={card.view} onClick={() => onNavigate(card.view)}
                className="text-left aged-card rounded-xl p-6 hover:border-[rgba(201,145,58,0.4)] transition-all duration-300 group">
                <Icon size={28} className="text-gold mb-4" />
                <h3 className="font-display text-xl text-parchment mb-1 group-hover:text-gold transition-colors">{card.label}</h3>
                <p className="text-sm text-parchment/50">{card.desc}</p>
                <ChevronRight size={18} className="text-gold/40 mt-3 group-hover:text-gold group-hover:translate-x-1 transition-all" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent items */}
      <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-3xl text-parchment">From the Archive</h2>
            <p className="text-parchment/50 text-sm mt-1">Recently added pieces of family history</p>
          </div>
          <button onClick={() => onNavigate('timeline')} className="text-amber-light text-sm hover:text-gold transition-colors flex items-center gap-1">
            View all <ChevronRight size={16} />
          </button>
        </div>

        {recent.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recent.map(item => (
              <GuestContentCard key={item.id} item={item} ancestors={ancestors} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <div className="aged-card rounded-xl p-12 text-center">
            <Sparkles size={28} className="text-gold/40 mx-auto mb-3" />
            <p className="text-parchment/50">The archive awaits its first piece of history.</p>
          </div>
        )}
      </section>
    </>
  );
}