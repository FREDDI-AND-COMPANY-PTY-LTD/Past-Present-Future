import React from 'react';
import { GitBranch, Globe } from 'lucide-react';

export default function BranchScopeToggle({ value, onChange }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-[rgba(201,145,58,0.2)] bg-[#0D0B0A] p-0.5">
      <button
        onClick={() => onChange('branch')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${value === 'branch' ? 'bg-[rgba(201,145,58,0.15)] text-gold' : 'text-parchment/50 hover:text-amber-light'}`}
      >
        <GitBranch size={13} /> My Branch
      </button>
      <button
        onClick={() => onChange('all')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${value === 'all' ? 'bg-[rgba(201,145,58,0.15)] text-gold' : 'text-parchment/50 hover:text-amber-light'}`}
      >
        <Globe size={13} /> All Branches
      </button>
    </div>
  );
}