import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Network, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import VerifyConnectDialog from '@/components/admin/VerifyConnectDialog';

// Manual connection tool — lists every ancestor that has no father, mother,
// or partner link (and isn't a branch root), so an admin can place them into
// the tree even when they didn't surface through the staged-review queue.
export default function AdminConnectAncestors({ onResolved, scope }) {
  const [ancestors, setAncestors] = useState([]);
  const [rootIds, setRootIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [connectTarget, setConnectTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [anc, branches] = await Promise.all([
        base44.entities.Ancestor.list(),
        base44.entities.Branch.list(),
      ]);
      setAncestors(anc || []);
      setRootIds(new Set((branches || []).map(b => b.ancestor_id).filter(Boolean)));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const unconnected = ancestors.filter(a =>
    !a.father_id && !a.mother_id && !a.partner_id && !rootIds.has(a.id) &&
    (!scope || (scope.branchIds && scope.branchIds.has(a.branch_id)))
  );

  const handleVerified = (id) => {
    setConnectTarget(null);
    load();
    onResolved?.(id);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 size={20} className="text-gold animate-spin" /></div>;
  }

  if (unconnected.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Network size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50">Every ancestor is connected to the tree.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-parchment/40 mb-2">Ancestors not yet linked to a father, mother, or partner. Use "Connect" to place them in the tree.</p>
      {unconnected.map(ancestor => (
        <div key={ancestor.id} className="aged-card rounded-xl p-4 flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-sm text-gold flex-shrink-0">{(ancestor.full_name || '?').charAt(0)}</div>
          <div className="flex-1 min-w-0">
            <Link to={`/ancestor/${ancestor.id}`} className="text-sm text-parchment hover:text-gold truncate block">{ancestor.full_name}</Link>
            <div className="flex items-center gap-2 text-xs text-parchment/40 mt-0.5">
              {ancestor.birth_date && <span>b. {new Date(ancestor.birth_date).getFullYear()}</span>}
              {ancestor.birth_place && <span>· {ancestor.birth_place}</span>}
              <span className={`px-1.5 py-0.5 rounded-full border ${ancestor.review_status === 'staged' ? 'bg-[rgba(201,145,58,0.08)] text-amber-light/80 border-[rgba(201,145,58,0.15)]' : 'bg-[rgba(245,236,215,0.05)] text-parchment/50 border-[rgba(245,236,215,0.1)]'}`}>{ancestor.review_status || 'auto_approved'}</span>
            </div>
          </div>
          <button onClick={() => setConnectTarget(ancestor)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9913A] text-charcoal text-xs font-semibold hover:opacity-90 transition-opacity">
            <Network size={13} /> Connect
          </button>
        </div>
      ))}
      {connectTarget && (
        <VerifyConnectDialog ancestor={connectTarget} onClose={() => setConnectTarget(null)} onVerified={handleVerified} />
      )}
    </div>
  );
}