import React, { useState } from 'react';
import { Lightbulb, X, Loader2, Check, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  'Bug / Something broken',
  'Feature idea',
  'UI / Design feedback',
  'AI Assistant feedback',
  'Performance / Speed',
  'Other',
];

export default function SuggestImprovementDialog({ children }) {
  const [open, setOpen] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!suggestion.trim()) return;
    setSending(true);
    try {
      await base44.functions.invoke('sendShopCreatorSuggestion', {
        suggestion,
        category,
        current_page: window.location.pathname,
      });
      setSent(true);
    } catch (e) {
      // error — keep dialog open
    }
    setSending(false);
  };

  const handleClose = () => {
    setOpen(false);
    setSent(false);
    setSuggestion('');
    setCategory(CATEGORIES[0]);
  };

  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
        {children || (
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[rgba(201,145,58,0.2)] text-parchment/60 text-sm hover:text-amber-light hover:border-[rgba(201,145,58,0.4)] transition-colors">
            <Lightbulb size={14} />
            Suggest Improvement
          </button>
        )}
      </span>

      {open && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4" onClick={handleClose}>
          <div className="aged-card rounded-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[rgba(201,145,58,0.15)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb size={20} className="text-gold" />
                <h3 className="font-display text-lg text-parchment">Suggest an Improvement</h3>
              </div>
              <button onClick={handleClose} className="text-parchment/40 hover:text-parchment transition-colors">
                <X size={18} />
              </button>
            </div>

            {sent ? (
              <div className="px-6 py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-4">
                  <Check size={28} className="text-gold" />
                </div>
                <p className="font-display text-lg text-parchment mb-1">Thank you!</p>
                <p className="text-sm text-parchment/50">Your suggestion has been sent directly to the app developer.</p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-parchment/60">
                  Spotted a bug, have a feature idea, or want to give design feedback? This goes <span className="text-amber-light">directly to the app developer</span> — not the family admin.
                </p>
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Your suggestion <span className="text-[#C9913A]">*</span></label>
                  <textarea
                    value={suggestion}
                    onChange={e => setSuggestion(e.target.value)}
                    rows={5}
                    autoFocus
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                    placeholder="Describe what you'd like improved, what's broken, or your idea..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm text-parchment/50 border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.05)] transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!suggestion.trim() || sending}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {sending ? 'Sending...' : 'Send to Developer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}