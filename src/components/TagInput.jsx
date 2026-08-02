import React, { useState, useEffect, useRef } from 'react';
import { Tag, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Tag input with autocomplete suggestions drawn from existing tags across the
 * archive. Renders the tag chips, a type-to-add field, and a dropdown of
 * matching existing tags so tag spelling stays consistent.
 */
export default function TagInput({ tags = [], onChange, placeholder = 'Add a tag...' }) {
  const [input, setInput] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    base44.entities.ContentItem.list('-created_date', 500)
      .then(items => {
        const set = new Set();
        for (const it of items || []) {
          for (const t of (it.tags || [])) {
            if (t) set.add(t);
          }
        }
        setAllTags([...set].sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {});
  }, []);

  const add = (val) => {
    const t = (val || '').trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };

  const remove = (t) => onChange(tags.filter(x => x !== t));

  const suggestions = input.trim()
    ? allTags.filter(t => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t)).slice(0, 8)
    : [];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="aged-card rounded-xl p-5">
      <label className="text-sm text-parchment/60 mb-2 flex items-center gap-1.5"><Tag size={14} /> Tags</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)]">
            {tag}
            <button onClick={() => remove(tag)} className="text-parchment/30 hover:text-parchment"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div ref={wrapRef} className="relative">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input); } else if (e.key === 'Escape') { setOpen(false); } }}
            className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
            placeholder={placeholder}
          />
          <button onClick={() => add(input)} className="px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm hover:bg-[rgba(201,145,58,0.15)] transition-colors">Add</button>
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.2)] bg-[#1A1614] shadow-lg">
            {suggestions.map(s => (
              <button key={s} type="button" onClick={() => { add(s); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-parchment/80 hover:bg-[rgba(201,145,58,0.1)] transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {allTags.length > 0 && input.trim() === '' && (
        <p className="text-xs text-parchment/30 mt-2">{allTags.length} existing tag{allTags.length === 1 ? '' : 's'} in the archive — start typing to see suggestions.</p>
      )}
    </div>
  );
}