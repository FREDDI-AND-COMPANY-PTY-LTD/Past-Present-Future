import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function SearchBar({ placeholder = 'Search by ancestor name...' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const ancestors = await base44.entities.Ancestor.filter({});
        const filtered = ancestors.filter(a =>
          a.full_name?.toLowerCase().includes(query.toLowerCase())
        );
        setResults(filtered);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (ancestor) => {
    navigate(`/ancestor/${ancestor.id}`);
    setQuery('');
    setShowResults(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="w-full bg-[#1A1614] border border-[rgba(201,145,58,0.25)] rounded-xl pl-12 pr-4 py-3.5 text-parchment placeholder:text-parchment/30 focus:outline-none focus:border-[#C9913A] focus:gold-glow transition-all"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-parchment/40 hover:text-parchment">
            <X size={18} />
          </button>
        )}
      </div>

      {showResults && query.trim().length >= 2 && (
        <div className="absolute top-full mt-2 w-full bg-[#1A1614] border border-[rgba(201,145,58,0.25)] rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-6 text-center text-parchment/50 text-sm">Searching the archive...</div>
          ) : results.length > 0 ? (
            results.map(ancestor => (
              <button
                key={ancestor.id}
                onClick={() => handleSelect(ancestor)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[rgba(201,145,58,0.08)] transition-colors text-left border-b border-[rgba(201,145,58,0.08)] last:border-0"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border border-[#C9913A]/40 bg-[#0D0B0A] flex items-center justify-center flex-shrink-0">
                  {ancestor.profile_photo ? (
                    <img src={ancestor.profile_photo} alt="" className={`w-full h-full object-cover ${!ancestor.living ? 'sepia-tint' : ''}`} />
                  ) : (
                    <span className="font-display text-gold/60 text-sm">{ancestor.full_name?.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <p className="text-parchment text-sm font-medium">{ancestor.full_name}</p>
                  <p className="text-parchment/40 text-xs">
                    {ancestor.birth_date ? new Date(ancestor.birth_date).getFullYear() : ''}
                    {ancestor.death_date ? ` – ${new Date(ancestor.death_date).getFullYear()}` : ancestor.living ? ' – present' : ''}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-parchment/50 text-sm">No ancestors found for "{query}"</div>
          )}
        </div>
      )}
    </div>
  );
}