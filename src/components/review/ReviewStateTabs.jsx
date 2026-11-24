import React from 'react';
import { STATE_TABS } from '@/lib/reviewMeta';

export default function ReviewStateTabs({ status, onStatusChange, counts }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[rgba(201,145,58,0.15)]">
      {STATE_TABS.map((tab) => {
        const active = status === tab.key;
        const count = counts?.[tab.key] || 0;
        return (
          <button
            key={tab.key}
            onClick={() => onStatusChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-[#C9913A] text-gold'
                : 'border-transparent text-parchment/50 hover:text-amber-light'
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${active ? 'bg-[#8B6914] text-amber-light' : 'bg-[rgba(201,145,58,0.08)] text-parchment/40'}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}