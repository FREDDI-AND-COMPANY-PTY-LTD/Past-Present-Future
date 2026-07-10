import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ContestedFieldBadge({ flags }) {
  const [hovered, setHovered] = useState(false);

  if (!flags || flags.length === 0) return null;

  return (
    <span
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-light border border-amber-500/30 cursor-help whitespace-nowrap">
        <AlertTriangle size={9} /> Contested
      </span>
      {hovered && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-72 p-3 rounded-lg bg-[#1A1614] border border-[rgba(201,145,58,0.3)] shadow-xl">
          <p className="text-xs font-semibold text-amber-light mb-2 flex items-center gap-1">
            <AlertTriangle size={11} /> Competing Data Points
          </p>
          {flags.map((flag, i) => (
            <div key={flag.id || i} className={i > 0 ? 'mt-2 pt-2 border-t border-[rgba(201,145,58,0.1)]' : ''}>
              {flag.competing_values && Object.keys(flag.competing_values).length > 0 && (
                <div className="mb-1.5 space-y-1">
                  {flag.competing_values.new_value != null && (
                    <p className="text-xs text-parchment/60">
                      <span className="text-amber-light/50">Your upload: </span>{String(flag.competing_values.new_value)}
                    </p>
                  )}
                  {flag.competing_values.existing_value != null && (
                    <p className="text-xs text-parchment/60">
                      <span className="text-amber-light/50">Existing item: </span>{String(flag.competing_values.existing_value)}
                    </p>
                  )}
                </div>
              )}
              {flag.dispute_description && (
                <p className="text-xs text-parchment/50 italic leading-relaxed">{flag.dispute_description}</p>
              )}
              {flag.raised_by_name && (
                <p className="text-[10px] text-parchment/30 mt-1">Raised by {flag.raised_by_name}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}