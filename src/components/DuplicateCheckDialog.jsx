import React, { useState } from 'react';
import { AlertTriangle, X, Copy, Trash2, Flag, Loader2, ExternalLink, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function DuplicateCheckDialog({ duplicates, newItemId, newItemTitle, user, onClose, onRemoved }) {
  const [actionLoading, setActionLoading] = useState(false);
  const [doneAction, setDoneAction] = useState(null); // 'conflict' | 'removed'

  const handleRaiseConflict = async () => {
    setActionLoading(true);
    try {
      for (const dup of duplicates) {
        await base44.entities.ConflictFlag.create({
          content_item_id: newItemId,
          field_name: 'duplicate_upload',
          flag_type: 'duplicate_upload',
          duplicate_of_content_item_id: dup.content_item_id,
          duplicate_of_content_item_title: dup.title,
          duplicate_confidence: dup.confidence,
          raised_by_id: user?.id || null,
          raised_by_name: user?.full_name || user?.email || 'Family Member',
          dispute_description: `This upload may be a duplicate of an existing item: "${dup.title}". AI confidence: ${Math.round(dup.confidence * 100)}%. Reason: ${dup.reason}`,
          status: 'open',
        }).catch(() => {});
      }
      setDoneAction('conflict');
    } catch (e) {
      setActionLoading(false);
    }
    setActionLoading(false);
  };

  const handleRemoveUpload = async () => {
    setActionLoading(true);
    try {
      await base44.entities.ContentItem.delete(newItemId);
      setDoneAction('removed');
    } catch (e) {
      setActionLoading(false);
    }
    setActionLoading(false);
  };

  const handleClose = () => {
    if (doneAction === 'removed') {
      onRemoved?.();
    } else {
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={handleClose}>
      <div className="aged-card rounded-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-light" />
            <h3 className="font-display text-lg text-parchment">Possible Duplicate Detected</h3>
          </div>
          <button onClick={handleClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        {doneAction ? (
          /* Confirmation view */
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-gold" />
            </div>
            <p className="font-display text-xl text-parchment mb-2">
              {doneAction === 'conflict' ? 'Conflict Raised with Admin' : 'Upload Removed'}
            </p>
            <p className="text-parchment/50 text-sm mb-6">
              {doneAction === 'conflict'
                ? 'An administrator will review the duplicate and decide which copy to keep.'
                : 'Your upload has been removed from the archive to avoid duplication.'}
            </p>
            <button onClick={handleClose} className="px-5 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="px-5 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-parchment/60">
                Your upload <span className="text-amber-light font-medium">"{newItemTitle}"</span> appears similar to {duplicates.length === 1 ? 'an existing item' : `${duplicates.length} existing items`} in the archive tagged to the same ancestor(s). Please review and choose how to proceed.
              </p>

              {duplicates.map((dup, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)]">
                  <div className="flex items-start gap-3">
                    <Copy size={18} className="text-amber-light flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm text-parchment font-medium truncate">{dup.title}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${dup.confidence >= 0.8 ? 'bg-red-500/10 text-red-300' : 'bg-[rgba(201,145,58,0.1)] text-amber-light'}`}>
                          {Math.round(dup.confidence * 100)}% match
                        </span>
                      </div>
                      <p className="text-xs text-parchment/40 leading-relaxed">{dup.reason}</p>
                      <a href={`/content/${dup.content_item_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-amber-light hover:text-gold transition-colors">
                        <ExternalLink size={12} /> View existing item
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer — Actions */}
            <div className="px-5 py-4 border-t border-[rgba(201,145,58,0.2)] space-y-2">
              <button
                onClick={handleRaiseConflict}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Flag size={18} />}
                Raise Conflict with Admin
              </button>
              <button
                onClick={handleRemoveUpload}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-500/30 text-red-300 text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} /> Remove My Upload
              </button>
              <button
                onClick={handleClose}
                disabled={actionLoading}
                className="w-full py-2.5 rounded-lg text-sm text-parchment/50 hover:text-parchment transition-colors"
              >
                Keep — This is not a duplicate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}