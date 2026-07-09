import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MapPin, Clock, Network, Users, Sparkles, GitBranch } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import SearchBar from '@/components/SearchBar';
import ContentCard from '@/components/ContentCard';
import UploadHelperBanner from '@/components/UploadHelperBanner';
import { useBranchRoot } from '@/hooks/useBranchRoot';
import { useArchivePhotos } from '@/hooks/useArchivePhotos';

const FALLBACK_HERO = 'https://images.unsplash.com/photo-1599256871679-6d46a4ee676a?w=1920&q=80';

export default function Home() {
  const [recentItems, setRecentItems] = useState([]);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const { rootAncestor, rootAncestorId } = useBranchRoot();
  const photos = useArchivePhotos();
  const [heroPhotoIdx, setHeroPhotoIdx] = useState(null);

  useEffect(() => {
    if (photos.length > 0 && heroPhotoIdx === null) {
      setHeroPhotoIdx(Math.floor(Math.random() * photos.length));
    }
  }, [photos.length]);

  const heroPhoto = heroPhotoIdx !== null ? photos[heroPhotoIdx] : null;

  useEffect(() => {
    Promise.all([
      base44.entities.ContentItem.list('-created_date', 6),
      base44.entities.Ancestor.list('-created_date', 8),
    ]).then(([items, ancs]) => {
      setRecentItems(items || []);
      setAncestors(ancs || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <UploadHelperBanner />
      {/* Hero */}
      <section className="relative h-[70vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroPhoto?.file_url || FALLBACK_HERO}
            alt={heroPhoto?.title || 'Family archive'}
            className="w-full h-full object-cover sepia-tint"
          />
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
          <div className="max-w-xl mx-auto">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Quick navigation cards */}
      <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Ancestors', desc: 'Browse family profiles', path: '/ancestors', icon: Users },
            { label: 'Interactive Map', desc: 'Trace migration routes', path: '/map', icon: MapPin },
            { label: 'Timeline', desc: 'Journey through eras', path: '/timeline', icon: Clock },
            { label: 'Family Tree', desc: 'Explore connections', path: '/family-tree', icon: Network },
          ].map(card => {
            const Icon = card.icon;
            return (
              <Link key={card.path} to={card.path}
                className="aged-card rounded-xl p-6 hover:border-[rgba(201,145,58,0.4)] transition-all duration-300 group">
                <Icon size={28} className="text-gold mb-4" />
                <h3 className="font-display text-xl text-parchment mb-1 group-hover:text-gold transition-colors">{card.label}</h3>
                <p className="text-sm text-parchment/50">{card.desc}</p>
                <ChevronRight size={18} className="text-gold/40 mt-3 group-hover:text-gold group-hover:translate-x-1 transition-all" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Bloodline original branch */}
      {rootAncestor && (
        <section className="px-6 lg:px-12 py-8 max-w-7xl mx-auto">
          <Link to={`/ancestor/${rootAncestorId}`} className="block aged-card rounded-2xl p-8 hover:border-[rgba(201,145,58,0.4)] transition-all duration-300 group">
            <div className="flex items-center gap-6">
              {rootAncestor.profile_photo ? (
                <img src={rootAncestor.profile_photo} alt={rootAncestor.full_name} className="w-20 h-20 rounded-full object-cover sepia-tint border-2 border-[#C9913A] flex-shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[rgba(201,145,58,0.1)] border-2 border-[#C9913A] flex items-center justify-center flex-shrink-0">
                  <GitBranch size={28} className="text-gold" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-light/60 tracking-widest uppercase mb-1">Bloodline — Original Branch</p>
                <h2 className="font-display text-3xl text-parchment group-hover:text-gold transition-colors">{rootAncestor.full_name}</h2>
                <p className="text-sm text-parchment/50 mt-1">{rootAncestor.birth_place || rootAncestor.nationality || 'The root of the Freddi family tree'}</p>
              </div>
              <ChevronRight size={24} className="text-gold/40 group-hover:text-gold group-hover:translate-x-1 transition-all flex-shrink-0" />
            </div>
          </Link>
        </section>
      )}

      {/* Recent items */}
      <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-3xl text-parchment">From the Archive</h2>
            <p className="text-parchment/50 text-sm mt-1">Recently added pieces of family history</p>
          </div>
          <Link to="/timeline" className="text-amber-light text-sm hover:text-gold transition-colors flex items-center gap-1">
            View all <ChevronRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="aged-card rounded-xl h-72 animate-pulse" />
            ))}
          </div>
        ) : recentItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentItems.map(item => (
              <ContentCard key={item.id} item={item} ancestors={ancestors} />
            ))}
          </div>
        ) : (
          <div className="aged-card rounded-xl p-12 text-center">
            <p className="text-parchment/50 mb-4">The archive awaits its first piece of history.</p>
            <Link to="/upload" className="inline-flex items-center gap-2 text-gold hover:text-amber-light transition-colors">
              <Sparkles size={18} /> Upload the first event
            </Link>
          </div>
        )}
      </section>
    </Layout>
  );
}