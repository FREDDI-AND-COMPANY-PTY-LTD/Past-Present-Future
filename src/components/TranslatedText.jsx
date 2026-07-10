import React, { useState } from 'react';
import { Languages, Loader2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function TranslatedText({ text, itemId, savedTranslation, savedLanguage }) {
  const [translation, setTranslation] = useState(savedTranslation || null);
  const [detectedLanguage, setDetectedLanguage] = useState(savedLanguage || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const alreadyEnglish = savedTranslation && savedLanguage === 'English';

  const translate = async () => {
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

      setTranslation(result.translation);
      setDetectedLanguage(result.detected_language);

      // Persist to the ContentItem so the translation displays permanently
      if (itemId) {
        await base44.entities.ContentItem.update(itemId, {
          english_translation: result.translation,
          translation_language: result.detected_language,
        }).catch(() => {});
      }
    } catch (e) {
      setError('Could not translate. Please try again.');
    }
    setLoading(false);
  };

  // If a saved translation exists, show it permanently
  if (translation) {
    return (
      <div className="mt-3 p-4 rounded-lg bg-[rgba(201,145,58,0.04)] border border-[rgba(201,145,58,0.15)]">
        {detectedLanguage && detectedLanguage !== 'English' && (
          <p className="text-xs text-amber-light/60 mb-2 flex items-center gap-1.5">
            <Languages size={12} /> English translation (from {detectedLanguage})
          </p>
        )}
        <p className="text-parchment/70 leading-relaxed whitespace-pre-wrap text-sm">{translation}</p>
        {alreadyEnglish && (
          <p className="text-xs text-parchment/40 mt-2 italic">This text is already in English.</p>
        )}
        <button
          onClick={translate}
          disabled={loading}
          className="mt-3 flex items-center gap-1.5 text-xs text-amber-light/50 hover:text-amber-light transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Re-translate
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={translate}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)] text-amber-light/80 hover:bg-[rgba(201,145,58,0.12)] hover:text-amber-light text-xs font-medium transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
        {loading ? 'Translating...' : 'Translate to English'}
      </button>

      {error && <p className="mt-2 text-xs text-red-400/70">{error}</p>}
    </div>
  );
}