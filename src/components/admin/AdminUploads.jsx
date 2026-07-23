import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Check, Clock, Image, FileText, Newspaper, Award, BookUser, IdCard, Mail, Heart, HelpCircle, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AdminReviewModal from '@/components/admin/AdminReviewModal';
import UndoToast from '@/components/UndoToast';

const typeIcons = {
  photo: Image, story: FileText, press_clipping: Newspaper, certificate: Award,
  narrative: FileText, passport: BookUser, identity_document: IdCard,
  correspondence: Mail, memorial: Heart, video: Image, uncategorized: HelpCircle,
};

const typeLabels = {
  photo: 'Photo', story: 'Story', press_clipping: 'Press', certificate: 'Certificate',
  narrative: 'Narrative', passport: 'Passport', identity_document: 'ID',
  correspondence: 'Correspondence', memorial: 'Memorial', video: 'Video', uncategorized: 'Uncategorized',
};

export default function AdminUploads({ refreshKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [reviewingItem, setReviewingItem] = useState(null);
  const [undoToasts, setUndoToasts] = useState([]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ContentItem.list('-created_date', 50);
      setItems(data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [refreshKey]);

  const markReviewed = async (id) => {
    setUpdating(id);
    const originalItem = items.find(i => i.id === id);
    try {
      await base44.entities.ContentItem.update(id, { review_status: 'reviewed' });
      setItems(prev => prev.map(i => i.id === id ? { ...i, review_status: 'reviewed' } : i));
      if (originalItem) {
        setUndoToasts(prev => [...prev, {
          id: `mark-${id}-${Date.now()}`,
          itemId: id,
          originalStatus: originalItem.review_status,
          message: `"${originalItem.title}" marked as reviewed`,
        }]);
      }
    } catch (e) {}
    setUpdating(null);
  };

  const handleApproved = (id) => {
    const originalItem = items.find(i => i.id === id);
    setItems(prev => prev.filter(i => i.id !== id));
    setReviewingItem(null);
    if (originalItem) {
      setUndoToasts(prev => [...prev, {
        id: `approve-${id}-${Date.now()}`,
        itemId: id,
        originalStatus: originalItem.review_status,
        message: `"${originalItem.title}" approved`,
      }]);
    }
  };

  const handleDeleted = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setReviewingItem(null);
  };

  const handleUndo = async (toast) => {
    try {
      await base44.entities.ContentItem.update(toast.itemId, { review_status: toast.originalStatus });
      const item = await base44.entities.ContentItem.get(toast.itemId);
      setItems(prev => {
        if (prev.some(i => i.id === item.id)) {
          return prev.map(i => i.id === item.id ? { ...i, review_status: toast.originalStatus } : i);
        }
        return [item, ...prev];
      });
    } catch (e) {}
    setUndoToasts(prev => prev.filter(t => t.id !== toast.id));
  };

  const dismissToast = (toastId) => {
    setUndoToasts(prev => prev.filter(t => t.id !== toastId));
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="text-gold animate-spin" /></div>;
  }

  if (items.length === 0) {
    return <div className="aged-card rounded-xl p-12 text-center"><p className="text-parchment/50">No user uploads to review.</p></div>;
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const Icon = typeIcons[item.content_type] || FileText;
        const reviewed = item.review_status === 'reviewed';

        return (
          <div key={item.id} className="aged-card rounded-xl">
            <div className="p-5">
              {/* Content row */}
              <div className="flex items-start gap-4">
                {item.file_url && item.content_type === 'photo' ? (
                  <img src={item.file_url} alt={item.title} className="w-16 h-16 rounded-lg object-cover sepia-tint flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.15)] flex items-center justify-center flex-shrink-0">
                    <Icon size={20} className="text-gold" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs text-parchment/40 uppercase tracking-wider">{typeLabels[item.content_type] || 'Document'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${reviewed ? 'bg-green-500/10 text-green-300' : 'bg-[rgba(201,145,58,0.1)] text-amber-light'}`}>
                      {reviewed ? 'Reviewed' : 'Pending'}
                    </span>
                    {item.ai_confidence != null && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${item.ai_confidence >= 0.7 ? 'bg-green-500/10 text-green-300' : item.ai_confidence >= 0.4 ? 'bg-[rgba(201,145,58,0.1)] text-amber-light' : 'bg-red-500/10 text-red-300'}`}>
                        {Math.round(item.ai_confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-base text-parchment leading-snug">{item.title}</h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-parchment/40">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(item.created_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {item.location_name && <span className="truncate">· {item.location_name}</span>}
                  </div>
                </div>
              </div>

              {/* Actions row — separate row for breathing room */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[rgba(201,145,58,0.1)]">
                <button onClick={() => setReviewingItem(item)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-xs font-semibold hover:opacity-90 transition-opacity">
                  <Check size={14} /> Review & Approve
                </button>
                <Link to={`/content/${item.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.06)] text-parchment/60 border border-[rgba(201,145,58,0.1)] hover:text-amber-light transition-colors text-xs" title="Open detail page">
                  <ExternalLink size={14} /> View
                </Link>
                <div className="flex-1" />
                {!reviewed && (
                  <button onClick={() => markReviewed(item.id)} disabled={updating === item.id}
                    title="Mark as reviewed"
                    className="px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.08)] text-amber-light border border-[rgba(201,145,58,0.15)] hover:bg-[rgba(201,145,58,0.15)] transition-colors text-xs font-medium">
                    {updating === item.id ? <Loader2 size={14} className="animate-spin" /> : 'Mark Reviewed'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {reviewingItem && (
        <AdminReviewModal
          item={reviewingItem}
          onClose={() => setReviewingItem(null)}
          onApproved={handleApproved}
          onDeleted={handleDeleted}
        />
      )}

      {undoToasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[60] space-y-3 flex flex-col items-end">
          {undoToasts.map(toast => (
            <UndoToast
              key={toast.id}
              message={toast.message}
              onUndo={() => handleUndo(toast)}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}