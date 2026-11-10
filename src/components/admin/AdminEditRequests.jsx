import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, CheckCircle, XCircle, ExternalLink, Loader2, ChevronDown, ChevronUp, FileSearch } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SourceDocumentDialog from '@/components/SourceDocumentDialog';

export default function AdminEditRequests({ scope }) {
  const [sourceId, setSourceId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [reviewNote, setReviewNote] = useState({});
  const [processing, setProcessing] = useState({});

  const inScope = (r) => !scope || (scope.contentItemIds && scope.contentItemIds.has(r.content_item_id));

  const loadRequests = () => {
    setLoading(true);
    base44.entities.EditRequest.filter({ status: 'pending' }, '-created_date', 50)
      .then(reqs => setRequests((reqs || []).filter(inScope)))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRequests(); }, []);

  const handleApprove = async (req) => {
    setProcessing(prev => ({ ...prev, [req.id]: 'approving' }));
    try {
      const admin = await base44.auth.me().catch(() => null);
      // Apply the proposed changes to the ContentItem
      await base44.entities.ContentItem.update(req.content_item_id, req.proposed_changes);
      // Mark the edit request as approved
      await base44.entities.EditRequest.update(req.id, {
        status: 'approved',
        reviewed_by_id: admin?.id || null,
        reviewed_by_name: admin?.full_name || admin?.email || 'Admin',
        review_note: reviewNote[req.id] || 'Approved and applied by admin',
      });
      setRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e) {}
    setProcessing(prev => ({ ...prev, [req.id]: null }));
  };

  const handleReject = async (req) => {
    setProcessing(prev => ({ ...prev, [req.id]: 'rejecting' }));
    try {
      const admin = await base44.auth.me().catch(() => null);
      await base44.entities.EditRequest.update(req.id, {
        status: 'rejected',
        reviewed_by_id: admin?.id || null,
        reviewed_by_name: admin?.full_name || admin?.email || 'Admin',
        review_note: reviewNote[req.id] || 'Rejected by admin',
      });
      setRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e) {}
    setProcessing(prev => ({ ...prev, [req.id]: null }));
  };

  const renderDiff = (key, oldVal, newVal) => {
    const oldStr = oldVal ? (typeof oldVal === 'object' ? JSON.stringify(oldVal, null, 2) : String(oldVal)) : '—';
    const newStr = newVal ? (typeof newVal === 'object' ? JSON.stringify(newVal, null, 2) : String(newVal)) : '—';
    const changed = oldStr !== newStr;
    return (
      <div key={key} className={`rounded-lg p-3 ${changed ? 'border border-[rgba(201,145,58,0.25)] bg-[rgba(201,145,58,0.04)]' : 'border border-[rgba(245,236,215,0.06)]'}`}>
        <p className="text-xs text-parchment/40 capitalize mb-1.5">{key.replace(/_/g, ' ')}{changed && <span className="text-amber-light ml-1">• changed</span>}</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-parchment/30 uppercase mb-0.5">Before</p>
            <p className={`text-xs ${changed ? 'text-red-300/70 line-through' : 'text-parchment/50'} whitespace-pre-wrap break-words`}>{oldStr}</p>
          </div>
          <div>
            <p className="text-[10px] text-parchment/30 uppercase mb-0.5">After</p>
            <p className={`text-xs ${changed ? 'text-green-300/90' : 'text-parchment/50'} whitespace-pre-wrap break-words`}>{newStr}</p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="aged-card rounded-lg h-20 animate-pulse" />)}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Edit3 size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50">No edit requests awaiting review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map(req => {
        const isExpanded = expandedId === req.id;
        const proposed = req.proposed_changes || {};
        const original = req.original_values || {};
        const allKeys = [...new Set([...Object.keys(proposed), ...Object.keys(original)])];
        return (
          <div key={req.id} className="aged-card rounded-xl p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Edit3 size={18} className="text-amber-light flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-parchment truncate">{req.content_item_title || 'Untitled'}</h3>
                  <div className="flex items-center gap-2 text-xs text-parchment/40 mt-0.5">
                    <span>Requested by <span className="text-amber-light/70">{req.requested_by_name || 'Unknown'}</span></span>
                    {req.created_date && <span>· {new Date(req.created_date).toLocaleString('en-AU')}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setSourceId(req.content_item_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs hover:border-[rgba(201,145,58,0.4)] transition-colors flex-shrink-0">
                <FileSearch size={14} /> Source document
              </button>
              <Link to={`/content/${req.content_item_id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)] text-amber-light/80 text-xs hover:border-[rgba(201,145,58,0.35)] transition-colors flex-shrink-0">
                <ExternalLink size={14} /> View
              </Link>
            </div>

            {req.reason && (
              <p className="text-xs text-parchment/50 mb-3 bg-[rgba(201,145,58,0.04)] rounded-lg px-3 py-2 border border-[rgba(201,145,58,0.1)]">
                <span className="text-amber-light/70">Reason: </span>{req.reason}
              </p>
            )}

            {/* Summary of changed fields */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {allKeys.map(k => (
                <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/70 border border-[rgba(201,145,58,0.12)] capitalize">
                  {k.replace(/_/g, ' ')}
                </span>
              ))}
            </div>

            {/* Expandable diff */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : req.id)}
              className="flex items-center gap-1 text-xs text-amber-light/60 hover:text-amber-light transition-colors mb-2"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {isExpanded ? 'Hide' : 'Show'} changes detail
            </button>
            {isExpanded && (
              <div className="space-y-2 mb-3">
                {allKeys.map(k => renderDiff(k, original[k], proposed[k]))}
              </div>
            )}

            {/* Review note */}
            <input
              value={reviewNote[req.id] || ''}
              onChange={e => setReviewNote(prev => ({ ...prev, [req.id]: e.target.value }))}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] mb-3"
              placeholder="Admin note (optional)..."
            />

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(req)}
                disabled={processing[req.id]}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors disabled:opacity-50"
              >
                {processing[req.id] === 'approving' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Approve & Apply
              </button>
              <button
                onClick={() => handleReject(req)}
                disabled={processing[req.id]}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[rgba(245,236,215,0.05)] text-parchment/50 text-xs border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.08)] transition-colors disabled:opacity-50"
              >
                {processing[req.id] === 'rejecting' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Reject
              </button>
            </div>
          </div>
        );
      })}

      {sourceId && <SourceDocumentDialog itemId={sourceId} onClose={() => setSourceId(null)} />}
    </div>
  );
}