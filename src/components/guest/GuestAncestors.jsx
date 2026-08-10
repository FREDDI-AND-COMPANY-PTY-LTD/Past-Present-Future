import React, { useState } from 'react';
import { Users, Calendar, MapPin, Image as ImageIcon } from 'lucide-react';

export default function GuestAncestors({ ancestors, contentItems, onSelectContent }) {
  const [selectedId, setSelectedId] = useState(null);
  const visible = (ancestors || []).filter((a) => a.review_status !== 'staged');
  const selected = visible.find((a) => a.id === selectedId);
  const nameOf = (id) => visible.find((a) => a.id === id)?.full_name || '—';
  const taggedItems = selected
    ? (contentItems || []).filter((i) => (i.ancestor_ids || []).includes(selected.id) && !i.parent_content_item_id)
    : [];

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
        {visible.map((a) => (
          <button key={a.id} onClick={() => setSelectedId(a.id)}
            className={`w-full text-left aged-card rounded-lg p-3 flex items-center gap-3 transition-colors ${selectedId === a.id ? 'border-[#C9913A]' : 'hover:border-[rgba(201,145,58,0.3)]'}`}>
            <div className="w-9 h-9 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-sm text-gold font-medium flex-shrink-0">
              {a.full_name?.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-parchment truncate">{a.full_name}</p>
              {a.birth_date && <p className="text-xs text-parchment/40">{new Date(a.birth_date).getFullYear()}</p>}
            </div>
          </button>
        ))}
      </div>

      <div className="lg:col-span-2">
        {!selected ? (
          <div className="aged-card rounded-xl p-12 text-center">
            <Users size={32} className="text-gold/30 mx-auto mb-3" />
            <p className="text-parchment/50 text-sm">Select an ancestor to view their profile.</p>
          </div>
        ) : (
          <div className="aged-card rounded-xl p-6">
            <div className="flex items-start gap-4 mb-4">
              {selected.profile_photo ? (
                <img src={selected.profile_photo} className="w-20 h-20 rounded-lg object-cover sepia-tint" />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-[rgba(201,145,58,0.08)] flex items-center justify-center text-2xl text-gold/50 font-display">{selected.full_name?.charAt(0)}</div>
              )}
              <div>
                <h2 className="font-display text-2xl text-parchment">{selected.full_name}</h2>
                {selected.maiden_name && <p className="text-xs text-amber-light/70">née {selected.maiden_name}</p>}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-parchment/50">
                  {selected.birth_date && <span className="flex items-center gap-1"><Calendar size={11} />b. {new Date(selected.birth_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  {selected.birth_place && <span className="flex items-center gap-1"><MapPin size={11} />{selected.birth_place}</span>}
                  {selected.death_date && <span>d. {new Date(selected.death_date).getFullYear()}</span>}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-2 mb-4 text-xs">
              {selected.father_id && (
                <div className="bg-[rgba(201,145,58,0.04)] rounded-lg p-2"><p className="text-parchment/40">Father</p><button onClick={() => setSelectedId(selected.father_id)} className="text-amber-light hover:underline">{nameOf(selected.father_id)}</button></div>
              )}
              {selected.mother_id && (
                <div className="bg-[rgba(201,145,58,0.04)] rounded-lg p-2"><p className="text-parchment/40">Mother</p><button onClick={() => setSelectedId(selected.mother_id)} className="text-amber-light hover:underline">{nameOf(selected.mother_id)}</button></div>
              )}
              {selected.partner_id && (
                <div className="bg-[rgba(201,145,58,0.04)] rounded-lg p-2"><p className="text-parchment/40">Spouse</p><button onClick={() => setSelectedId(selected.partner_id)} className="text-amber-light hover:underline">{nameOf(selected.partner_id)}</button></div>
              )}
            </div>

            {(selected.ai_biography || selected.biography) && (
              <p className="text-parchment/70 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{selected.ai_biography || selected.biography}</p>
            )}

            {taggedItems.length > 0 && (
              <div>
                <p className="text-xs text-gold uppercase tracking-wider mb-2 flex items-center gap-1.5"><ImageIcon size={12} /> Events & Records</p>
                <div className="grid sm:grid-cols-3 gap-2">
                  {taggedItems.map((it) => (
                    <button key={it.id} onClick={() => onSelectContent(it)} className="aged-card rounded-lg overflow-hidden text-left hover:border-[rgba(201,145,58,0.35)]">
                      {it.file_url && it.content_type === 'photo' ? (
                        <img src={it.file_url} className="w-full h-20 object-cover sepia-tint" />
                      ) : (
                        <div className="w-full h-20 bg-[rgba(201,145,58,0.06)] flex items-center justify-center"><ImageIcon size={18} className="text-gold/40" /></div>
                      )}
                      <p className="text-xs text-parchment p-2 truncate">{it.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}