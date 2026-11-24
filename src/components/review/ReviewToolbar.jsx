import React from 'react';
import { ArrowDownUp } from 'lucide-react';
import { REVIEW_TYPES, SORTS } from '@/lib/reviewMeta';

export default function ReviewToolbar({ scope, onScopeChange, branchLabel, sort, onSortChange, type, onTypeChange, counts }) {
  const total = Object.values(counts || {}).reduce((sum, n) => sum + (n || 0), 0);
  const countFor = (key) => (key === 'all' ? total : counts?.[key] || 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-[rgba(201,145,58,0.2)] overflow-hidden">
          <button
            onClick={() => onScopeChange('branch')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${scope === 'branch' ? 'bg-[rgba(201,145,58,0.15)] text-gold' : 'text-parchment/50 hover:text-amber-light'}`}
          >
            Branch · {branchLabel}
          </button>
          <button
            onClick={() => onScopeChange('global')}
            className={`px-4 py-2 text-sm font-medium border-l border-[rgba(201,145,58,0.2)] transition-colors ${scope === 'global' ? 'bg-[rgba(201,145,58,0.15)] text-gold' : 'text-parchment/50 hover:text-amber-light'}`}
          >
            Global
          </button>
        </div>

        <label className="flex items-center gap-2 ml-auto text-xs text-parchment/50">
          <ArrowDownUp size={14} className="text-gold/70" />
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A]"
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {REVIEW_TYPES.map((t) => {
          const active = type === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onTypeChange(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active
                  ? 'bg-[rgba(201,145,58,0.15)] text-gold border-[rgba(201,145,58,0.4)]'
                  : 'text-parchment/60 border-[rgba(201,145,58,0.12)] hover:text-amber-light'
              }`}
            >
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${active ? 'bg-[#8B6914] text-amber-light' : 'bg-[rgba(201,145,58,0.08)] text-parchment/40'}`}>
                {countFor(t.key)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}