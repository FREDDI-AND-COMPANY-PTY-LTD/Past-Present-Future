import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const STORAGE_PREFIX = 'freddi_branch_root_id';
const ROOT_CHANGE_EVENT = 'freddi:branch-root-change';

function storageKey(userId) {
  return userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX;
}

// Surname = last whitespace-delimited token of a full name, uppercased to
// match the archival birth-certificate convention used across the app.
function surnameOf(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1].toUpperCase() : '';
}

/**
 * Resolves the active branch root ancestor and computes the set of
 * descendant ancestor IDs (blood descendants + partners married in).
 *
 * Resolution order:
 *   1. Per-user localStorage selection (set via the Branches page).
 *   2. The branch the current user admins whose root ancestor shares their
 *      surname (so "Jason Lewis FREDDI" lands on the Freddi bloodline, not the
 *      Lewis bloodline he also admins).
 *   3. The first branch the current user admins.
 *   4. The "Freddi Bloodline — Original Branch" by name.
 *   5. The ancestor named "Alfredo Freddi".
 *
 * The selection is reactive: setting it on one page (e.g. Branches) immediately
 * recomputes every other mounted instance (e.g. the Layout sidebar) via a
 * window event, and syncs across tabs via the storage event.
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
      const [branches, allAncestors, me] = await Promise.all([
        base44.entities.Branch.filter({}),
        base44.entities.Ancestor.list(),
        base44.auth.me().catch(() => null),
      ]);

      const userSurname = surnameOf(me?.full_name);
      let rootId = me?.id ? localStorage.getItem(storageKey(me.id)) : null;

      // Fall back to the user's own admin branch whose root ancestor shares
      // their surname (e.g. Freddi → Freddi Bloodline).
      if (!rootId && me?.id) {
        const myAdminBranches = (branches || []).filter(b => b.admin_user_id === me.id && b.ancestor_id);
        const surnameMatch = myAdminBranches.find(b => {
          const anc = allAncestors.find(a => a.id === b.ancestor_id);
          return anc && surnameOf(anc.full_name) === userSurname;
        });
        if (surnameMatch) rootId = surnameMatch.ancestor_id;
        // Else the first branch the user admins
        if (!rootId && myAdminBranches.length > 0) rootId = myAdminBranches[0].ancestor_id;
      }

      // Fall back to the original Freddi bloodline branch by name
      if (!rootId) {
        const rootBranch = (branches || []).find(b =>
          (b.name || '').toLowerCase().includes('freddi bloodline') ||
          (b.name || '').toLowerCase().includes('original branch')
        );
        rootId = rootBranch?.ancestor_id;
      }

      // Fall back to Alfredo Freddi by name
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
    // React to root changes from other hook instances in this tab
    const onChange = () => compute();
    window.addEventListener(ROOT_CHANGE_EVENT, onChange);
    // Sync across tabs
    const onStorage = (e) => { if (e.key && e.key.startsWith(STORAGE_PREFIX)) compute(); };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ROOT_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [compute]);

  const setBranchRoot = useCallback((ancestorId) => {
    base44.auth.me().then(me => {
      const key = me?.id ? storageKey(me.id) : STORAGE_PREFIX;
      if (ancestorId) {
        localStorage.setItem(key, ancestorId);
      } else {
        localStorage.removeItem(key);
      }
      // Notify other mounted instances in this tab
      window.dispatchEvent(new Event(ROOT_CHANGE_EVENT));
      compute();
    }).catch(() => {
      if (ancestorId) localStorage.setItem(STORAGE_PREFIX, ancestorId);
      window.dispatchEvent(new Event(ROOT_CHANGE_EVENT));
      compute();
    });
  }, [compute]);

  return { rootAncestorId, rootAncestor, descendantIds, parentAncestors, loading, setBranchRoot };
}