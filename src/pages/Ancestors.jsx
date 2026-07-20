import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AncestorAvatar from '@/components/AncestorAvatar';
import SearchBar from '@/components/SearchBar';
import { formatAncestorName } from '@/lib/ancestorName';

export default function Ancestors() {
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    base44.entities.Ancestor.list('full_name')
      .then(setAncestors)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = ancestors.filter(a => {
    if (filter === 'living') return a.living;
    if (filter === 'deceased') return !a.living;
    return true;
  });

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl text-parchment mb-3">Ancestors</h1>
          <p className="text-parchment/50 max-w-2xl">Every person in the Freddi family tree — their stories, their origins, and their place in the journey.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <SearchBar />
          </div>
          <div className="flex gap-2">
            {['all', 'living', 'deceased'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 rounded-lg text-sm capitalize transition-all border ${
                  filter === f
                    ? 'bg-[rgba(201,145,58,0.12)] text-gold border-[rgba(201,145,58,0.3)]'
                    : 'text-parchment/50 border-[rgba(201,145,58,0.1)] hover:text-parchment'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="aged-card rounded-xl h-64 animate-pulse" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filtered.map(ancestor => (
              <div key={ancestor.id} className="aged-card rounded-xl p-6 text-center hover:border-[rgba(201,145,58,0.4)] transition-all duration-300 group">
                <div className="flex justify-center mb-4">
                  <AncestorAvatar ancestor={ancestor} size="lg" />
                </div>
                <h3 className="font-display text-lg text-parchment group-hover:text-gold transition-colors mb-1">{formatAncestorName(ancestor)}</h3>
                <p className="text-xs text-parchment/50">
                  {ancestor.birth_date ? new Date(ancestor.birth_date).getFullYear() : ''}
                  {ancestor.death_date ? ` – ${new Date(ancestor.death_date).getFullYear()}` : ancestor.living ? ' – present' : ''}
                </p>
                {ancestor.nationality && (
                  <p className="text-xs text-amber-light/60 mt-1">{ancestor.nationality}</p>
                )}
                {ancestor.bloodline && (
                  <p className="text-xs text-parchment/40 mt-1">{ancestor.bloodline}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="aged-card rounded-xl p-12 text-center">
            <p className="text-parchment/50">No ancestors in the archive yet.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}