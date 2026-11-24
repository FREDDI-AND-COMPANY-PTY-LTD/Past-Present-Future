import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Loader2, MapPin, RotateCcw, X } from 'lucide-react';
import ReviewCompare from '@/components/review/ReviewCompare';
import { ageOf, badgeFor, stripeClass, typeMeta } from '@/lib/reviewMeta';

const TONE_CLASSES = {
  red: 'bg-red-500/10 text-red-300 border-red-500/25',
  gold: 'bg-[rgba(201,145,58,0.12)] text-amber-light border-[rgba(201,145,58,0.3)]',
  muted: 'bg-[rgba(245,236,215,0.05)] text-parchment/50 border-[rgba(245,236,215,0.12)]',
};

export default function ReviewCard({ item, focused, past, forceDismissOpen, selectable, selected, onToggleSelect, onAction }) {
  const meta = typeMeta(item.type);
  const Icon = meta.icon;
  const badge = badgeFor(item);
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState('');
  const [survivor, setSurvivor] = useState(item.survivor_options?.[1]?.id || item.survivor_options?.[0]?.id || '');
  const [busy, setBusy] = useState(null);
  const reasonRef = useRef(null);

  useEffect(() => {
    if (!forceDismissOpen) return;
    setDismissing(true);
    setExpanded(true);
    const t = setTimeout(() => reasonRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [forceDismissOpen]);

  const act = async (action, extra = {}) => {
    setBusy(action);
    await onAction(item, action, extra);
    setBusy(null);
  };

  const confirmDismiss = () => {
    if (!reason.trim()) {
      reasonRef.current?.focus();
      return;
    }
    act('dismiss', { note: reason.trim() });
  };

  return (
    <div
      id={`review-card-${item.id}`}
      className={`aged-card rounded-xl overflow-hidden flex transition-shadow ${focused ? 'ring-1 ring-[#C9913A]' : ''}`}
    >
      <div className={`w-1.5 flex-shrink-0 ${stripeClass(item)}`} />

      <div className="flex-1 min-w-0 p-4">
        <div className="flex items-start gap-3">
          {selectable && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect?.(item.id)}
              className="mt-1 accent-[#C9913A] flex-shrink-0"
              aria-label={`Select ${item.title}`}
            />
          )}

          <div className="w-8 h-8 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center flex-shrink-0">
            <Icon size={15} className="text-gold" />
          </div>

          <button onClick={() => setExpanded((v) => !v)} className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-parchment/40">{meta.label}</span>
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${TONE_CLASSES[badge.tone]}`}>{badge.label}</span>
              <span className="flex items-center gap-1 text-[10px] text-parchment/30 ml-auto flex-shrink-0">
                <Clock size={10} /> {ageOf(item.created_date)}
              </span>
            </div>
            <p className="font-display text-base text-parchment mt-1 truncate">{item.title}</p>
            <p className="flex items-center gap-1 text-[11px] text-parchment/40 mt-0.5 truncate">
              <MapPin size={10} className="flex-shrink-0" /> {item.where || 'Archive record'}
            </p>
            {item.subtitle && <p className="text-xs text-parchment/50 mt-1.5 line-clamp-2">{item.subtitle}</p>}
          </button>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[rgba(201,145,58,0.15)] text-amber-light/80 text-[11px] hover:border-[rgba(201,145,58,0.35)] transition-colors flex-shrink-0"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Compare
          </button>
        </div>

        {expanded && (
          <ReviewCompare item={item} survivor={survivor} onSurvivorChange={setSurvivor} />
        )}

        {past ? (
          <div className="flex justify-end mt-3">
            <button
              onClick={() => act('reopen')}
              disabled={!!busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(201,145,58,0.25)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.08)] transition-colors disabled:opacity-50"
            >
              {busy === 'reopen' ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Move back to Open
            </button>
          </div>
        ) : dismissing ? (
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmDismiss(); }}
              placeholder="Reason for dismissing (required)"
              className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmDismiss}
                disabled={!!busy || !reason.trim()}
                className="px-3 py-2 rounded-lg bg-red-900/25 text-red-300 border border-red-500/30 text-xs font-medium hover:bg-red-900/40 transition-colors disabled:opacity-40"
              >
                {busy === 'dismiss' ? 'Dismissing…' : 'Confirm dismiss'}
              </button>
              <button
                onClick={() => { setDismissing(false); setReason(''); }}
                disabled={!!busy}
                className="px-3 py-2 rounded-lg border border-[rgba(245,236,215,0.12)] text-parchment/50 text-xs hover:bg-[rgba(245,236,215,0.05)] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => act('resolve', item.type === 'duplicate' ? { survivor_id: survivor } : {})}
              disabled={!!busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy === 'resolve' ? <Loader2 size={12} className="animate-spin" /> : null}
              {meta.primary}
            </button>
            <button
              onClick={() => setDismissing(true)}
              disabled={!!busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[rgba(245,236,215,0.12)] text-parchment/60 text-xs hover:bg-[rgba(245,236,215,0.05)] transition-colors disabled:opacity-50"
            >
              <X size={12} /> Dismiss
            </button>
            <button
              onClick={() => act('later')}
              disabled={!!busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[rgba(201,145,58,0.2)] text-amber-light/80 text-xs hover:bg-[rgba(201,145,58,0.08)] transition-colors disabled:opacity-50"
            >
              <Clock size={12} /> Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}