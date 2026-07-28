import React, { useState } from 'react';
import { Sparkles, RefreshCw, Loader2, BookOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AncestorBiography({ ancestorId, biography, generatedAt, onGenerated }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await base44.functions.invoke('generateAncestorBiography', { ancestor_id: ancestorId });
      if (res?.error) throw new Error(res.error);
      const bio = res?.ai_biography || '';
      const at = res?.ai_biography_generated_at || new Date().toISOString();
      onGenerated?.(bio, at);
    } catch (e) {
      setError(e?.message || 'Unable to compose the biography. Please try again.');
    }
    setGenerating(false);
  };

  const fmtGenerated = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const paragraphs = (biography || '').split(/\n\n+/).filter(p => p.trim());

  return (
    <div className="aged-card rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-gold" />
          <h2 className="font-display text-2xl text-parchment">Ancestor's Story</h2>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.08)] transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 size={13} className="animate-spin" /> : biography ? <RefreshCw size={13} /> : <Sparkles size={13} />}
          {generating ? 'Composing...' : biography ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {paragraphs.length > 0 ? (
        <>
          <div className="text-parchment/80 text-sm leading-relaxed space-y-3">
            {paragraphs.map((p, i) => (
              <p key={i} className="font-body">{p}</p>
            ))}
          </div>
          {generatedAt && (
            <p className="text-[11px] text-parchment/30 mt-4 italic">
              AI-composed overview · last updated {fmtGenerated(generatedAt)} · synthesises tagged events, documents, family context, and historical research
            </p>
          )}
        </>
      ) : generating ? (
        <div className="space-y-2">
          <div className="h-3 w-full bg-[rgba(201,145,58,0.06)] rounded animate-pulse" />
          <div className="h-3 w-11/12 bg-[rgba(201,145,58,0.06)] rounded animate-pulse" />
          <div className="h-3 w-4/5 bg-[rgba(201,145,58,0.06)] rounded animate-pulse" />
          <div className="h-3 w-full bg-[rgba(201,145,58,0.06)] rounded animate-pulse" />
          <div className="h-3 w-3/5 bg-[rgba(201,145,58,0.06)] rounded animate-pulse" />
        </div>
      ) : (
        <p className="text-sm text-parchment/50">
          No overview yet. Generate one to weave the known events, documents, and historical context into a short narrative of this ancestor's life — regenerate it anytime new material is added to the archive.
        </p>
      )}
    </div>
  );
}