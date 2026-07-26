import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, CheckCircle, XCircle, ExternalLink, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// A proposal is auto-applicable when it targets a concrete ancestor/content
// record by id with simple field:value changes (incl. linking an EXISTING
// ancestor id). Relationship proposals that need a new ancestor are manual.
const AUTO_APPLICABLE = (p) =>
  (p.target_type === 'ancestor' || p.target_type === 'content_item') &&
  !!p.target_id &&
  p.proposal_type === 'field_change';

export default function AdminProposals({ refreshKey }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [reviewNote, setReviewNote] = useState({});
  const [processing, setProcessing] = useState({});

  const load = () => {
    setLoading(true);
    base44.entities.Proposal.filter({ status: 'pending' }, '-created_date', 50)
      .then((r) => setProposals(r || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [refreshKey]);

  const adminMeta = async () => {
    const admin = await base44.auth.me().catch(() => null);
    return {
      reviewed_by_id: admin?.id || null,
      reviewed_by_name: admin?.full_name || admin?.email || 'Admin',
    };
  };

  const handleApply = async (p) => {
    setProcessing((prev) => ({ ...prev, [p.id]: 'applying' }));
    try {
      const meta = await adminMeta();
      const entity = p.target_type === 'ancestor' ? base44.entities.Ancestor : base44.entities.ContentItem;
      await entity.update(p.target_id, p.proposed_changes || {});
      await base44.entities.Proposal.update(p.id, {
        status: 'applied',
        review_note: reviewNote[p.id] || 'Approved and auto-applied by admin',
        ...meta,
      });
      setProposals((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {}
    setProcessing((prev) => ({ ...prev, [p.id]: null }));
  };

  const handleApprove = async (p) => {
    setProcessing((prev) => ({ ...prev, [p.id]: 'approving' }));
    try {
      const meta = await adminMeta();
      await base44.entities.Proposal.update(p.id, {
        status: 'approved',
        review_note: reviewNote[p.id] || 'Approved by admin (apply manually)',
        ...meta,
      });
      setProposals((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {}
    setProcessing((prev) => ({ ...prev, [p.id]: null }));
  };

  const handleReject = async (p) => {
    setProcessing((prev) => ({ ...prev, [p.id]: 'rejecting' }));
    try {
      const meta = await adminMeta();
      await base44.entities.Proposal.update(p.id, {
        status: 'rejected',
        review_note: reviewNote[p.id] || 'Rejected by admin',
        ...meta,
      });
      setProposals((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {}
    setProcessing((prev) => ({ ...prev, [p.id]: null }));
  };

  const renderChanges = (changes) =>
    Object.entries(changes || {}).map(([k, v]) => (
      <div key={k} className="rounded-lg p-3 border border-[rgba(201,145,58,0.2)] bg-[rgba(201,145,58,0.04)]">
        <p className="text-xs text-parchment/40 capitalize mb-1">{k.replace(/_/g, ' ')}</p>
        <p className="text-xs text-green-300/90 whitespace-pre-wrap break-words">
          {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
        </p>
      </div>
    ));

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="aged-card rounded-lg h-20 animate-pulse" />)}</div>;
  }
  if (!proposals.length) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Lightbulb size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50">No proposals awaiting approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {proposals.map((p) => {
        const isExpanded = expandedId === p.id;
        const auto = AUTO_APPLICABLE(p);
        return (
          <div key={p.id} className="aged-card rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {p.source === 'ai_assistant' ? <Sparkles size={18} className="text-amber-light flex-shrink-0" /> : <Lightbulb size={18} className="text-amber-light flex-shrink-0" />}
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-parchment truncate">{p.summary}</h3>
                  <div className="flex items-center gap-2 text-xs text-parchment/40 mt-0.5 flex-wrap">
                    <span>Proposed by <span className="text-amber-light/70">{p.proposed_by_name || 'Family Member'}</span></span>
                    {p.target_label && <span>· {p.target_label}</span>}
                    {p.created_date && <span>· {new Date(p.created_date).toLocaleString('en-AU')}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {p.action_path && (
                  <Link to={p.action_path} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)] text-amber-light/80 text-xs hover:border-[rgba(201,145,58,0.35)] transition-colors">
                    <ExternalLink size={14} /> Target
                  </Link>
                )}
                <Link to={`/proposal/${p.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)] text-amber-light/80 text-xs hover:border-[rgba(201,145,58,0.35)] transition-colors">
                  <ExternalLink size={14} /> Link
                </Link>
              </div>
            </div>

            {p.reason && (
              <p className="text-xs text-parchment/50 mb-3 bg-[rgba(201,145,58,0.04)] rounded-lg px-3 py-2 border border-[rgba(201,145,58,0.1)]">
                <span className="text-amber-light/70">Reason: </span>{p.reason}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/70 border border-[rgba(201,145,58,0.12)] capitalize">{(p.proposal_type || 'field change').replace(/_/g, ' ')}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/70 border border-[rgba(201,145,58,0.12)] capitalize">{(p.target_type || 'other').replace(/_/g, ' ')}</span>
              {p.source === 'ai_assistant' && <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/70 border border-[rgba(201,145,58,0.12)]">via AI assistant</span>}
            </div>

            <button onClick={() => setExpandedId(isExpanded ? null : p.id)} className="flex items-center gap-1 text-xs text-amber-light/60 hover:text-amber-light transition-colors mb-2">
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {isExpanded ? 'Hide' : 'Show'} proposed changes
            </button>
            {isExpanded && <div className="space-y-2 mb-3">{renderChanges(p.proposed_changes)}</div>}

            <input
              value={reviewNote[p.id] || ''}
              onChange={(e) => setReviewNote((prev) => ({ ...prev, [p.id]: e.target.value }))}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] mb-3"
              placeholder="Admin note (optional)..."
            />

            <div className="flex flex-wrap gap-2">
              {auto ? (
                <button onClick={() => handleApply(p)} disabled={processing[p.id]} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors disabled:opacity-50">
                  {processing[p.id] === 'applying' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve & Apply
                </button>
              ) : (
                <button onClick={() => handleApprove(p)} disabled={processing[p.id]} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors disabled:opacity-50">
                  {processing[p.id] === 'approving' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve
                </button>
              )}
              <button onClick={() => handleReject(p)} disabled={processing[p.id]} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[rgba(245,236,215,0.05)] text-parchment/50 text-xs border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.08)] transition-colors disabled:opacity-50">
                {processing[p.id] === 'rejecting' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}