import React, { useState, useEffect } from 'react';
import { Loader2, Send, Upload, MessageCircle, CornerDownRight, Link2, X, FileText, Image as ImageIcon, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

export default function NotificationCard({ notification, user }) {
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [relatedTitle, setRelatedTitle] = useState('');
  const [relatedDesc, setRelatedDesc] = useState('');
  const [relatedFile, setRelatedFile] = useState(null);
  const [relatedItems, setRelatedItems] = useState(notification.related_content_item_ids || []);
  const [thread, setThread] = useState([]);
  const [loadingThread, setLoadingThread] = useState(true);
  const [threadExpanded, setThreadExpanded] = useState(false);
  const [justReplied, setJustReplied] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);

  useEffect(() => {
    loadThread();
  }, [notification.entity_id, notification.field_name]);

  const loadThread = async () => {
    setLoadingThread(true);
    try {
      const all = await base44.entities.Comment.filter({
        entity_type: notification.entity_type,
        entity_id: notification.entity_id,
      });
      const filtered = (all || [])
        .filter(c => c.field_name === notification.field_name)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setThread(filtered);
    } catch (e) {}
    setLoadingThread(false);
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await base44.entities.Comment.create({
        entity_type: notification.entity_type,
        entity_id: notification.entity_id,
        field_name: notification.field_name,
        content: replyText.trim(),
        author_id: user?.id || null,
        author_name: user?.full_name || user?.email || 'Family Member',
        parent_comment_id: notification.parent_comment_id || notification.id,
      });
      setReplyText('');
      setJustReplied(true);
      setTimeout(() => setJustReplied(false), 3000);
      await loadThread();
    } catch (e) {}
    setReplying(false);
  };

  const handleUploadRelated = async () => {
    if (!relatedFile || !relatedTitle.trim()) return;
    setUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file: relatedFile });
      const newItem = await base44.entities.ContentItem.create({
        title: relatedTitle.trim(),
        content_type: relatedFile.type.startsWith('image/') ? 'photo' : 'narrative',
        description: relatedDesc.trim(),
        file_url: uploadRes.file_url,
        ancestor_ids: notification.content_item?.ancestor_ids || [],
        uploaded_by_id: user?.id || null,
        tags: ['related event'],
      });
      const updatedIds = [...relatedItems, newItem.id];
      await base44.entities.Comment.update(notification.id, { related_content_item_ids: updatedIds });
      setRelatedItems(updatedIds);
      setRelatedTitle('');
      setRelatedDesc('');
      setRelatedFile(null);
      setShowUpload(false);
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 3000);
    } catch (e) {}
    setUploading(false);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const ci = notification.content_item;

  // Build the conversation context around this notification
  const notifComment = thread.find(c => c.id === notification.id);
  const parentComment = notifComment?.parent_comment_id
    ? thread.find(c => c.id === notifComment.parent_comment_id)
    : null;
  const siblingReplies = notifComment?.parent_comment_id
    ? thread.filter(c => c.parent_comment_id === notifComment.parent_comment_id)
    : thread.filter(c => c.parent_comment_id === notification.id);

  const contextComments = parentComment
    ? [parentComment, ...siblingReplies]
    : [notifComment, ...siblingReplies].filter(Boolean);

  const visibleThread = threadExpanded ? thread : contextComments;
  const hasMoreThread = !threadExpanded && thread.length > contextComments.length;

  return (
    <div>
      {notification.is_reply && (
        <div className="flex items-center gap-1.5 text-xs text-amber-light/60 mb-3">
          <CornerDownRight size={12} /> Replied to your comment
        </div>
      )}

      {/* Content item reference */}
      {ci && (
        <Link to={`/content/${ci.id}`} target="_blank" className="flex items-center gap-3 p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)] hover:border-[rgba(201,145,58,0.3)] transition-colors mb-3">
          {ci.file_url && ci.content_type === 'photo' ? (
            <img src={ci.file_url} alt={ci.title} className="w-12 h-12 rounded-lg object-cover sepia-tint flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[rgba(201,145,58,0.1)] flex items-center justify-center flex-shrink-0">
              {ci.file_url ? <FileText size={18} className="text-gold" /> : <MessageCircle size={18} className="text-gold" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-parchment font-medium truncate">{ci.title}</p>
            <p className="text-xs text-parchment/40">{notification.is_reply ? 'Discussion thread' : 'Your upload'}</p>
          </div>
        </Link>
      )}

      {/* Conversation thread context */}
      {!loadingThread && visibleThread.length > 0 && (
        <div className="mb-3 space-y-2">
          {visibleThread.map((c, i) => {
            const isNotif = c.id === notification.id;
            const isParent = parentComment && c.id === parentComment.id;
            return (
              <div
                key={c.id}
                className={`rounded-lg p-3 border transition-all ${
                  isNotif
                    ? 'bg-[rgba(201,145,58,0.08)] border-[#C9913A]'
                    : isParent
                    ? 'bg-[rgba(201,145,58,0.04)] border-[rgba(201,145,58,0.2)]'
                    : 'bg-[#0D0B0A] border-[rgba(201,145,58,0.1)]'
                } ${c.parent_comment_id ? 'ml-4' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.15)] flex items-center justify-center text-xs text-gold font-medium">
                    {c.author_name?.charAt(0) || '?'}
                  </div>
                  <span className="text-xs text-amber-light/80 font-medium">{c.author_name || 'Family Member'}</span>
                  {isNotif && <span className="text-[10px] text-gold bg-[rgba(201,145,58,0.15)] px-1.5 py-0.5 rounded-full">new</span>}
                  <span className="text-xs text-parchment/30 ml-auto">{formatTime(c.created_date)}</span>
                </div>
                <p className="text-sm text-parchment/80 leading-relaxed">{c.content}</p>
              </div>
            );
          })}
          {hasMoreThread && (
            <button
              onClick={() => setThreadExpanded(true)}
              className="flex items-center gap-1 text-xs text-amber-light/60 hover:text-amber-light transition-colors ml-1"
            >
              <ChevronDown size={12} /> Show full conversation ({thread.length} messages)
            </button>
          )}
          {threadExpanded && (
            <button
              onClick={() => setThreadExpanded(false)}
              className="flex items-center gap-1 text-xs text-amber-light/60 hover:text-amber-light transition-colors ml-1"
            >
              <ChevronUp size={12} /> Collapse to context
            </button>
          )}
        </div>
      )}

      {loadingThread && (
        <div className="mb-3 flex items-center gap-2 text-parchment/40 text-xs">
          <Loader2 size={12} className="animate-spin" /> Loading conversation...
        </div>
      )}

      {/* Related items */}
      {relatedItems.length > 0 && (
        <div className="mt-2 mb-3 flex flex-wrap gap-1.5">
          {relatedItems.map(rid => (
            <Link
              key={rid}
              to={`/content/${rid}`}
              target="_blank"
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)] hover:border-[rgba(201,145,58,0.4)] transition-colors"
            >
              <Link2 size={10} /> Related event
            </Link>
          ))}
        </div>
      )}

      {/* Success confirmations */}
      {justReplied && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)] text-xs text-gold animate-fade-in">
          <Check size={14} /> Reply posted — see it in the conversation above.
        </div>
      )}
      {justUploaded && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)] text-xs text-gold animate-fade-in">
          <Check size={14} /> Related event uploaded and linked to this comment.
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => { setShowReply(!showReply); setShowUpload(false); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${showReply ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:text-amber-light hover:border-[rgba(201,145,58,0.4)]'}`}
        >
          <CornerDownRight size={14} /> Reply
        </button>
        <button
          onClick={() => { setShowUpload(!showUpload); setShowReply(false); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${showUpload ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:text-amber-light hover:border-[rgba(201,145,58,0.4)]'}`}
        >
          <Upload size={14} /> Add Related Event
        </button>
      </div>

      {/* Reply form — stays open after submitting for continued engagement */}
      {showReply && (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReply()}
              autoFocus
              className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              placeholder={`Reply to ${notification.author_name}...`}
            />
            <button
              onClick={handleReply}
              disabled={replying || !replyText.trim()}
              className="px-4 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-parchment/30">Your reply will appear in the conversation thread above.</p>
        </div>
      )}

      {/* Upload related event form */}
      {showUpload && (
        <div className="mt-3 p-4 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-light/70 font-medium">Upload a related event</span>
            <button onClick={() => setShowUpload(false)} className="text-parchment/30 hover:text-parchment"><X size={14} /></button>
          </div>
          <div>
            <label className="text-xs text-parchment/50 mb-1 block">Title</label>
            <input
              value={relatedTitle}
              onChange={e => setRelatedTitle(e.target.value)}
              className="w-full bg-[#1A1614] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              placeholder="Related event title"
            />
          </div>
          <div>
            <label className="text-xs text-parchment/50 mb-1 block">Description (optional)</label>
            <textarea
              value={relatedDesc}
              onChange={e => setRelatedDesc(e.target.value)}
              rows={2}
              className="w-full bg-[#1A1614] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              placeholder="Add context for this related event..."
            />
          </div>
          <div>
            <label className="text-xs text-parchment/50 mb-1 block">File</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,image/*"
              onChange={e => setRelatedFile(e.target.files?.[0])}
              className="w-full text-sm text-parchment/60 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[rgba(201,145,58,0.15)] file:text-amber-light file:text-sm file:cursor-pointer"
            />
            {relatedFile && (
              <div className="mt-2 flex items-center gap-2 text-xs text-parchment/50">
                {relatedFile.type.startsWith('image/') ? <ImageIcon size={14} className="text-gold" /> : <FileText size={14} className="text-gold" />}
                {relatedFile.name}
              </div>
            )}
          </div>
          <button
            onClick={handleUploadRelated}
            disabled={uploading || !relatedFile || !relatedTitle.trim()}
            className="w-full py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload & Link to Comment'}
          </button>
        </div>
      )}
    </div>
  );
}