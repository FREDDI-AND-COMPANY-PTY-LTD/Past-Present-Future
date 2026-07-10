import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function TranslatedText({ text }) {
  const [translation, setTranslation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [error, setError] = useState(null);

  const translate = async () => {
    if (translation) {
      setShowTranslation(!showTranslation);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a professional translator for historical and genealogical documents. Translate the following text into English. Preserve the original meaning, tone, and any proper names (people, places, dates). Maintain line breaks and formatting. If the text is already in English, return it as-is and note that it was already in English.\n\nOriginal text:\n\n${text}`,
        response_json_schema: {
          type: 'object',
          properties: {
            translation: { type: 'string' },
            detected_language: { type: 'string' },
            already_english: { type: 'boolean' },
          },
        },
      });
      setTranslation(result);
      setShowTranslation(true);
    } catch (e) {
      setError('Could not translate. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="mt-3">
      <button
        onClick={translate}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)] text-amber-light/80 hover:bg-[rgba(201,145,58,0.12)] hover:text-amber-light text-xs font-medium transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
        {loading ? 'Translating...' : showTranslation ? 'Hide Translation' : 'Translate to English'}
      </button>

      {error && <p className="mt-2 text-xs text-red-400/70">{error}</p>}

      {showTranslation && translation && (
        <div className="mt-3 p-4 rounded-lg bg-[rgba(201,145,58,0.04)] border border-[rgba(201,145,58,0.15)]">
          {translation.detected_language && !translation.already_english && (
            <p className="text-xs text-amber-light/60 mb-2">Detected language: {translation.detected_language}</p>
          )}
          <p className="text-parchment/70 leading-relaxed whitespace-pre-wrap text-sm">{translation.translation}</p>
          {translation.already_english && (
            <p className="text-xs text-parchment/40 mt-2 italic">This text is already in English.</p>
          )}
        </div>
      )}
    </div>
  );
}