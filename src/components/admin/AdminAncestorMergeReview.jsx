import React, { useState } from 'react';
import { Users, Loader2, GitMerge, X, Check, AlertTriangle, ExternalLink, ArrowRight, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-AU') : '');

function ProfileCard({ ancestor, badge, badgeClass }) {
  return (
    <div className="p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)]">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${badgeClass}`}>{badge}</span>
        {ancestor.review_status && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/70 border border-[rgba(201,145,58,0.15)]">
            {ancestor.review_status.replace(/_/g, ' ')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-sm text-gold font-medium flex-shrink-0">
          {ancestor.full_name?.charAt(0) || '?'}
        </div>
        <p className="text-sm text-parchment font-medium truncate">{ancestor.full_name || 'Unnamed'}</p>
      </div>
      <div className="text-xs text-parchment/40 space-y-0.5">
        {ancestor.birth_date && <p>b. {fmtDate(ancestor.birth_date)}{ancestor.birth_place ? ` · ${ancestor.birth_place}` : ''}</p>}
        {ancestor.death_date && <p>d. {fmtDate(ancestor.death_date)}{ancestor.death_place ? ` · ${ancestor.death_place}` : ''}</p>}
        {ancestor.nationality && <p>{ancestor.nationality}</p>}
        {ancestor.bloodline && <p className="text-parchment/30">{ancestor.bloodline}</p>}
        <p className="text-parchment/30">added {fmtDate(ancestor.created_date)}</p>
      </div>
      {ancestor.biography && <p className="text-xs text-parchment/40 mt-2 line-clamp-2 italic">{ancestor.biography}</p>}
      <a href={`/ancestor/${ancestor.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-amber-light hover:text-gold">
        <ExternalLink size={10} /> View profile
      </a>
    </div>
  );
}

export default function AdminAncestorMergeReview() {
  const [scanning, setScanning] = useState(false);
  const [merging, setMerging] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());
  const [resolved, setResolved] = useState(new Set());
  const [pairs, setPairs] = useState([]);
  const [scanned, setScanned] = useState(null);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('scanAncestorDuplicates', {});
      setPairs(res.data?.duplicate_pairs || []);
      setScanned(res.data?.scanned ?? null);
      setResolved(new Set());
      setDismissed(new Set());
    } catch (e) {}
    setScanning(false);
  };

  const handleMerge = async (idx, keepId, removeId) => {
    setMerging(idx);
    try {
      await base44.functions.invoke('mergeAncestorProfiles', {
        keep_ancestor_id: keepId,
        remove_ancestor_id: removeId,
      });
      setResolved((prev) => new Set([...prev, idx]));
    } catch (e) {}
    setMerging(null);
  };

  const dismiss = (idx) => setDismissed((prev) => new Set([...prev, idx]));

  return (
    <div className="space-y-4">
      {/* Scan control */}
      <div className="aged-card rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-parchment font-medium flex items-center gap-2">
            <Users size={16} className="text-gold" /> Ancestor Profile Duplicate & Conflict Scan
          </p>
          <p className="text-xs text-parchment/40 mt-1">
            Scans every ancestor profile for likely duplicates (same person recorded twice) or conflicting facts, then lets you merge and approve in one pass.
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
        >
          {scanning ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
          {scanning ? 'Scanning...' : 'Scan Profiles'}
        </button>
      </div>

      {scanned != null && !scanning && (
        <p className="text-xs text-parchment/40 px-1">
          Scanned {scanned} profile{scanned !== 1 ? 's' : ''} · {pairs.length} pair{pairs.length !== 1 ? 's' : ''} flagged for review.
        </p>
      )}

      {/* Results */}
      {pairs.length === 0 && !scanning ? (
        <div className="aged-card rounded-xl p-12 text-center">
          <Check size={32} className="text-green-400/50 mx-auto mb-3" />
          <p className="text-parchment/50">No duplicate or conflicting profiles detected. Run a scan to check the archive.</p>
        </div>
      ) : (
        pairs.map((pair, idx) => {
          if (resolved.has(idx) || dismissed.has(idx)) return null;
          const a = pair.ancestor_a;
          const b = pair.ancestor_b;
          const aIsEarlier = new Date(a.created_date) <= new Date(b.created_date);
          const earlier = aIsEarlier ? a : b;
          const later = aIsEarlier ? b : a;

          return (
            <div key={idx} className="aged-card rounded-xl p-5 border-[rgba(201,145,58,0.25)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-light" />
                  <span className="text-sm text-parchment font-medium">
                    {pair.is_duplicate ? 'Likely Duplicate Profile' : 'Conflicting Profiles'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${pair.confidence >= 0.8 ? 'bg-red-500/10 text-red-300' : 'bg-[rgba(201,145,58,0.1)] text-amber-light'}`}>
                    {Math.round(pair.confidence * 100)}% match
                  </span>
                </div>
                <button onClick={() => dismiss(idx)} className="text-parchment/30 hover:text-parchment transition-colors">
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-parchment/50 mb-3 italic">{pair.reason}</p>

              {pair.conflict_fields?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {pair.conflict_fields.map((f) => (
                    <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-[#8B6914]/20 text-amber-light border border-[rgba(201,145,58,0.25)]">
                      conflicts: {f.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <ProfileCard ancestor={earlier} badge="Earliest Saved" badgeClass="bg-green-900/20 text-green-400 border border-green-800/30" />
                <ProfileCard ancestor={later} badge="Later Saved" badgeClass="bg-[rgba(245,236,215,0.05)] text-parchment/40 border border-[rgba(245,236,215,0.1)]" />
              </div>

              <div className="flex items-center justify-center gap-2 mb-3 text-xs text-parchment/40">
                <span>Merge later into earliest</span>
                <ArrowRight size={12} className="text-gold" />
                <span>fills gaps from later, re-points all references, approves & deletes later</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleMerge(idx, earlier.id, later.id)}
                  disabled={merging === idx}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {merging === idx ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Approve & Merge
                </button>
                <button
                  onClick={() => handleMerge(idx, later.id, earlier.id)}
                  disabled={merging === idx}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[rgba(201,145,58,0.2)] text-amber-light text-sm hover:bg-[rgba(201,145,58,0.08)] transition-colors disabled:opacity-50"
                >
                  {merging === idx ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
                  Keep Later Instead
                </button>
                <button
                  onClick={() => dismiss(idx)}
                  disabled={merging === idx}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-parchment/50 border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.05)] transition-colors disabled:opacity-50"
                >
                  <X size={14} /> Not the Same Person
                </button>
              </div>
            </div>
          );
        })
      )}

      {resolved.size > 0 && (
        <div className="aged-card rounded-xl p-4 flex items-center gap-2 text-sm text-green-400">
          <Check size={16} />
          {resolved.size} profile pair{resolved.size !== 1 ? 's' : ''} merged and approved.
        </div>
      )}
    </div>
  );
}