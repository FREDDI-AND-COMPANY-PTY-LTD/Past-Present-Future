import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AdminEventEditor from '@/components/admin/AdminEventEditor';

export default function AdminIncompleteUploads({ items, onResolved }) {
  const [expandedId, setExpandedId] = useState(null);
  const [localItems, setLocalItems] = useState(items);

  useEffect(() => { setLocalItems(items); }, [items]);

  const resolve = async (id) => {
    try {
      await base44.entities.ContentItem.update(id, { review_status: 'reviewed' });
      setLocalItems(prev => prev.filter(i => i.id !== id));
      onResolved?.(id);
    } catch (e) {}
  };

  if (!localItems || localItems.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <AlertCircle size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50">No incomplete uploads awaiting triage.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localItems.map(item => {
        const isExpanded = expandedId === item.id;
        return (
          <div key={item.id} className="aged-card rounded-xl">
            <div className="p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-light" />
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-[#8B6914]/30 text-amber-light border-[rgba(201,145,58,0.3)]">Incomplete Data</span>
                </div>
                <span className="text-xs text-parchment/40">{item.created_date ? new Date(item.created_date).toLocaleString('en-AU') : ''}</span>
              </div>
              <h3 className="font-display text-lg text-parchment mb-1">{item.title || 'Untitled'}</h3>
              <p className="text-sm text-parchment/50 mb-3">Type: {item.content_type?.replace(/_/g, ' ') || 'uncategorized'}</p>

              <div className="space-y-1 mb-3">
                {!item.ancestor_ids?.length && <p className="text-xs text-red-400/70 flex items-center gap-1.5"><AlertCircle size={12} /> No ancestor tagged</p>}
                {!item.location_name?.trim() && <p className="text-xs text-red-400/70 flex items-center gap-1.5"><AlertCircle size={12} /> No event location provided</p>}
                {!item.date && <p className="text-xs text-red-400/70 flex items-center gap-1.5"><AlertCircle size={12} /> No event date provided</p>}
                {!item.title?.trim() && <p className="text-xs text-red-400/70 flex items-center gap-1.5"><AlertCircle size={12} /> No title/description provided</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] text-amber-light border border-[rgba(201,145,58,0.12)] hover:bg-[rgba(201,145,58,0.12)] transition-colors text-xs font-medium">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {isExpanded ? 'Collapse' : 'Review & Edit'}
                </button>
                <Link to={`/content/${item.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors">
                  <ExternalLink size={14} /> View & Edit
                </Link>
                <button onClick={() => resolve(item.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors">
                  <CheckCircle size={14} /> Mark Reviewed
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-[rgba(201,145,58,0.12)] p-5">
                <AdminEventEditor item={item} onApproved={(id) => { setLocalItems(prev => prev.filter(i => i.id !== id)); setExpandedId(null); onResolved?.(id); }} onDeleted={(id) => { setLocalItems(prev => prev.filter(i => i.id !== id)); setExpandedId(null); onResolved?.(id); }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}