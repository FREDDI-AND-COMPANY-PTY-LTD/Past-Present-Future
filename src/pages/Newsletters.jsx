import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, Calendar, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';

export default function Newsletters() {
  const [newsletters, setNewsletters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Newsletter.list('-created_date', 50)
      .then(setNewsletters)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper size={20} className="text-gold" />
          <span className="text-amber-light/60 text-xs tracking-[0.2em] uppercase">The Freddi Family Chronicle</span>
        </div>
        <h1 className="font-display text-4xl text-parchment mb-2">Family Chronicle</h1>
        <p className="text-parchment/50 text-sm mb-8">Monthly stories from the archive — read, reminisce, and share your memories in the comments.</p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="aged-card rounded-xl h-32 animate-pulse" />)}
          </div>
        ) : newsletters.length === 0 ? (
          <div className="aged-card rounded-xl p-12 text-center">
            <Newspaper size={32} className="text-gold/30 mx-auto mb-4" />
            <p className="text-parchment/50">The first Chronicle will appear here after the next monthly edition.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {newsletters.map(nl => (
              <Link
                key={nl.id}
                to={`/newsletter/${nl.id}`}
                className="block aged-card rounded-xl p-6 hover:border-[rgba(201,145,58,0.4)] transition-all duration-300 group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} className="text-gold/60" />
                  <span className="text-xs text-parchment/50">{nl.month_label}</span>
                  {nl.item_count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/70 text-xs">
                      {nl.item_count} {nl.item_count === 1 ? 'discovery' : 'discoveries'}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-2xl text-parchment mb-2 group-hover:text-gold transition-colors">{nl.headline}</h2>
                <p className="text-sm text-parchment/60 line-clamp-2">{nl.intro}</p>
                <span className="inline-block mt-3 text-amber-light text-sm group-hover:text-gold transition-colors">Read the full chronicle →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}