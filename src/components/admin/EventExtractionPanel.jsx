import React from 'react';
import { FileText, Award, Eye, Tag, MapPin, Calendar, User, Brain } from 'lucide-react';

export default function EventExtractionPanel({ item }) {
  if (!item) return null;

  const hasExtractedFields = item.extracted_fields && Object.keys(item.extracted_fields).length > 0;
  const hasVisualElements = item.visual_elements && Object.keys(item.visual_elements).length > 0;
  const hasTranscription = item.transcribed_text && item.transcribed_text.trim();
  const hasRawAnalysis = item.raw_ai_analysis && Object.keys(item.raw_ai_analysis).length > 0;
  const hasNotes = item.categorization_notes && item.categorization_notes.trim();

  return (
    <div className="space-y-5 mt-4">
      {/* Core event details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {item.date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={14} className="text-gold/60 flex-shrink-0" />
            <span className="text-parchment/40">Date:</span>
            <span className="text-parchment">{item.date}</span>
          </div>
        )}
        {item.location_name && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={14} className="text-gold/60 flex-shrink-0" />
            <span className="text-parchment/40">Location:</span>
            <span className="text-parchment">{item.location_name}</span>
          </div>
        )}
        {item.era && (
          <div className="flex items-center gap-2 text-sm">
            <Tag size={14} className="text-gold/60 flex-shrink-0" />
            <span className="text-parchment/40">Era:</span>
            <span className="text-parchment">{item.era}</span>
          </div>
        )}
        {item.ai_confidence != null && (
          <div className="flex items-center gap-2 text-sm">
            <Brain size={14} className="text-gold/60 flex-shrink-0" />
            <span className="text-parchment/40">AI Confidence:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${item.ai_confidence >= 0.7 ? 'bg-green-500/10 text-green-300' : item.ai_confidence >= 0.4 ? 'bg-[rgba(201,145,58,0.1)] text-amber-light' : 'bg-red-500/10 text-red-300'}`}>
              {Math.round(item.ai_confidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      {item.description && (
        <div>
          <p className="text-xs text-parchment/40 uppercase tracking-wider mb-1">Description</p>
          <p className="text-sm text-parchment/70 leading-relaxed">{item.description}</p>
        </div>
      )}

      {/* Full transcription */}
      {hasTranscription && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <FileText size={14} className="text-gold/60" />
            <p className="text-xs text-parchment/40 uppercase tracking-wider">Transcribed Text</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.12)]">
            <p className="text-sm text-parchment/70 leading-relaxed whitespace-pre-wrap">{item.transcribed_text}</p>
          </div>
        </div>
      )}

      {/* Extracted fields — full, no truncation */}
      {hasExtractedFields && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Award size={14} className="text-gold/60" />
            <p className="text-xs text-parchment/40 uppercase tracking-wider">Extracted Fields</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(item.extracted_fields).map(([key, val]) => {
              if (!val || (typeof val === 'string' && !val.trim())) return null;
              const display = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
              return (
                <div key={key} className="p-2.5 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
                  <p className="text-xs text-parchment/40 capitalize mb-0.5">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-parchment break-words">{display}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual elements — full, no truncation */}
      {hasVisualElements && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Eye size={14} className="text-gold/60" />
            <p className="text-xs text-parchment/40 uppercase tracking-wider">Visual Elements</p>
          </div>
          <div className="space-y-2">
            {item.visual_elements.objects?.length > 0 && (
              <ExtractionRow label="Objects" items={item.visual_elements.objects} />
            )}
            {item.visual_elements.people?.length > 0 && (
              <ExtractionRow label="People" items={item.visual_elements.people} />
            )}
            {item.visual_elements.text_elements?.length > 0 && (
              <ExtractionRow label="Text Elements" items={item.visual_elements.text_elements} />
            )}
            {item.visual_elements.dates_visible?.length > 0 && (
              <ExtractionRow label="Dates Visible" items={item.visual_elements.dates_visible} />
            )}
            {item.visual_elements.locations_visible?.length > 0 && (
              <ExtractionRow label="Locations Visible" items={item.visual_elements.locations_visible} />
            )}
            {item.visual_elements.era_indicators?.length > 0 && (
              <ExtractionRow label="Era Indicators" items={item.visual_elements.era_indicators} />
            )}
            {item.visual_elements.notable_features?.length > 0 && (
              <ExtractionRow label="Notable Features" items={item.visual_elements.notable_features} />
            )}
            {item.visual_elements.format_description && (
              <div className="p-2.5 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
                <p className="text-xs text-parchment/40 mb-0.5">Format</p>
                <p className="text-sm text-parchment">{item.visual_elements.format_description}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI categorization notes */}
      {hasNotes && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Brain size={14} className="text-gold/60" />
            <p className="text-xs text-parchment/40 uppercase tracking-wider">AI Categorization Notes</p>
          </div>
          <p className="text-sm text-parchment/60 leading-relaxed whitespace-pre-wrap">{item.categorization_notes}</p>
        </div>
      )}

      {/* Raw AI analysis — collapsible since it can be very large */}
      {hasRawAnalysis && (
        <details className="rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
          <summary className="cursor-pointer px-3 py-2 text-xs text-parchment/50 hover:text-parchment transition-colors select-none">
            Raw AI Analysis (click to expand)
          </summary>
          <pre className="px-3 pb-3 text-xs text-parchment/50 overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(item.raw_ai_analysis, null, 2)}
          </pre>
        </details>
      )}

      {/* Tags */}
      {item.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag, i) => (
            <span key={i} className="text-xs text-amber-light/70 bg-[rgba(201,145,58,0.06)] px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ExtractionRow({ label, items }) {
  return (
    <div className="p-2.5 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
      <p className="text-xs text-parchment/40 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="text-xs text-amber-light/80 bg-[rgba(201,145,58,0.06)] px-2 py-0.5 rounded">{item}</span>
        ))}
      </div>
    </div>
  );
}