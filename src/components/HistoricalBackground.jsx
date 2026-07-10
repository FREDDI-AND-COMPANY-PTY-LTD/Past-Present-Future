import React, { useState } from 'react';
import { BookOpen, Loader2, RefreshCw, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

export default function HistoricalBackground({ item, onUpdate }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const background = item?.historical_background;
  const generatedAt = item?.historical_background_generated_at;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('generateHistoricalBackground', {
        content_item_id: item.id,
      });
      if (res.data?.historical_background) {
        onUpdate({
          ...item,
          historical_background: res.data.historical_background,
          historical_background_generated_at: new Date().toISOString(),
        });
      } else if (res.data?.error) {
        setError(res.data.error);
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to generate historical background');
    }
    setGenerating(false);
  };

  return (
    <div className="aged-card rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={20} className="text-gold" />
        <h3 className="font-display text-lg text-parchment">Historical Background</h3>
        <span className="flex items-center gap-1 ml-auto text-xs text-parchment/40">
          <Globe size={12} /> AI-researched via web search
        </span>
      </div>

      {background ? (
        <>
          <div className="prose prose-invert prose-sm max-w-none text-parchment/70 leading-relaxed">
            <ReactMarkdown>{background}</ReactMarkdown>
          </div>
          {generatedAt && (
            <p className="text-xs text-parchment/30 mt-4 pt-3 border-t border-[rgba(201,145,58,0.1)]">
              Generated {new Date(generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {generating ? 'Researching...' : 'Regenerate'}
          </button>
        </>
      ) : (
        <div>
          <p className="text-sm text-parchment/50 leading-relaxed mb-4">
            The AI can research the broader historical context of this event — the places, institutions, migration patterns, occupations, and cultural backdrop that shaped the ancestor's experience — using the data extracted from this upload.
          </p>
          {error && (
            <p className="text-sm text-red-400/80 mb-3">{error}</p>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
            {generating ? 'Researching historical context...' : 'Generate Historical Background'}
          </button>
        </div>
      )}
    </div>
  );
}