import React, { useState, useEffect } from 'react';
import AutoGrowTextarea from '@/components/AutoGrowTextarea';
import { Loader2, MessageCircle, Send, CornerDownRight, AtSign, X, HelpCircle, Heart, Lock, Pencil, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAccessRights } from '@/hooks/useAccessRights';

const AVATAR_COLORS = ['#C9913A', '#8B6914', '#6B8E23', '#9B6B3E', '#7A5C3A', '#5A7A5A'];

function avatarColor(name) {
  const c = (name || '?').charCodeAt(0) || 0;
  return AVATAR_COLORS[c % AVATAR_COLORS.length];
}

function Avatar({ name, size = 'sm' }) {
  const dim = size === 'lg' ? 'w-10 h-10 text-sm' : size === 'md' ? 'w-8 h-8 text-xs' : 'w-7 h-7 text-xs';
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-semibold text-charcoal flex-shrink-0`}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export default function CommentThread({ entityType, entityId, fieldName, user: initialUser, recordBranchId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState(initialUser || null);
  const [users, setUsers] = useState([]);
  const [taggedUserIds, setTaggedUserIds] = useState([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [isQuery, setIsQuery] = useState(false);
  const [replyTaggedIds, setReplyTaggedIds] = useState({});
  const [replyShowTagPicker, setReplyShowTagPicker] = useState({});
  const [likedComments, setLikedComments] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const access = useAccessRights();
  const canInteract = access.canInteract;
  // Branch admins moderate comments on their own branch's records; global admins moderate anything.
  const canModerate = access.status === 'admin' || (access.isBranchAdmin && (!recordBranchId || (access.adminBranchIds || []).includes(recordBranchId)));

  useEffect(() => {
    if (!initialUser) {
      base44.auth.me().then(setUser).catch(() => {});
    }
    base44.entities.User.list().then(setUsers).catch(() => {});
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
        tagged_user_ids: taggedUserIds.length > 0 ? taggedUserIds : null,
        is_query: isQuery,
        acknowledged_by: [],
      });
      setNewComment('');
      setTaggedUserIds([]);
      setShowTagPicker(false);
      setIsQuery(false);
      await loadComments();
    } catch (e) {}
    setSubmitting(false);
  };

  const handleReply = async (parentId) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const replyTags = replyTaggedIds[parentId] || [];
      await base44.entities.Comment.create({
        entity_type: entityType,
        entity_id: entityId,
        field_name: fieldName,
        content: replyText.trim(),
        author_id: user?.id || null,
        author_name: user?.full_name || user?.email || 'Family Member',
        parent_comment_id: parentId,
        tagged_user_ids: replyTags.length > 0 ? replyTags : null,
        is_query: false,
        acknowledged_by: [],
      });
      setReplyText('');
      setReplyTo(null);
      setReplyTaggedIds({});
      setReplyShowTagPicker({});
      await loadComments();
    } catch (e) {}
    setSubmitting(false);
  };

  const startEdit = (comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async (commentId) => {
    if (!editContent.trim()) return;
    setBusy(true);
    try {
      await base44.entities.Comment.update(commentId, { content: editContent.trim() });
      setEditingId(null);
      setEditContent('');
      await loadComments();
    } catch (e) {}
    setBusy(false);
  };

  const deleteComment = async (commentId) => {
    setBusy(true);
    try {
      // Remove replies first, then the comment itself
      const replies = comments.filter(c => c.parent_comment_id === commentId);
      for (const r of replies) {
        await base44.entities.Comment.delete(r.id).catch(() => {});
      }
      await base44.entities.Comment.delete(commentId);
      setDeletingId(null);
      await loadComments();
    } catch (e) {}
    setBusy(false);
  };

  const toggleLike = (commentId) => {
    setLikedComments(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const toggleTag = (uid) => {
    setTaggedUserIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };
  const toggleReplyTag = (parentId, uid) => {
    setReplyTaggedIds(prev => {
      const current = prev[parentId] || [];
      return { ...prev, [parentId]: current.includes(uid) ? current.filter(id => id !== uid) : [...current, uid] };
    });
  };

  const taggedUsers = (ids) => users.filter(u => ids?.includes(u.id));

  const topLevel = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_comment_id === parentId);

  const formatTime = (date) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const myName = user?.full_name || user?.email || 'You';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle size={18} className="text-gold" />
        <h4 className="font-display text-base text-parchment">Discussion</h4>
        <span className="text-xs text-parchment/40 bg-[rgba(201,145,58,0.08)] px-2 py-0.5 rounded-full">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      {/* New comment input — gated by branch access */}
      {canInteract ? (
      <div className="mb-5 flex gap-3">
        <Avatar name={myName} size="md" />
        <div className="flex-1 relative">
          <AutoGrowTextarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
            rows={2}
            expandedRows={8}
            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] resize-none placeholder:text-parchment/30"
            placeholder="Share a memory, ask a question, or add context to this story..."
          />
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              onClick={() => setShowTagPicker(!showTagPicker)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${showTagPicker ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:border-[rgba(201,145,58,0.4)]'}`}
            >
              <AtSign size={12} /> Tag {taggedUserIds.length > 0 && `(${taggedUserIds.length})`}
            </button>
            <button
              onClick={() => setIsQuery(!isQuery)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${isQuery ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:border-[rgba(201,145,58,0.4)]'}`}
            >
              <HelpCircle size={12} /> {isQuery ? 'Marked as Query' : 'Mark as Query'}
            </button>
            {taggedUsers(taggedUserIds).map(u => (
              <span key={u.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)]">
                {u.full_name || u.email}
                <button onClick={() => toggleTag(u.id)} className="text-parchment/30 hover:text-parchment"><X size={10} /></button>
              </span>
            ))}
            <button
              onClick={handleSubmit}
              disabled={submitting || !newComment.trim()}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#C9913A] text-charcoal text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Post
            </button>
          </div>

          {showTagPicker && (
            <div className="absolute z-30 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A] shadow-2xl">
              {users.filter(u => u.id !== user?.id).length === 0 ? (
                <p className="px-4 py-3 text-xs text-parchment/40">No other family members to tag.</p>
              ) : (
                users.filter(u => u.id !== user?.id).map(u => (
                  <button
                    key={u.id}
                    onClick={() => toggleTag(u.id)}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${taggedUserIds.includes(u.id) ? 'bg-[rgba(201,145,58,0.1)]' : 'hover:bg-[rgba(201,145,58,0.05)]'}`}
                  >
                    <Avatar name={u.full_name || u.email} />
                    <span className="text-sm text-parchment">{u.full_name || u.email}</span>
                    {taggedUserIds.includes(u.id) && <span className="ml-auto text-gold text-xs">✓</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      ) : (
        <div className="mb-5 aged-card rounded-xl p-4 flex items-center gap-2 text-sm text-parchment/50">
          <Lock size={14} className="text-gold/50" />
          {access.status === 'pending'
            ? "Your branch membership is awaiting approval — you can read the discussion and will be able to comment once approved."
            : "Comments are reserved for approved branch members. Request branch access to join the conversation."}
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex items-center gap-2 text-parchment/40 text-sm min-h-[80px]">
          <Loader2 size={14} className="animate-spin" /> Loading comments...
        </div>
      ) : topLevel.length === 0 ? (
        <div className="text-center py-8 min-h-[80px]">
          <MessageCircle size={32} className="text-parchment/20 mx-auto mb-2" />
          <p className="text-parchment/30 text-sm">No comments yet — be the first to start the conversation.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {topLevel.map(comment => (
            <CommentNode
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              formatTime={formatTime}
              taggedUsers={taggedUsers}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              replyText={replyText}
              setReplyText={setReplyText}
              handleReply={handleReply}
              submitting={submitting}
              users={users}
              currentUser={user}
              replyTaggedIds={replyTaggedIds}
              toggleReplyTag={toggleReplyTag}
              replyShowTagPicker={replyShowTagPicker}
              setReplyShowTagPicker={setReplyShowTagPicker}
              likedComments={likedComments}
              toggleLike={toggleLike}
              canInteract={canInteract}
              canModerate={canModerate}
              editingId={editingId}
              editContent={editContent}
              setEditContent={setEditContent}
              startEdit={startEdit}
              cancelEdit={cancelEdit}
              saveEdit={saveEdit}
              deletingId={deletingId}
              setDeletingId={setDeletingId}
              deleteComment={deleteComment}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentNode({
  comment, replies, formatTime, taggedUsers,
  replyTo, setReplyTo, replyText, setReplyText, handleReply, submitting,
  users, currentUser, replyTaggedIds, toggleReplyTag, replyShowTagPicker, setReplyShowTagPicker,
  likedComments, toggleLike, canInteract,
  canModerate, editingId, editContent, setEditContent, startEdit, cancelEdit, saveEdit,
  deletingId, setDeletingId, deleteComment, busy,
}) {
  const isLiked = likedComments.has(comment.id);
  const replyTags = replyTaggedIds[comment.id] || [];
  const tagged = taggedUsers(comment.tagged_user_ids);

  return (
    <div className="flex gap-3 py-1">
      <Avatar name={comment.author_name} />
      <div className="flex-1 min-w-0">
        {/* Comment bubble */}
        <div className="rounded-2xl rounded-tl-sm bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)] px-4 py-2.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs text-amber-light font-semibold">{comment.author_name || 'Family Member'}</span>
            {comment.is_query && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-[rgba(201,145,58,0.12)] text-amber-light border border-[rgba(201,145,58,0.2)] font-medium">QUERY</span>
            )}
            <span className="text-[10px] text-parchment/30">{formatTime(comment.created_date)}</span>
          </div>
          {editingId === comment.id ? (
            <div className="flex flex-col gap-2">
              <AutoGrowTextarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                autoFocus
                rows={2}
                expandedRows={14}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.3)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] resize-none overflow-hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveEdit(comment.id)}
                  disabled={busy || !editContent.trim()}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#C9913A] text-charcoal text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {busy ? <Loader2 size={11} className="animate-spin" /> : <Pencil size={11} />} Save
                </button>
                <button onClick={cancelEdit} disabled={busy} className="text-parchment/50 hover:text-parchment text-xs px-2">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-parchment/80 leading-relaxed whitespace-pre-wrap break-words">{comment.content}</p>
          )}
          {tagged?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tagged.map(u => (
                <span key={u.id} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-[rgba(201,145,58,0.06)] text-amber-light/60 border border-[rgba(201,145,58,0.1)]">
                  <AtSign size={8} />{u.full_name || u.email}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 mt-1 ml-1">
          <button
            onClick={() => toggleLike(comment.id)}
            className={`flex items-center gap-1 text-[11px] transition-colors ${isLiked ? 'text-red-400' : 'text-parchment/40 hover:text-red-400'}`}
          >
            <Heart size={12} fill={isLiked ? 'currentColor' : 'none'} />
            {isLiked ? 'Liked' : 'Like'}
          </button>
          {canInteract ? (
            <button
              onClick={() => { setReplyTo(replyTo === comment.id ? null : comment.id); setReplyText(''); }}
              className="flex items-center gap-1 text-[11px] text-parchment/40 hover:text-amber-light transition-colors"
            >
              <CornerDownRight size={12} /> Reply
            </button>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-parchment/25">
              <CornerDownRight size={12} /> Reply
            </span>
          )}
          {canModerate && editingId !== comment.id && (
            <button
              onClick={() => startEdit(comment)}
              className="flex items-center gap-1 text-[11px] text-parchment/40 hover:text-amber-light transition-colors"
            >
              <Pencil size={11} /> Edit
            </button>
          )}
          {canModerate && (
            <button
              onClick={() => setDeletingId(deletingId === comment.id ? null : comment.id)}
              className="flex items-center gap-1 text-[11px] text-parchment/40 hover:text-red-400 transition-colors"
            >
              <Trash2 size={11} /> Delete
            </button>
          )}
        </div>



        {/* Delete confirm */}
        {deletingId === comment.id && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/30 border border-red-500/30">
            <p className="text-xs text-parchment/70 flex-1">Delete this comment{replies.length > 0 ? ` and ${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : ''}?</p>
            <button
              onClick={() => deleteComment(comment.id)}
              disabled={busy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/80 text-white text-xs font-semibold disabled:opacity-50 hover:bg-red-600 transition-colors"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Delete
            </button>
            <button onClick={() => setDeletingId(null)} disabled={busy} className="text-parchment/50 hover:text-parchment text-xs px-2">Keep</button>
          </div>
        )}

        {/* Replies */}
        {replies.length > 0 && (
          <div className="mt-2 space-y-1 border-l-2 border-[rgba(201,145,58,0.1)] pl-3 ml-1">
            {replies.map(reply => {
              const replyLiked = likedComments.has(reply.id);
              const replyTagged = taggedUsers(reply.tagged_user_ids);
              return (
                <div key={reply.id} className="flex gap-2 py-1">
                  <Avatar name={reply.author_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="rounded-2xl rounded-tl-sm bg-[rgba(201,145,58,0.04)] border border-[rgba(201,145,58,0.08)] px-3 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-amber-light font-semibold">{reply.author_name || 'Family Member'}</span>
                        <span className="text-[10px] text-parchment/30">{formatTime(reply.created_date)}</span>
                      </div>
                      {editingId === reply.id ? (
                        <div className="flex flex-col gap-1.5">
                          <AutoGrowTextarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            autoFocus
                            rows={2}
                            expandedRows={14}
                            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.3)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] resize-none overflow-hidden"
                          />
                          <div className="flex items-center gap-2">
                            <button onClick={() => saveEdit(reply.id)} disabled={busy || !editContent.trim()} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#C9913A] text-charcoal text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity">
                              {busy ? <Loader2 size={11} className="animate-spin" /> : <Pencil size={11} />} Save
                            </button>
                            <button onClick={cancelEdit} disabled={busy} className="text-parchment/50 hover:text-parchment text-xs px-2">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-parchment/80 leading-relaxed whitespace-pre-wrap break-words">{reply.content}</p>
                      )}
                      {replyTagged?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {replyTagged.map(u => (
                            <span key={u.id} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-[rgba(201,145,58,0.06)] text-amber-light/60 border border-[rgba(201,145,58,0.1)]">
                              <AtSign size={8} />{u.full_name || u.email}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 ml-1">
                      <button
                        onClick={() => toggleLike(reply.id)}
                        className={`flex items-center gap-1 text-[11px] transition-colors ${replyLiked ? 'text-red-400' : 'text-parchment/40 hover:text-red-400'}`}
                      >
                        <Heart size={11} fill={replyLiked ? 'currentColor' : 'none'} />
                        {replyLiked ? 'Liked' : 'Like'}
                      </button>
                      {canModerate && editingId !== reply.id && (
                        <button onClick={() => startEdit(reply)} className="flex items-center gap-1 text-[11px] text-parchment/40 hover:text-amber-light transition-colors">
                          <Pencil size={10} /> Edit
                        </button>
                      )}
                      {canModerate && (
                        <button onClick={() => setDeletingId(deletingId === reply.id ? null : reply.id)} className="flex items-center gap-1 text-[11px] text-parchment/40 hover:text-red-400 transition-colors">
                          <Trash2 size={10} /> Delete
                        </button>
                      )}
                    </div>

                    {deletingId === reply.id && (
                      <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-950/30 border border-red-500/30">
                        <p className="text-xs text-parchment/70 flex-1">Delete this reply?</p>
                        <button onClick={() => deleteComment(reply.id)} disabled={busy} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600/80 text-white text-xs font-semibold disabled:opacity-50 hover:bg-red-600 transition-colors">
                          {busy ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />} Delete
                        </button>
                        <button onClick={() => setDeletingId(null)} disabled={busy} className="text-parchment/50 hover:text-parchment text-xs px-1">Keep</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply form */}
        {replyTo === comment.id && (
          <div className="mt-2 flex gap-2">
            <Avatar name={currentUser?.full_name || currentUser?.email || 'You'} size="sm" />
            <div className="flex-1 relative">
              <AutoGrowTextarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(comment.id);
                }}
                autoFocus
                rows={1}
                expandedRows={6}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] resize-none placeholder:text-parchment/30"
                placeholder={`Reply to ${comment.author_name}...`}
              />
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  onClick={() => setReplyShowTagPicker(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                  className="flex items-center gap-1 text-[11px] text-amber-light/60 hover:text-amber-light transition-colors"
                >
                  <AtSign size={10} /> Tag
                </button>
                <button
                  onClick={() => handleReply(comment.id)}
                  disabled={submitting || !replyText.trim()}
                  className="ml-auto px-3 py-1 rounded-lg bg-[#C9913A] text-charcoal text-xs font-semibold disabled:opacity-40"
                >
                  {submitting ? <Loader2 size={11} className="animate-spin" /> : 'Reply'}
                </button>
                <button onClick={() => { setReplyTo(null); setReplyText(''); setReplyShowTagPicker({}); }} className="text-parchment/40 text-xs px-1">Cancel</button>
              </div>
              {replyShowTagPicker[comment.id] && (
                <div className="absolute z-30 mt-1 w-full max-h-32 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A] shadow-2xl">
                  {users.filter(u => u.id !== currentUser?.id).map(u => (
                    <button
                      key={u.id}
                      onClick={() => toggleReplyTag(comment.id, u.id)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${replyTags.includes(u.id) ? 'bg-[rgba(201,145,58,0.1)]' : 'hover:bg-[rgba(201,145,58,0.05)]'}`}
                    >
                      <Avatar name={u.full_name || u.email} size="sm" />
                      <span className="text-xs text-parchment">{u.full_name || u.email}</span>
                      {replyTags.includes(u.id) && <span className="ml-auto text-gold text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}