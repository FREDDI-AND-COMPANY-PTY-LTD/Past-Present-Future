import React from 'react';
import { Link } from 'react-router-dom';
import { Flag, CheckCircle, XCircle } from 'lucide-react';

const statusBadges = {
  open: { label: 'Open', class: 'bg-[#8B6914]/30 text-amber-light border-[rgba(201,145,58,0.3)]' },
  resolved: { label: 'Resolved', class: 'bg-green-900/20 text-green-400 border-green-800/30' },
  dismissed: { label: 'Dismissed', class: 'bg-[rgba(245,236,215,0.05)] text-parchment/40 border-[rgba(245,236,215,0.1)]' },
};

export default function AdminDisputesList({ flags, onResolve }) {
  if (!flags || flags.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Flag size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50">No open disputes or flags.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flags.map(flag => (
        <div key={flag.id} className="aged-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Flag size={18} className="text-amber-light" />
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadges[flag.status]?.class || statusBadges.open.class}`}>
                {statusBadges[flag.status]?.label || 'Open'}
              </span>
              {flag.flag_type && (
                <span className="text-xs text-parchment/40 capitalize">{flag.flag_type.replace(/_/g, ' ')}</span>
              )}
              {flag.bloodline && <span className="text-xs text-parchment/40">· {flag.bloodline}</span>}
            </div>
            <span className="text-xs text-parchment/40 whitespace-nowrap">{flag.created_date ? new Date(flag.created_date).toLocaleString('en-AU') : ''}</span>
          </div>
          <p className="text-sm text-parchment/70 mb-3">{flag.dispute_description}</p>
          {flag.content_item_id && (
            <Link to={`/content/${flag.content_item_id}`} className="text-xs text-amber-light hover:text-gold">View content item →</Link>
          )}
          {flag.status === 'open' && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => onResolve(flag.id, 'resolved')} className="px-3 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors flex items-center gap-1">
                <CheckCircle size={14} /> Resolve
              </button>
              <button onClick={() => onResolve(flag.id, 'dismissed')} className="px-3 py-1.5 rounded-lg bg-[rgba(245,236,215,0.05)] text-parchment/50 text-xs border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.08)] transition-colors flex items-center gap-1">
                <XCircle size={14} /> Dismiss
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}