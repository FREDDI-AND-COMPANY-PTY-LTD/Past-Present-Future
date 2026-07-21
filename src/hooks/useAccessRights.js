import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Determines the current user's interaction rights under the branch-admin model.
//   admin        — global admin (bypasses branch gating)
//   branch_admin — admin_user_id on at least one Branch
//   approved     — holds an approved BranchInvite
//   pending      — has a pending/nominated invite, not yet approved
//   none         — no branch relationship
// canInteract is true for admin, branch_admin, and approved members.
export function useAccessRights() {
  const [state, setState] = useState({ status: 'loading', canInteract: false, approvedBranchIds: [], isBranchAdmin: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me().catch(() => null);
        if (!user) {
          if (!cancelled) setState({ status: 'none', canInteract: false, approvedBranchIds: [], isBranchAdmin: false });
          return;
        }
        const [branches, invites] = await Promise.all([
          base44.entities.Branch.list().catch(() => []),
          base44.entities.BranchInvite.list('-created_date', 200).catch(() => []),
        ]);
        if (cancelled) return;

        const email = (user.email || '').toLowerCase();
        const isAdmin = user.role === 'admin';
        const isBranchAdmin = (branches || []).some(b => b.admin_user_id && b.admin_user_id === user.id);
        const mine = (invites || []).filter(i => (i.invitee_email || '').toLowerCase() === email);
        const approvedBranchIds = mine.filter(i => i.status === 'approved').map(i => i.branch_id);
        const hasApproved = approvedBranchIds.length > 0;
        const hasPending = mine.some(i => i.status === 'pending' || i.status === 'nominated');

        let status, canInteract;
        if (isAdmin) { status = 'admin'; canInteract = true; }
        else if (isBranchAdmin) { status = 'branch_admin'; canInteract = true; }
        else if (hasApproved) { status = 'approved'; canInteract = true; }
        else if (hasPending) { status = 'pending'; canInteract = false; }
        else { status = 'none'; canInteract = false; }

        setState({ status, canInteract, approvedBranchIds, isBranchAdmin });
      } catch (e) {
        if (!cancelled) setState({ status: 'none', canInteract: false, approvedBranchIds: [], isBranchAdmin: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}