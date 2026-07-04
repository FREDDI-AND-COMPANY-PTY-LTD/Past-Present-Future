import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MessageCircle, ChevronLeft, Newspaper, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import CommentThread from '@/components/CommentThread';

export default function NewsletterDetail() {
  const { id } = useParams();
  const [newsletter, setNewsletter] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Newsletter.get(id),
      base44.entities.ContentItem.list(),
    ]).then(([nl, allItems]) => {
      setNewsletter(nl);
      const featured = (nl?.featured_item_ids || [])
        .map(fid => (allItems || []).find(i => i.id === fid))
        .filter(Boolean);
      setItems(featured);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <Layout><div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto"><div className="aged-card rounded-xl h-96 animate-pulse" /></div></Layout>;
  }

  if (!newsletter) {
    return <Layout><div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto text-center"><p className="text-parchment/50">Newsletter not found.</p><Link to="/newsletters" className="text-gold mt-4 inline-block">← All newsletters</Link></div></Layout>;
  }

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto">
        <Link to="/newsletters" className="inline-flex items-center gap-1 text-parchment/50 hover:text-gold transition-colors mb-6 text-sm">
          <ChevronLeft size={16} /> All Newsletters
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper size={18} className="text-gold" />
            <span className="text-amber-light/60 text-xs tracking-[0.2em] uppercase">The Freddi Family Chronicle</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-parchment leading-tight mb-3">{newsletter.headline}</h1>
          <div className="flex items-center gap-3 text-sm text-parchment/50">
            <span className="flex items-center gap-1.5"><Calendar size={14} className="text-gold/60" /> {newsletter.month_label}</span>
            {newsletter.item_count > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/70 text-xs">
                {newsletter.item_count} {newsletter.item_count === 1 ? 'discovery' : 'discoveries'}
              </span>
            )}
          </div>
        </div>

        {/* Intro */}
        <div className="aged-card rounded-2xl p-8 mb-6">
          <p className="font-display text-lg text-parchment/90 leading-relaxed italic">{newsletter.intro}</p>
        </div>

        {/* Photo gallery */}
        {newsletter.photo_urls && newsletter.photo_urls.length > 0 && (
          <div className="mb-8">
            <p className="text-amber-light/60 text-xs tracking-[0.15em] uppercase mb-3">Glimpses from the Archive</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {newsletter.photo_urls.map((url, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border border-[rgba(201,145,58,0.15)]">
                  <img src={url} alt={`Archive photo ${i + 1}`} className="w-full h-full object-cover sepia-tint hover:scale-105 transition-transform duration-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sections */}
        {newsletter.sections && newsletter.sections.length > 0 && (
          <div className="space-y-8 mb-8">
            {newsletter.sections.map((section, i) => (
              <div key={i}>
                <h2 className="font-display text-2xl text-amber-light mb-3">{section.subheading}</h2>
                <p className="text-parchment/70 leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Closing */}
        <div className="aged-card rounded-xl p-6 mb-12">
          <p className="text-parchment/70 leading-relaxed">{newsletter.closing}</p>
        </div>

        {/* Featured uploads with comments */}
        {items.length > 0 && (
          <div>
            <h2 className="font-display text-2xl text-parchment mb-2">This Month's Uploads</h2>
            <p className="text-parchment/50 text-sm mb-6">Click into any item to explore it fully. Share your memories and reactions in the comments below each one.</p>
            <div className="space-y-6">
              {items.map(item => (
                <FeaturedItemWithComments key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function FeaturedItemWithComments({ item }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabels = {
    photo: 'Photograph', story: 'Story', press_clipping: 'Press Clipping', video: 'Video',
    certificate: 'Certificate', narrative: 'Narrative', passport: 'Passport',
    identity_document: 'Identity Document', correspondence: 'Correspondence', memorial: 'Memorial',
  };

  return (
    <div className="aged-card rounded-xl p-5">
      <div className="flex items-start gap-4">
        {item.file_url && item.content_type === 'photo' && (
          <Link to={`/content/${item.id}`} className="flex-shrink-0">
            <img src={item.file_url} alt={item.title} className="w-24 h-24 rounded-lg object-cover sepia-tint hover:opacity-80 transition-opacity" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <Link to={`/content/${item.id}`} className="block">
            <h3 className="font-display text-lg text-parchment hover:text-gold transition-colors">{item.title}</h3>
          </Link>
          <span className="text-xs text-parchment/40 uppercase tracking-wider">{typeLabels[item.content_type] || 'Document'}</span>
          {item.description && <p className="text-sm text-parchment/60 line-clamp-2 mt-1">{item.description}</p>}
        </div>
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 flex items-center gap-1.5 text-sm text-amber-light/70 hover:text-amber-light transition-colors"
      >
        <MessageCircle size={14} />
        {expanded ? 'Hide comments' : 'View / add comments'}
      </button>
      {expanded && (
        <div className="mt-2 pt-3 border-t border-[rgba(201,145,58,0.1)]">
          <CommentThread entityType="ContentItem" entityId={item.id} fieldName="newsletter_discussion" />
        </div>
      )}
    </div>
  );
}