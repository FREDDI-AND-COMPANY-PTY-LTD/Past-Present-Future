import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, HelpCircle, Loader2, Bell, Bot, Tag, Send, ClipboardCheck, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';

const sourceOf = (c) => {
  const author = (c.author_name || '').toLowerCase();
  if (author.includes('automated') || author.includes('scan') || author.includes('system')) return 'automation';
  if (c.is_query) return 'message';
  return 'tag';
};

const SOURCE_LABELS = {
  automation: 'Automated prompt',
  message: 'Message request',
  tag: 'Tagged by family',
};

const SOURCE_ICONS = { automation: Bot, message: HelpCircle, tag: Tag };

const STATE_LABELS = {
  open: 'Waiting on review',
  later: 'Put aside for later',
};

export default function Tasks() {
  const [comments, setComments] = useState([]);
  const [contentItems, setContentItems] = useState({});
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser) { setLoading(false); return; }
      setUser(currentUser);

      const [allComments, allItems, allBranches] = await Promise.all([
        base44.entities.Comment.list('-created_date', 200),
        base44.entities.ContentItem.list('-created_date', 200),
        base44.entities.Branch.list().catch(() => []),
      ]);

      const itemMap = {};
      (allItems || []).forEach(i => { itemMap[i.id] = i; });

      // Comments where this user is tagged and no admin has resolved or dismissed
      // them yet — a bare acknowledgement no longer clears a task.
      const myTasks = (allComments || []).filter(c =>
        c.tagged_user_ids?.includes(currentUser.id) &&
        c.review_state !== 'resolved' &&
        c.review_state !== 'dismissed'
      );

      setComments(myTasks);
      setContentItems(itemMap);
      setBranches(allBranches || []);
    } catch (e) {}
    setLoading(false);
  };

  const isBranchAdmin = (branches || []).some(b => b.admin_user_id && user && b.admin_user_id === user.id);

  // Who should pick this up: the admin of the record's branch, else the archive's admins.
  const adminIdsFor = (comment) => {
    const item = contentItems[comment.entity_id];
    const admins = (branches || []).filter(b => b.admin_user_id);
    const forBranch = item?.branch_id ? admins.filter(b => b.id === item.branch_id) : [];
    const pool = forBranch.length ? forBranch : admins;
    return [...new Set(pool.map(b => b.admin_user_id))].filter(id => id && id !== user?.id);
  };

  const isSent = (comment) => {
    const ids = adminIdsFor(comment);
    return ids.length > 0 && ids.every(id => (comment.tagged_user_ids || []).includes(id));
  };

  const handleSendToReview = async (comment) => {
    const adminIds = adminIdsFor(comment);
    if (!adminIds.length) return;
    setSending(comment.id);
    try {
      const merged = [...new Set([...(comment.tagged_user_ids || []), ...adminIds])];
      await base44.entities.Comment.update(comment.id, { tagged_user_ids: merged });
      setComments(prev => prev.map(c => (c.id === comment.id ? { ...c, tagged_user_ids: merged } : c)));
    } catch (e) {}
    setSending(null);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-4xl text-parchment mb-2">My Tasks</h1>
          <p className="text-parchment/50 text-sm">
            Comments and queries where you've been tagged. Nothing clears from here until a branch admin resolves or dismisses it in the Review queue.
          </p>
          {isBranchAdmin && (
            <Link to="/app/review"
              className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg border border-[rgba(201,145,58,0.25)] text-amber-light text-xs hover:bg-[rgba(201,145,58,0.08)] transition-colors">
              <ClipboardCheck size={13} /> Open the Review queue
            </Link>
          )}
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
              const source = sourceOf(comment);
              const SourceIcon = SOURCE_ICONS[source];
              const sent = isSent(comment);
              return (
                <div key={comment.id} className="aged-card rounded-xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${source === 'automation' ? 'bg-[rgba(201,145,58,0.15)] border border-[#C9913A]' : 'bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)]'}`}>
                      <SourceIcon size={18} className={source === 'automation' ? 'text-gold' : 'text-gold/80'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm text-amber-light font-medium">{comment.author_name || 'Family Member'}</span>
                        <span className="text-xs text-parchment/30">{formatTime(comment.created_date)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${source === 'automation' ? 'bg-[rgba(201,145,58,0.15)] text-amber-light border-[#C9913A]' : source === 'message' ? 'bg-[rgba(201,145,58,0.12)] text-amber-light border-[rgba(201,145,58,0.2)]' : 'bg-[rgba(201,145,58,0.06)] text-amber-light/80 border-[rgba(201,145,58,0.15)]'}`}>
                          {SOURCE_LABELS[source]}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] border bg-[rgba(245,236,215,0.05)] text-parchment/50 border-[rgba(245,236,215,0.1)]">
                          {STATE_LABELS[comment.review_state] || 'Waiting on review'}
                        </span>
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
                    {sent ? (
                      <span className="flex items-center gap-1.5 px-3 py-2 text-xs text-parchment/40">
                        <Check size={14} className="text-green-400" /> In your branch admin's Review queue
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSendToReview(comment)}
                        disabled={sending === comment.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors disabled:opacity-50"
                      >
                        {sending === comment.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Send to branch admin
                      </button>
                    )}
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