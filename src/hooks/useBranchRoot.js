import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const STORAGE_KEY = 'freddi_branch_root_id';

/**
 * Resolves the active branch root ancestor and computes the set of
 * descendant ancestor IDs (blood descendants + partners married in).
 *
 * The root is read from localStorage (set via the Branches page).
 * Falls back to the "Freddi Bloodline — Original Branch" if nothing selected.
 */
export function useBranchRoot() {
  const [rootAncestorId, setRootAncestorId] = useState(null);
  const [rootAncestor, setRootAncestor] = useState(null);
  const [descendantIds, setDescendantIds] = useState(new Set());
  const [parentAncestors, setParentAncestors] = useState([]);
  const [loading, setLoading] = useState(true);

  const compute = useCallback(async () => {
    setLoading(true);
    try {
      const [branches, allAncestors] = await Promise.all([
        base44.entities.Branch.filter({}),
        base44.entities.Ancestor.list(),
      ]);

      // 1. Check localStorage for a user-selected root
      let rootId = localStorage.getItem(STORAGE_KEY);

      // 2. Fall back to the original bloodline branch
      if (!rootId) {
        const rootBranch = (branches || []).find(b =>
          (b.name || '').toLowerCase().includes('bloodline') ||
          (b.name || '').toLowerCase().includes('original branch')
        );
        rootId = rootBranch?.ancestor_id;
      }

      // 3. Fall back to Alfredo Freddi by name
      let rootAnc = allAncestors.find(a => a.id === rootId);
      if (!rootAnc) {
        rootAnc = allAncestors.find(a =>
          (a.full_name || '').toLowerCase().includes('alfredo')
        );
        rootId = rootAnc?.id;
      }

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

      // Include the root's parents (senior line) — enables one-click switch to a more senior branch
      const parentIds = [rootAnc?.mother_id, rootAnc?.father_id].filter(Boolean);
      parentIds.forEach(pid => idSet.add(pid));

      setParentAncestors(parentIds.map(pid => allAncestors.find(a => a.id === pid)).filter(Boolean));
      setDescendantIds(idSet);
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    compute();
  }, [compute]);

  const setBranchRoot = useCallback((ancestorId) => {
    if (ancestorId) {
      localStorage.setItem(STORAGE_KEY, ancestorId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    compute();
  }, [compute]);

  return { rootAncestorId, rootAncestor, descendantIds, parentAncestors, loading, setBranchRoot };
}