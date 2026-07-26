import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// For a female ancestor, her maiden_name is the surname of the branch she was
// born into. This finds the Branch whose name matches that surname and renders
// a link so a married-in ancestor connects back to her own family's branch.
function surnameOf(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

export default function BirthBranchLink({ maidenName, currentBranchId }) {
  const [branch, setBranch] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const surname = surnameOf(maidenName);
    if (!surname) { setChecked(true); return; }
    base44.entities.Branch.list()
      .then((branches) => {
        if (cancelled) return;
        const token = surname.toLowerCase();
        // Match a branch whose name starts with the maiden surname token
        // (e.g. "Freddi Bloodline — Original Branch" for maiden name "Freddi"),
        // skipping the branch this ancestor already married into.
        const match = (branches || []).find(b => {
          if (b.id === currentBranchId) return false;
          const bName = (b.name || '').toLowerCase().trim();
          return bName === token || bName.startsWith(token + ' ') || bName.includes(' ' + token + ' ');
        });
        setBranch(match || null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [maidenName, currentBranchId]);

  if (!checked || !branch) return null;

  return (
    <Link
      to={`/branches`}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-[rgba(201,145,58,0.3)] bg-[rgba(201,145,58,0.06)] text-amber-light hover:bg-[rgba(201,145,58,0.12)] transition-colors"
    >
      <GitBranch size={12} />
      Born into the {branch.name}
    </Link>
  );
}