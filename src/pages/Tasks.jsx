import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MessageCircle, HelpCircle, Loader2, Bell } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';

export default function Tasks() {
  const [comments, setComments] = useState([]);
  const [contentItems, setContentItems] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser) { setLoading(false); return; }
      setUser(currentUser);

      const allComments = await base44.entities.Comment.list('-created_date', 200);
      const allItems = await base44.entities.ContentItem.list('-created_date', 200);

      const itemMap = {};
      (allItems || []).forEach(i => { itemMap[i.id] = i; });

      // Comments where this user is tagged and hasn't acknowledged
      const myTasks = (allComments || []).filter(c =>
        c.tagged_user_ids?.includes(currentUser.id) &&
        !(c.acknowledged_by || []).includes(currentUser.id)
      );

      setComments(myTasks);
      setContentItems(itemMap);
    } catch (e) {}
    setLoading(false);
  };

  const handleAcknowledge = async (commentId) => {
    setAcknowledging(commentId);
    try {
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;
      const updatedAck = [...(comment.acknowledged_by || []), user.id];
      await base44.entities.Comment.update(commentId, { acknowledged_by: updatedAck });
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {}
    setAcknowledging(null);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-4xl text-parchment mb-2">My Tasks</h1>
          <p className="text-parchment/50 text-sm">Comments and queries where you've been tagged. Acknowledge them to clear your list.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-gold animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="aged-card rounded-2xl p-12 text-center">
            <Bell size={32} className="text-gold/40 mx-auto mb-3" />
            <p className="text-parchment/50 text-sm">You're all caught up — no pending tasks.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map(comment => {
              const item = contentItems[comment.entity_id];
              const isQuery = comment.is_query;
              return (
                <div key={comment.id} className="aged-card rounded-xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isQuery ? 'bg-[rgba(201,145,58,0.15)] border border-[#C9913A]' : 'bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)]'}`}>
                      {isQuery ? <HelpCircle size={18} className="text-gold" /> : <MessageCircle size={18} className="text-gold/80" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-amber-light font-medium">{comment.author_name || 'Family Member'}</span>
                        <span className="text-xs text-parchment/30">{formatTime(comment.created_date)}</span>
                        {isQuery && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[rgba(201,145,58,0.12)] text-amber-light border border-[rgba(201,145,58,0.2)]">QUERY</span>
                        )}
                      </div>
                      <p className="text-sm text-parchment/70 leading-relaxed mb-3">{comment.content}</p>

                      {item && (
                        <Link
                          to={`/content/${item.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)] text-xs text-amber-light/80 hover:border-[rgba(201,145,58,0.35)] transition-colors"
                        >
                          {item.file_url && <img src={item.file_url} alt="" className="w-8 h-8 rounded object-cover" />}
                          <span>{item.title || 'View item'}</span>
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleAcknowledge(comment.id)}
                      disabled={acknowledging === comment.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors disabled:opacity-50"
                    >
                      {acknowledging === comment.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Acknowledge
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}