import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronUp, Link2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LinkRelativeDialog from '@/components/LinkRelativeDialog';
import VerifyConnectDialog from '@/components/admin/VerifyConnectDialog';

// Surfaces ancestors that aren't yet wired into the branch tree, right where a
// family member is already looking for them. Staged ancestors (awaiting admin
// verification) and verified-but-floating ancestors (no parent/partner links,
// not part of the active branch) both appear here with a path to connect them.
export default function FamilyTreeOrphanTray({ ancestors, descendantIds, rootAncestorId }) {
  const [open, setOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [linkTarget, setLinkTarget] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const isAdmin = user?.role === 'admin';
  const staged = (ancestors || []).filter(a => a.review_status === 'staged');
  const unconnected = (ancestors || []).filter(a =>
    a.review_status !== 'staged' &&
    a.id !== rootAncestorId &&
    !descendantIds.has(a.id) &&
    !a.father_id && !a.mother_id && !a.partner_id
  );
  const items = [
    ...staged.map(a => ({ a, kind: 'staged' })),
    ...unconnected.map(a => ({ a, kind: 'unconnected' })),
  ];

  if (items.length === 0) return null;

  return (
    <div className="px-6 lg:px-12 pb-8 max-w-7xl mx-auto">
      <div className="aged-card rounded-xl overflow-hidden">
        <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-[rgba(201,145,58,0.04)] transition-colors">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-light" />
            <span className="font-display text-base text-parchment">Unconnected & Awaiting Review</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.12)] text-amber-light border border-[rgba(201,145,58,0.2)]">{items.length}</span>
          </div>
          {open ? <ChevronUp size={16} className="text-parchment/40" /> : <ChevronDown size={16} className="text-parchment/40" />}
        </button>
        {open && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map(({ a, kind }) => (
              <div key={a.id} className="rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-xs text-gold flex-shrink-0">{(a.full_name || '?').charAt(0)}</div>
                  <span className="text-sm text-parchment truncate">{a.full_name}</span>
                </div>
                <div className="mb-2">
                  {kind === 'staged'
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)]">Awaiting verification</span>
                    : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(245,236,215,0.05)] text-parchment/50 border border-[rgba(245,236,215,0.1)]">Not connected to tree</span>}
                </div>
                <div className="flex items-center gap-2">
                  {kind === 'staged' ? (
                    isAdmin ? (
                      <button onClick={() => setVerifyTarget(a)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#C9913A] text-charcoal text-xs font-semibold hover:opacity-90 transition-opacity">
                        <ShieldCheck size={11} /> Verify & Connect
                      </button>
                    ) : (
                      <Link to="/admin" className="text-xs text-amber-light/70 hover:text-amber-light transition-colors">Admin review →</Link>
                    )
                  ) : (
                    <button onClick={() => setLinkTarget(a)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[rgba(201,145,58,0.25)] text-amber-light text-xs hover:bg-[rgba(201,145,58,0.08)] transition-colors">
                      <Link2 size={11} /> Link Relative
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {linkTarget && (
        <LinkRelativeDialog ancestor={linkTarget} allAncestors={ancestors} onClose={() => setLinkTarget(null)} onSubmitted={() => setLinkTarget(null)} />
      )}
      {verifyTarget && (
        <VerifyConnectDialog ancestor={verifyTarget} onClose={() => setVerifyTarget(null)} onVerified={() => setVerifyTarget(null)} />
      )}
    </div>
  );
}