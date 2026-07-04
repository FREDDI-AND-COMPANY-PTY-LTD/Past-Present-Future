import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Resolves the "Freddi Bloodline — Original Branch" and computes the set of
 * descendant ancestor IDs starting from its root ancestor (Alfredo Freddi).
 * Includes blood descendants and partners married into the line.
 */
export function useBranchRoot() {
  const [rootAncestorId, setRootAncestorId] = useState(null);
  const [rootAncestor, setRootAncestor] = useState(null);
  const [descendantIds, setDescendantIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [branches, allAncestors] = await Promise.all([
          base44.entities.Branch.filter({}),
          base44.entities.Ancestor.list(),
        ]);

        const rootBranch = (branches || []).find(b =>
          (b.name || '').toLowerCase().includes('bloodline') ||
          (b.name || '').toLowerCase().includes('original branch')
        );
        let rootId = rootBranch?.ancestor_id;
        let rootAnc = allAncestors.find(a => a.id === rootId);

        // Fallback: find Alfredo Freddi by name
        if (!rootAnc) {
          rootAnc = allAncestors.find(a =>
            (a.full_name || '').toLowerCase().includes('alfredo')
          );
          rootId = rootAnc?.id;
        }

        if (cancelled) return;
        if (!rootId) { setLoading(false); return; }

        setRootAncestorId(rootId);
        setRootAncestor(rootAnc);

        // BFS: collect all blood descendants
        const idSet = new Set([rootId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const a of allAncestors) {
            if (idSet.has(a.id)) continue;
            if ((a.mother_id && idSet.has(a.mother_id)) ||
                (a.father_id && idSet.has(a.father_id))) {
              idSet.add(a.id);
              changed = true;
            }
          }
        }

        // Add partners married into the bloodline
        for (const a of allAncestors) {
          if (idSet.has(a.id) && a.partner_id) {
            idSet.add(a.partner_id);
          }
        }

        if (cancelled) return;
        setDescendantIds(idSet);
      } catch (e) {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { rootAncestorId, rootAncestor, descendantIds, loading };
}