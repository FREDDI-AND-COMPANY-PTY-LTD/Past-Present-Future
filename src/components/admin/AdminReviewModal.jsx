import React from 'react';
import { X, FileText } from 'lucide-react';
import AdminEventEditor from '@/components/admin/AdminEventEditor';

export default function AdminReviewModal({ item, onClose, onApproved, onDeleted }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 animate-fade-in overflow-y-auto" onClick={onClose}>
      <div className="min-h-screen flex items-start justify-center p-4 py-8">
        <div className="aged-card rounded-2xl w-full max-w-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-gold" />
              <h2 className="font-display text-lg text-parchment">Review &amp; Approve Event</h2>
            </div>
            <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Body — full editable form, identical to the user upload form */}
          <div className="p-5">
            <AdminEventEditor item={item} onApproved={onApproved} onDeleted={onDeleted} />
          </div>
        </div>
      </div>
    </div>
  );
}