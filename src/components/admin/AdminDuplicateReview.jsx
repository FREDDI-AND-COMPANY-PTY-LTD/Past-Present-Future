import React, { useState } from 'react';
import { Copy, Loader2, GitMerge, X, Check, AlertTriangle, ExternalLink, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AdminDuplicateReview({ duplicates, onResolved, scope }) {
  const [scanning, setScanning] = useState(false);
  const [merging, setMerging] = useState(null); // pair index being merged
  const [dismissed, setDismissed] = useState(new Set());
  const [resolvedPairs, setResolvedPairs] = useState(new Set());
  const [localDups, setLocalDups] = useState(duplicates);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('scanForDuplicates', {
        ...(scope && scope.ancestorIds ? { ancestor_ids: [...scope.ancestorIds] } : {}),
      });
      const pairs = res.data?.duplicate_pairs || [];
      setLocalDups(pairs);
      setResolvedPairs(new Set());
      setDismissed(new Set());
    } catch (e) {}
    setScanning(false);
  };

  const handleMerge = async (pairIdx, keepItemId, removeItemId) => {
    setMerging(pairIdx);
    try {
      await base44.functions.invoke('mergeDuplicateItems', {
        keep_item_id: keepItemId,
        remove_item_id: removeItemId,
      });
      setResolvedPairs(prev => new Set([...prev, pairIdx]));
      onResolved?.();
    } catch (e) {}
    setMerging(null);
  };

  const handleDismiss = (pairIdx) => {
    setDismissed(prev => new Set([...prev, pairIdx]));
  };

  return (
    <div className="space-y-4">
      {/* Scan button */}
      <div className="aged-card rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-parchment font-medium flex items-center gap-2">
            <Copy size={16} className="text-gold" /> Archive Duplicate Scan
          </p>
          <p className="text-xs text-parchment/40 mt-1">
            Scans all existing items tagged to the same ancestor(s) and uses AI to detect potential duplicates.
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
        >
          {scanning ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
          {scanning ? 'Scanning...' : 'Scan for Duplicates'}
        </button>
      </div>

      {/* Results */}
      {localDups.length === 0 && !scanning ? (
        <div className="aged-card rounded-xl p-12 text-center">
          <Check size={32} className="text-green-400/50 mx-auto mb-3" />
          <p className="text-parchment/50">No potential duplicates detected. Run a scan to check the archive.</p>
        </div>
      ) : (
        localDups.map((pair, idx) => {
          if (resolvedPairs.has(idx) || dismissed.has(idx)) return null;
          const itemA = pair.item_a;
          const itemB = pair.item_b;
          const aIsEarlier = new Date(itemA.saved_at) <= new Date(itemB.saved_at);
          const earlier = aIsEarlier ? itemA : itemB;
          const later = aIsEarlier ? itemB : itemA;

          return (
            <div key={idx} className="aged-card rounded-xl p-5 border-[rgba(201,145,58,0.25)]">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-light" />
                  <span className="text-sm text-parchment font-medium">Potential Duplicate</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${pair.confidence >= 0.8 ? 'bg-red-500/10 text-red-300' : 'bg-[rgba(201,145,58,0.1)] text-amber-light'}`}>
                    {Math.round(pair.confidence * 100)}% match
                  </span>
                </div>
                <button onClick={() => handleDismiss(idx)} className="text-parchment/30 hover:text-parchment transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* AI reason */}
              <p className="text-xs text-parchment/50 mb-4 italic">{pair.reason}</p>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Earlier item (recommended to keep) */}
                <div className="p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/20 text-green-400 border border-green-800/30">Earliest Saved</span>
                  </div>
                  {earlier.file_url && (
                    <img src={earlier.file_url} alt="" className="w-full h-32 object-cover rounded mb-2 sepia-tint" />
                  )}
                  <p className="text-sm text-parchment font-medium truncate">{earlier.title || 'Untitled'}</p>
                  <div className="text-xs text-parchment/40 space-y-0.5 mt-1">
                    {earlier.date && <p>{earlier.date}</p>}
                    {earlier.location_name && <p className="truncate">{earlier.location_name}</p>}
                    <p className="text-parchment/30">{new Date(earlier.saved_at).toLocaleDateString('en-AU')}</p>
                  </div>
                  <a href={`/content/${earlier.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-amber-light hover:text-gold">
                    <ExternalLink size={10} /> View
                  </a>
                </div>

                {/* Later item (recommended to remove/merge) */}
                <div className="p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(245,236,215,0.05)] text-parchment/40 border border-[rgba(245,236,215,0.1)]">Later Save</span>
                  </div>
                  {later.file_url && (
                    <img src={later.file_url} alt="" className="w-full h-32 object-cover rounded mb-2 sepia-tint" />
                  )}
                  <p className="text-sm text-parchment font-medium truncate">{later.title || 'Untitled'}</p>
                  <div className="text-xs text-parchment/40 space-y-0.5 mt-1">
                    {later.date && <p>{later.date}</p>}
                    {later.location_name && <p className="truncate">{later.location_name}</p>}
                    <p className="text-parchment/30">{new Date(later.saved_at).toLocaleDateString('en-AU')}</p>
                  </div>
                  <a href={`/content/${later.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-amber-light hover:text-gold">
                    <ExternalLink size={10} /> View
                  </a>
                </div>
              </div>

              {/* Merge direction */}
              <div className="flex items-center justify-center gap-2 mb-3 text-xs text-parchment/40">
                <span>Merge later into earliest</span>
                <ArrowRight size={12} className="text-gold" />
                <span>keeps earliest-saved data, fills gaps from later, deletes later</span>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleMerge(idx, earlier.id, later.id)}
                  disabled={merging === idx}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {merging === idx ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
                  Merge & Remove Later
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
                  onClick={() => handleDismiss(idx)}
                  disabled={merging === idx}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-parchment/50 border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.05)] transition-colors disabled:opacity-50"
                >
                  <X size={14} /> Not a Duplicate
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Resolved count */}
      {resolvedPairs.size > 0 && (
        <div className="aged-card rounded-xl p-4 flex items-center gap-2 text-sm text-green-400">
          <Check size={16} />
          {resolvedPairs.size} duplicate pair{resolvedPairs.size !== 1 ? 's' : ''} merged successfully.
        </div>
      )}
    </div>
  );
}