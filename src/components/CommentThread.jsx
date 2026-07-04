import React, { useState, useEffect } from 'react';
import { Loader2, MessageCircle, Send, ChevronLeft, CornerDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

export default function CommentThread({ entityType, entityId, fieldName }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadComments();
  }, [entityId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Comment.filter({ entity_type: entityType, entity_id: entityId });
      const filtered = (all || []).filter(c => c.field_name === fieldName);
      filtered.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setComments(filtered);
    } catch (e) {}
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await base44.entities.Comment.create({
        entity_type: entityType,
        entity_id: entityId,
        field_name: fieldName,
        content: newComment.trim(),
        author_id: user?.id || null,
        author_name: user?.full_name || user?.email || 'Family Member',
        parent_comment_id: null,
      });
      setNewComment('');
      await loadComments();
    } catch (e) {}
    setSubmitting(false);
  };

  const handleReply = async (parentId) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await base44.entities.Comment.create({
        entity_type: entityType,
        entity_id: entityId,
        field_name: fieldName,
        content: replyText.trim(),
        author_id: user?.id || null,
        author_name: user?.full_name || user?.email || 'Family Member',
        parent_comment_id: parentId,
      });
      setReplyText('');
      setReplyTo(null);
      await loadComments();
    } catch (e) {}
    setSubmitting(false);
  };

  const topLevel = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_comment_id === parentId);

  const formatTime = (date) => {
    return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle size={16} className="text-gold" />
        <h4 className="font-display text-sm text-parchment">Comments ({comments.length})</h4>
      </div>

      {/* New comment input */}
      <div className="mb-4 flex gap-2">
        <input
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
          placeholder="Share a memory or thought..."
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim()}
          className="px-4 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="flex items-center gap-2 text-parchment/40 text-sm">
          <Loader2 size={14} className="animate-spin" /> Loading comments...
        </div>
      ) : topLevel.length === 0 ? (
        <p className="text-parchment/30 text-sm italic">No comments yet — be the first to share a memory.</p>
      ) : (
        <div className="space-y-3">
          {topLevel.map(comment => (
            <div key={comment.id}>
              <CommentBubble comment={comment} formatTime={formatTime} />
              {/* Replies */}
              <div className="ml-6 mt-2 space-y-2 border-l border-[rgba(201,145,58,0.1)] pl-4">
                {getReplies(comment.id).map(reply => (
                  <CommentBubble key={reply.id} comment={reply} formatTime={formatTime} isReply />
                ))}
              </div>
              {/* Reply form */}
              {replyTo === comment.id ? (
                <div className="ml-6 mt-2 flex gap-2">
                  <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReply(comment.id)}
                    autoFocus
                    className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-1.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder={`Reply to ${comment.author_name}...`}
                  />
                  <button
                    onClick={() => handleReply(comment.id)}
                    disabled={submitting || !replyText.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[#C9913A] text-charcoal text-xs font-semibold disabled:opacity-50"
                  >
                    Reply
                  </button>
                  <button onClick={() => { setReplyTo(null); setReplyText(''); }} className="text-parchment/40 text-xs px-2">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setReplyTo(comment.id)}
                  className="ml-6 mt-1 flex items-center gap-1 text-xs text-parchment/40 hover:text-amber-light transition-colors"
                >
                  <CornerDownRight size={12} /> Reply
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentBubble({ comment, formatTime, isReply }) {
  return (
    <div className={`rounded-lg p-3 ${isReply ? 'bg-[rgba(201,145,58,0.04)]' : 'bg-[#0D0B0A]'} border border-[rgba(201,145,58,0.1)]`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.15)] flex items-center justify-center text-xs text-gold font-medium">
          {comment.author_name?.charAt(0) || '?'}
        </div>
        <span className="text-xs text-amber-light/80 font-medium">{comment.author_name || 'Family Member'}</span>
        <span className="text-xs text-parchment/30">{formatTime(comment.created_date)}</span>
      </div>
      <p className="text-sm text-parchment/70 leading-relaxed">{comment.content}</p>
    </div>
  );
}