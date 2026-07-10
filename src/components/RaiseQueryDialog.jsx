import React, { useState, useEffect } from 'react';
import { HelpCircle, X, Loader2, Check, Tag } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build the list of queryable fields from the content item
const FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'date', label: 'Event Date' },
  { key: 'location_name', label: 'Event Location' },
  { key: 'era', label: 'Era' },
  { key: 'transcribed_text', label: 'Transcribed Text' },
  { key: 'extracted_fields', label: 'Extracted Certificate Data' },
  { key: 'ancestor_ids', label: 'Tagged Ancestors' },
  { key: 'general_discussion', label: 'General / Other' },
];

export default function RaiseQueryDialog({ item, onClose, onSubmitted }) {
  const [fieldName, setFieldName] = useState('general_discussion');
  const [queryText, setQueryText] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    base44.entities.User.list().then(setUsers).catch(() => {});
  }, []);

  const toggleUser = (uid) => {
    setSelectedUserIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const handleSubmit = async () => {
    if (!queryText.trim()) return;
    setSubmitting(true);
    try {
      const currentUser = await base44.auth.me().catch(() => null);
      await base44.entities.Comment.create({
        entity_type: 'ContentItem',
        entity_id: item.id,
        field_name: fieldName,
        content: queryText.trim(),
        author_id: currentUser?.id || null,
        author_name: currentUser?.full_name || currentUser?.email || 'Family Member',
        parent_comment_id: null,
        tagged_user_ids: selectedUserIds.length > 0 ? selectedUserIds : null,
        is_query: true,
        acknowledged_by: [],
      });
      setSubmitted(true);
      setQueryText('');
      setSelectedUserIds([]);
    } catch (e) {}
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)]">
          <div className="flex items-center gap-2">
            <HelpCircle size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Raise a Query</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-gold" />
            </div>
            <p className="text-parchment text-sm mb-1">Query submitted for review.</p>
            <p className="text-parchment/40 text-xs">The tagged family member(s) will be notified.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Field selector */}
            <div>
              <label className="text-sm text-parchment/60 mb-2 block">Which piece of data are you querying?</label>
              <select
                value={fieldName}
                onChange={e => setFieldName(e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              >
                {FIELDS.map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Query text */}
            <div>
              <label className="text-sm text-parchment/60 mb-2 block">Your question or concern</label>
              <textarea
                value={queryText}
                onChange={e => setQueryText(e.target.value)}
                rows={3}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-parchment text-sm focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                placeholder="e.g. Is this date correct? The certificate reads 1945 but family records say 1944..."
              />
            </div>

            {/* Tag a user to review */}
            <div>
              <label className="text-sm text-parchment/60 mb-2 flex items-center gap-1.5">
                <Tag size={14} /> Tag a family member to review this query
              </label>
              {users.length <= 1 ? (
                <p className="text-xs text-parchment/40">No other registered family members found to tag.</p>
              ) : (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A]">
                  {users.filter(u => u.id !== null).slice(0, 20).map(u => (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${selectedUserIds.includes(u.id) ? 'bg-[rgba(201,145,58,0.1)]' : 'hover:bg-[rgba(201,145,58,0.05)]'}`}
                    >
                      <div className="w-6 h-6 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-xs text-gold">
                        {(u.full_name || u.email).charAt(0)}
                      </div>
                      <span className="text-sm text-parchment">{u.full_name || u.email}</span>
                      {selectedUserIds.includes(u.id) && <span className="ml-auto text-gold text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-[rgba(245,236,215,0.15)] text-parchment/60 text-sm hover:bg-[rgba(245,236,215,0.05)] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!queryText.trim() || submitting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <HelpCircle size={16} />}
                Submit Query
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}