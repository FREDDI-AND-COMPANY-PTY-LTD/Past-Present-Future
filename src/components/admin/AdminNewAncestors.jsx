import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AdminNewAncestors({ ancestors, onVerified }) {
  const [local, setLocal] = useState(ancestors);

  useEffect(() => { setLocal(ancestors); }, [ancestors]);

  const verify = async (id) => {
    try {
      await base44.entities.Ancestor.update(id, { review_status: 'admin_verified' });
      setLocal(prev => prev.filter(a => a.id !== id));
      onVerified?.(id);
    } catch (e) {}
  };

  if (!local || local.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Users size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50">No new ancestors awaiting review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {local.map(ancestor => (
        <div key={ancestor.id} className="aged-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-sm text-gold font-medium">
                {ancestor.full_name.charAt(0)}
              </div>
              <div>
                <p className="text-sm text-parchment font-medium">{ancestor.full_name}</p>
                <div className="flex items-center gap-2 text-xs text-parchment/40 mt-0.5">
                  {ancestor.birth_date && <span>b. {new Date(ancestor.birth_date).getFullYear()}</span>}
                  {ancestor.birth_place && <span>· {ancestor.birth_place}</span>}
                  {ancestor.nationality && <span>· {ancestor.nationality}</span>}
                </div>
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full border bg-[rgba(201,145,58,0.08)] text-amber-light border-[rgba(201,145,58,0.2)]">Auto-approved</span>
          </div>
          {ancestor.biography && <p className="text-xs text-parchment/50 mb-3">{ancestor.biography}</p>}
          <div className="flex items-center gap-2 text-xs text-parchment/40 mb-3">
            <UserPlus size={12} />
            Added by <span className="text-amber-light/70">{ancestor.created_by_name || 'Unknown'}</span>
            {ancestor.created_date && <span>· {new Date(ancestor.created_date).toLocaleDateString('en-AU')}</span>}
          </div>
          <div className="flex gap-2">
            <Link to={`/ancestor/${ancestor.id}`} className="px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)] text-amber-light/80 text-xs hover:border-[rgba(201,145,58,0.35)] transition-colors">View Profile</Link>
            <button onClick={() => verify(ancestor.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors">
              <CheckCircle size={14} /> Verify
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}