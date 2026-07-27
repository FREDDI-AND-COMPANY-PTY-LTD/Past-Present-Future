import React, { useState, useEffect } from 'react';
import { Network, Loader2, Check, X, User, Users, Heart, FileText, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AdminFamilyLinks({ refreshKey }) {
  const [links, setLinks] = useState([]);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allLinks, allAncestors] = await Promise.all([
        base44.entities.FamilyLink.list('-created_date', 50),
        base44.entities.Ancestor.list(),
      ]);
      // Show pending and approved first, then integrated
      const sorted = (allLinks || []).sort((a, b) => {
        const order = { pending: 0, approved: 1, rejected: 2, integrated: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });
      setLinks(sorted);
      setAncestors(allAncestors || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [refreshKey]);

  const getAncestor = (id) => ancestors.find(a => a.id === id);

  const handleIntegrate = async (linkId) => {
    setActioning(linkId);
    try {
      await base44.functions.invoke('integrateFamilyLink', { family_link_id: linkId });
      await loadData();
    } catch (e) {}
    setActioning(null);
  };

  const handleReject = async (linkId) => {
    setActioning(linkId);
    try {
      await base44.entities.FamilyLink.update(linkId, {
        status: 'rejected',
      });
      await loadData();
    } catch (e) {}
    setActioning(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="text-gold animate-spin" />
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Network size={32} className="text-gold/40 mx-auto mb-3" />
        <p className="text-parchment/50 text-sm">No family links extracted yet. They appear here automatically when certificates are uploaded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="aged-card rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-gold flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-parchment font-medium">How Family Links Work</p>
          <p className="text-xs text-parchment/50 mt-1">When a certificate is uploaded, the app extracts names (subject, mother, father, spouse) and creates placeholder ancestors for anyone not already in the archive. These relationships are staged here until you approve them — only then do they appear in the family tree, migration map, and timeline.</p>
        </div>
      </div>

      {links.map(link => {
        const subject = getAncestor(link.subject_ancestor_id);
        const mother = getAncestor(link.mother_ancestor_id);
        const father = getAncestor(link.father_ancestor_id);
        const partner = getAncestor(link.partner_ancestor_id);
        const isPending = link.status === 'pending';
        const isIntegrated = link.status === 'integrated';
        const isRejected = link.status === 'rejected';

        return (
          <div key={link.id} className={`aged-card rounded-xl p-5 ${isIntegrated ? 'opacity-60' : ''} ${isRejected ? 'opacity-40' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-gold" />
                <div>
                  <p className="text-sm text-parchment font-medium">{link.content_item_title}</p>
                  <p className="text-xs text-parchment/40">
                    {link.document_subtype ? link.document_subtype.replace(/_/g, ' ') : 'Certificate'}
                    {link.created_by_name && ` · extracted by ${link.created_by_name}`}
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                isPending ? 'bg-[rgba(201,145,58,0.12)] text-amber-light' :
                isIntegrated ? 'bg-green-500/10 text-green-300' :
                isRejected ? 'bg-red-500/10 text-red-300' :
                'bg-[rgba(245,236,215,0.05)] text-parchment/50'
              }`}>
                {link.status}
              </span>
            </div>

            {/* Relationship diagram */}
            <div className="space-y-3 mb-4">
              {/* Parents row */}
              {(mother || father) && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-parchment/40 uppercase tracking-wider w-20">Mother & Father</span>
                  {father && (
                    <AncestorChip ancestor={father} isNew={link.father_is_new} label="Father" name={link.father_name} />
                  )}
                  {mother && (
                    <AncestorChip ancestor={mother} isNew={link.mother_is_new} label="Mother" name={link.mother_name} />
                  )}
                </div>
              )}
              {/* Subject row */}
              {subject && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-parchment/40 uppercase tracking-wider w-16">Subject</span>
                  <AncestorChip ancestor={subject} isNew={link.subject_is_new} label="Subject" name={link.subject_name} highlight />
                </div>
              )}
              {/* Partner row */}
              {partner && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-parchment/40 uppercase tracking-wider w-20">Husband / Wife</span>
                  <AncestorChip ancestor={partner} isNew={link.partner_is_new} label="Husband / Wife" name={link.partner_name} />
                </div>
              )}
            </div>

            {/* Extracted data summary */}
            {link.extracted_data && Object.keys(link.extracted_data).length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
                <p className="text-xs text-parchment/40 uppercase tracking-wider mb-2">Extracted Certificate Data</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(link.extracted_data)
                    .filter(([, v]) => v && String(v).trim())
                    .slice(0, 9)
                    .map(([k, v]) => (
                      <div key={k}>
                        <span className="text-xs text-parchment/30 capitalize">{k.replace(/_/g, ' ')}: </span>
                        <span className="text-xs text-parchment/60">{String(v)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {isPending && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleIntegrate(link.id)}
                  disabled={actioning === link.id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-500 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {actioning === link.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Approve & Integrate into Tree
                </button>
                <button
                  onClick={() => handleReject(link.id)}
                  disabled={actioning === link.id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[rgba(245,236,215,0.15)] text-parchment/60 text-sm hover:bg-[rgba(245,236,215,0.05)] hover:text-parchment transition-colors"
                >
                  <X size={14} /> Reject
                </button>
              </div>
            )}
            {isIntegrated && link.reviewed_by_name && (
              <p className="text-xs text-green-300/60">Integrated by {link.reviewed_by_name}</p>
            )}
            {isRejected && (
              <p className="text-xs text-red-300/60">Rejected — relationships not applied</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AncestorChip({ ancestor, isNew, label, highlight }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
      highlight ? 'border-[#C9913A] bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.15)] bg-[#0D0B0A]'
    }`}>
      <div className="w-7 h-7 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-xs text-gold font-medium flex-shrink-0">
        {ancestor?.full_name?.charAt(0) || '?'}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-parchment truncate">{ancestor?.full_name || 'Unknown'}</p>
        <p className="text-xs text-parchment/40">{label}{isNew && ' · new placeholder'}</p>
      </div>
      {isNew && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[rgba(201,145,58,0.15)] text-amber-light">NEW</span>
      )}
    </div>
  );
}