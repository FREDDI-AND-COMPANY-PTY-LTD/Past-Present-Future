import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Lightbulb, CheckCircle, XCircle, ExternalLink, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';

const AUTO_APPLICABLE = (p) =>
  (p.target_type === 'ancestor' || p.target_type === 'content_item') &&
  !!p.target_id &&
  p.proposal_type === 'field_change';

const RELATIONSHIP_APPLICABLE = (p) =>
  p.target_type === 'ancestor' &&
  !!p.target_id &&
  p.proposal_type === 'relationship' &&
  !!(p.proposed_changes && (p.proposed_changes.new_mother || p.proposed_changes.new_father || p.proposed_changes.new_partner));

const STATUS_STYLES = {
  pending: 'bg-[rgba(201,145,58,0.08)] text-amber-light border-[rgba(201,145,58,0.2)]',
  approved: 'bg-green-900/20 text-green-400 border-green-800/30',
  applied: 'bg-green-900/20 text-green-400 border-green-800/30',
  rejected: 'bg-[rgba(245,236,215,0.05)] text-parchment/50 border-[rgba(245,236,215,0.1)]',
};

export default function ProposalDetail() {
  const { id } = useParams();
  const [proposal, setProposal] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Proposal.get(id).then(setProposal).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const isAdmin = user?.role === 'admin';
  const auto = proposal && AUTO_APPLICABLE(proposal);
  const relationship = proposal && RELATIONSHIP_APPLICABLE(proposal);

  const act = async (status, apply = false) => {
    setProcessing(true);
    try {
      const admin = await base44.auth.me().catch(() => null);
      const meta = { reviewed_by_id: admin?.id || null, reviewed_by_name: admin?.full_name || admin?.email || 'Admin' };
      if (apply && auto) {
        const entity = proposal.target_type === 'ancestor' ? base44.entities.Ancestor : base44.entities.ContentItem;
        await entity.update(proposal.target_id, proposal.proposed_changes || {});
      } else if (apply && relationship) {
        await base44.functions.invoke('applyRelationshipProposal', { proposal_id: id, review_note: reviewNote || '' });
      }
      await base44.entities.Proposal.update(id, { status, review_note: reviewNote || '', ...meta });
      setProposal((prev) => ({ ...prev, status, review_note: reviewNote }));
      setDone(status);
    } catch (e) {}
    setProcessing(false);
  };

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-amber-light/70 hover:text-amber-light mb-6">
          <ArrowLeft size={16} /> Back to Admin Dashboard
        </Link>

        {loading ? (
          <div className="aged-card rounded-xl h-40 animate-pulse" />
        ) : !proposal ? (
          <div className="aged-card rounded-xl p-12 text-center">
            <Lightbulb size={32} className="text-gold/30 mx-auto mb-3" />
            <p className="text-parchment/50">Proposal not found.</p>
          </div>
        ) : (
          <div className="aged-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              {proposal.source === 'ai_assistant' ? <Sparkles size={20} className="text-amber-light" /> : <Lightbulb size={20} className="text-amber-light" />}
              <h1 className="font-display text-2xl text-parchment">{proposal.summary}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-parchment/40 mb-4">
              <span>Proposed by <span className="text-amber-light/70">{proposal.proposed_by_name || 'Family Member'}</span></span>
              {proposal.target_label && <span>· {proposal.target_label}</span>}
              {proposal.created_date && <span>· {new Date(proposal.created_date).toLocaleString('en-AU')}</span>}
              <span className={`px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLES[proposal.status] || STATUS_STYLES.pending}`}>{proposal.status}</span>
            </div>

            {proposal.reason && (
              <p className="text-sm text-parchment/60 mb-4 bg-[rgba(201,145,58,0.04)] rounded-lg px-3 py-2 border border-[rgba(201,145,58,0.1)]">
                <span className="text-amber-light/70">Reason: </span>{proposal.reason}
              </p>
            )}

            {proposal.proposed_changes && Object.keys(proposal.proposed_changes).length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-parchment/40 uppercase mb-2">Proposed changes</p>
                <pre className="text-xs text-green-300/90 bg-[#0D0B0A] rounded-lg p-3 border border-[rgba(201,145,58,0.15)] whitespace-pre-wrap break-words overflow-auto">{JSON.stringify(proposal.proposed_changes, null, 2)}</pre>
              </div>
            )}

            {proposal.action_path && (
              <Link to={proposal.action_path} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)] text-amber-light/80 text-xs hover:border-[rgba(201,145,58,0.35)] transition-colors mb-4">
                <ExternalLink size={14} /> Open target record
              </Link>
            )}

            {done ? (
              <p className="text-sm text-green-400">This proposal has been {done}.</p>
            ) : proposal.status !== 'pending' ? (
              <p className="text-sm text-parchment/50">This proposal has already been {proposal.status}.</p>
            ) : isAdmin ? (
              <>
                <input
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] mb-3"
                  placeholder="Admin note (optional)..."
                />
                <div className="flex flex-wrap gap-2">
                  {auto || relationship ? (
                    <button onClick={() => act('applied', true)} disabled={processing} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-900/20 text-green-400 text-sm border border-green-800/30 hover:bg-green-900/30 transition-colors disabled:opacity-50">
                      {processing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Approve & Apply
                    </button>
                  ) : (
                    <button onClick={() => act('approved')} disabled={processing} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-900/20 text-green-400 text-sm border border-green-800/30 hover:bg-green-900/30 transition-colors disabled:opacity-50">
                      {processing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Approve
                    </button>
                  )}
                  <button onClick={() => act('rejected')} disabled={processing} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(245,236,215,0.05)] text-parchment/60 text-sm border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.08)] transition-colors disabled:opacity-50">
                    {processing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-parchment/50">This proposal is awaiting admin approval. Only the archive admin can approve or reject it.</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}