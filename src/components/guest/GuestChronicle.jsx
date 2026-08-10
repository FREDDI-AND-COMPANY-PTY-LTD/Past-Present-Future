import React, { useState } from 'react';
import { Newspaper, Calendar } from 'lucide-react';

export default function GuestChronicle({ newsletters }) {
  const [selId, setSelId] = useState(null);
  const sel = (newsletters || []).find((n) => n.id === selId);
  if ((newsletters || []).length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Newspaper size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50 text-sm">No chronicles published yet.</p>
      </div>
    );
  }
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
        {newsletters.map((n) => (
          <button key={n.id} onClick={() => setSelId(n.id)}
            className={`w-full text-left aged-card rounded-lg p-3 transition-colors ${selId === n.id ? 'border-[#C9913A]' : 'hover:border-[rgba(201,145,58,0.3)]'}`}>
            <p className="text-sm text-parchment font-medium">{n.headline}</p>
            <p className="text-xs text-parchment/40 mt-1 flex items-center gap-1"><Calendar size={11} />{n.month_label}</p>
          </button>
        ))}
      </div>
      <div className="lg:col-span-2">
        {!sel ? (
          <div className="aged-card rounded-xl p-12 text-center"><p className="text-parchment/50 text-sm">Select a chronicle to read.</p></div>
        ) : (
          <div className="aged-card rounded-xl p-6">
            <p className="text-xs text-gold uppercase tracking-wider">{sel.frequency} chronicle · {sel.branch_name || 'Family'}</p>
            <h2 className="font-display text-2xl text-parchment mb-1">{sel.headline}</h2>
            <p className="text-xs text-amber-light/70 mb-4">{sel.month_label}</p>
            {sel.intro && <p className="text-parchment/80 text-sm leading-relaxed mb-4">{sel.intro}</p>}
            {(sel.sections || []).map((s, i) => (
              <div key={i} className="mb-4">
                {s.subheading && <h3 className="font-display text-lg text-amber-light mb-1">{s.subheading}</h3>}
                <p className="text-parchment/70 text-sm leading-relaxed whitespace-pre-wrap">{s.body}</p>
              </div>
            ))}
            {sel.closing && (
              <p className="text-parchment/80 text-sm leading-relaxed border-t border-[rgba(201,145,58,0.15)] pt-4">{sel.closing}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}