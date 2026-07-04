import React, { useState, useEffect } from 'react';
import { Flag, Loader2, Check, X, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AdminApprovals({ refreshKey }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState({});

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ConflictFlag.filter({ status: 'open' }, '-created_date', 50);
      setFlags(data || []);
    } catch (e) {
      // error
    }
    setLoading(false);
  };

  useEffect(() => { fetchFlags(); }, [refreshKey]);

  const resolve = async (id, status) => {
    setResolving(id);
    try {
      const user = await base44.auth.me().catch(() => null);
      await base44.entities.ConflictFlag.update(id, {
        status,
        resolution_note: resolutionNotes[id] || '',
        resolved_by_id: user?.id || null,
      });
      setFlags(prev => prev.filter(f => f.id !== id));
      setResolutionNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e) {
      // error
    }
    setResolving(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="text-gold animate-spin" />
      </div>
    );
  }

  if (flags.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Check size={32} className="text-gold/50 mx-auto mb-3" />
        <p className="text-parchment/50">No pending conflict flags for approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flags.map(flag => (
        <div key={flag.id} className="aged-card rounded-xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <Flag size={18} className="text-amber-light flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-parchment">{flag.dispute_description}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-parchment/40">
                {flag.field_name && <span>Field: <span className="text-amber-light/70">{flag.field_name.replace(/_/g, ' ')}</span></span>}
                {flag.bloodline && <span>Bloodline: <span className="text-amber-light/70">{flag.bloodline}</span></span>}
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(flag.created_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={resolutionNotes[flag.id] || ''}
              onChange={e => setResolutionNotes(prev => ({ ...prev, [flag.id]: e.target.value }))}
              placeholder="Resolution note (optional)"
              className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => resolve(flag.id, 'resolved')}
                disabled={resolving === flag.id}
                className="px-3 py-2 rounded-lg text-xs bg-green-500/10 text-green-300 border border-green-500/25 hover:bg-green-500/20 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                {resolving === flag.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Resolve
              </button>
              <button
                onClick={() => resolve(flag.id, 'dismissed')}
                disabled={resolving === flag.id}
                className="px-3 py-2 rounded-lg text-xs bg-red-500/10 text-red-300 border border-red-500/25 hover:bg-red-500/20 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <X size={12} />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}