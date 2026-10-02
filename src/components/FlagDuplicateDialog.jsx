import React, { useState, useEffect } from 'react';
import { Copy, X, Loader2, Check, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function FlagDuplicateDialog({ contentItemId, contentItemTitle, ancestorId, bloodline, onClose, onSubmitted }) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
    base44.entities.ContentItem.filter(
      { review_status: 'reviewed' },
      { sort: '-created_date', limit: 100, fields: ['title', 'date'] }
    )
      .then(page => setItems(page.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(i => i.id !== contentItemId && (i.title || '').toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = async () => {
    if (!selectedId || !explanation.trim()) return;
    setSubmitting(true);
    try {
      const dupOf = items.find(i => i.id === selectedId);
      await base44.entities.ConflictFlag.create({
        content_item_id: contentItemId,
        flag_type: 'duplicate_upload',
        duplicate_of_content_item_id: selectedId,
        duplicate_of_content_item_title: dupOf?.title || '',
        dispute_description: explanation.trim(),
        status: 'open',
        raised_by_id: currentUser?.id || null,
        raised_by_name: currentUser?.full_name || currentUser?.email || 'Family Member',
        bloodline: bloodline || '',
        ...(ancestorId ? { ancestor_id: ancestorId } : {}),
      });
      setSubmitted(true);
      setExplanation('');
      setSelectedId('');
      onSubmitted?.();
    } catch (e) {}
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
          <div className="flex items-center gap-2">
            <Copy size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Flag as Duplicate</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-gold" />
            </div>
            <p className="text-parchment text-sm mb-1">Duplicate flag submitted for review.</p>
            <p className="text-parchment/40 text-xs">The branch admin will review and merge or dismiss the duplicate.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-xs text-parchment/50">
              Flag "<span className="text-amber-light">{contentItemTitle}</span>" as a duplicate of another event in the archive. The branch admin will review and merge or dismiss.
            </p>

            <div>
              <label className="text-sm text-parchment/60 mb-2 block">Search for the original event</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg pl-9 pr-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                  placeholder="Search by title..."
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A]">
              {loading ? (
                <div className="px-4 py-3 text-xs text-parchment/40 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Loading events...
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-4 py-3 text-xs text-parchment/40">No matching events found.</p>
              ) : (
                filtered.map(i => (
                  <button
                    key={i.id}
                    onClick={() => setSelectedId(i.id)}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${selectedId === i.id ? 'bg-[rgba(201,145,58,0.1)]' : 'hover:bg-[rgba(201,145,58,0.05)]'}`}
                  >
                    <span className="text-sm text-parchment truncate flex-1">{i.title}</span>
                    {selectedId === i.id && <Check size={14} className="text-gold" />}
                  </button>
                ))
              )}
            </div>

            <div>
              <label className="text-sm text-parchment/60 mb-2 block">Why is this a duplicate?</label>
              <textarea
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                rows={2}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                placeholder="e.g. Same photo uploaded twice, same certificate from different sources..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-[rgba(245,236,215,0.15)] text-parchment/60 text-sm hover:bg-[rgba(245,236,215,0.05)] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedId || !explanation.trim() || submitting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                Submit Duplicate Flag
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}