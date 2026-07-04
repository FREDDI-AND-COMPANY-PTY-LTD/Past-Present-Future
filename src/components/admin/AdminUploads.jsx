import React, { useState, useEffect } from 'react';
import { Loader2, Check, Pencil, X, Clock, Image, FileText, Newspaper, Award, BookUser, IdCard, Mail, Heart, HelpCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

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
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ContentItem.list('-created_date', 50);
      setItems(data || []);
    } catch (e) {
      // error
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [refreshKey]);

  const markReviewed = async (id) => {
    setUpdating(id);
    try {
      await base44.entities.ContentItem.update(id, { review_status: 'reviewed' });
      setItems(prev => prev.map(i => i.id === id ? { ...i, review_status: 'reviewed' } : i));
    } catch (e) {
      // error
    }
    setUpdating(null);
  };

  const startEdit = (item) => {
    setEditing(item.id);
    setEditData({ title: item.title, description: item.description || '' });
  };

  const saveEdit = async (id) => {
    setUpdating(id);
    try {
      await base44.entities.ContentItem.update(id, {
        title: editData.title,
        description: editData.description,
      });
      setItems(prev => prev.map(i => i.id === id ? { ...i, title: editData.title, description: editData.description } : i));
      setEditing(null);
    } catch (e) {
      // error
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="text-gold animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <p className="text-parchment/50">No user uploads to review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const Icon = typeIcons[item.content_type] || FileText;
        const reviewed = item.review_status === 'reviewed';
        const isEditing = editing === item.id;

        return (
          <div key={item.id} className="aged-card rounded-xl p-5">
            <div className="flex items-start gap-4">
              {item.file_url && item.content_type === 'photo' ? (
                <img src={item.file_url} alt={item.title} className="w-16 h-16 rounded-lg object-cover sepia-tint flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.15)] flex items-center justify-center flex-shrink-0">
                  <Icon size={20} className="text-gold" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={editData.title}
                      onChange={e => setEditData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    />
                    <textarea
                      value={editData.description}
                      onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] resize-none"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-parchment/40 uppercase tracking-wider">{typeLabels[item.content_type] || 'Document'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${reviewed ? 'bg-green-500/10 text-green-300' : 'bg-[rgba(201,145,58,0.1)] text-amber-light'}`}>
                        {reviewed ? 'Reviewed' : 'Pending'}
                      </span>
                    </div>
                    <h3 className="font-display text-base text-parchment">{item.title}</h3>
                    {item.description && (
                      <p className="text-sm text-parchment/50 line-clamp-2 mt-0.5">{item.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-parchment/40">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(item.created_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdit(item.id)}
                      disabled={updating === item.id}
                      className="p-1.5 rounded-lg bg-green-500/10 text-green-300 border border-green-500/25 hover:bg-green-500/20 transition-colors"
                    >
                      {updating === item.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="p-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] text-parchment/40 border border-[rgba(201,145,58,0.1)] hover:text-parchment transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    {!reviewed && (
                      <button
                        onClick={() => markReviewed(item.id)}
                        disabled={updating === item.id}
                        title="Mark as reviewed"
                        className="p-1.5 rounded-lg bg-[rgba(201,145,58,0.08)] text-amber-light border border-[rgba(201,145,58,0.15)] hover:bg-[rgba(201,145,58,0.15)] transition-colors"
                      >
                        {updating === item.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(item)}
                      title="Edit / overwrite"
                      className="p-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] text-parchment/40 border border-[rgba(201,145,58,0.1)] hover:text-amber-light transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}