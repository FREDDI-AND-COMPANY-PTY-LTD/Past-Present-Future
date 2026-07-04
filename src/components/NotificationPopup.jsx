import React, { useState, useEffect } from 'react';
import { Bell, X, ChevronLeft, ChevronRight, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NotificationCard from './NotificationCard';

export default function NotificationPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [user, setUser] = useState(null);
  const [concluding, setConcluding] = useState(false);

  useEffect(() => {
    checkNotifications();
  }, []);

  const checkNotifications = async () => {
    if (sessionStorage.getItem('notifications_checked_this_session')) {
      setLoading(false);
      return;
    }

    try {
      const currentUser = await base44.auth.me();
      if (!currentUser) { setLoading(false); return; }

      const lastCheck = currentUser.last_notification_check
        ? new Date(currentUser.last_notification_check)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Fetch all content items to build a lookup map
      const allItems = await base44.entities.ContentItem.list('-created_date', 200);
      const itemMap = {};
      (allItems || []).forEach(i => { itemMap[i.id] = i; });

      // Identify user's uploaded content items
      const myItemIds = (allItems || [])
        .filter(i => i.uploaded_by_id === currentUser.id)
        .map(i => i.id);

      // Fetch all comments
      const allComments = await base44.entities.Comment.list('-created_date', 500);

      // Comments on my content items by others since last check
      const commentsOnMyItems = (allComments || []).filter(c =>
        c.entity_type === 'ContentItem' &&
        myItemIds.includes(c.entity_id) &&
        c.author_id !== currentUser.id &&
        new Date(c.created_date) > lastCheck
      );

      // My own comment IDs (to find replies to them)
      const myCommentIds = (allComments || [])
        .filter(c => c.author_id === currentUser.id)
        .map(c => c.id);

      // Replies to my comments by others since last check
      const repliesToMyComments = (allComments || []).filter(c =>
        c.parent_comment_id &&
        myCommentIds.includes(c.parent_comment_id) &&
        c.author_id !== currentUser.id &&
        new Date(c.created_date) > lastCheck
      );

      // Combine, deduplicate, sort chronologically
      const seen = new Set();
      const allNotifs = [...commentsOnMyItems, ...repliesToMyComments]
        .filter(n => {
          if (seen.has(n.id)) return false;
          seen.add(n.id);
          return true;
        })
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

      // Enrich with content item context
      const enriched = allNotifs.map(n => ({
        ...n,
        content_item: itemMap[n.entity_id] || null,
        is_reply: !!n.parent_comment_id,
      }));

      if (enriched.length > 0) {
        setNotifications(enriched);
        setUser(currentUser);
        setIsOpen(true);
      }
      sessionStorage.setItem('notifications_checked_this_session', 'true');
    } catch (e) {
      // Silent fail — don't block app usage
    }
    setLoading(false);
  };

  const handleConclude = async () => {
    setConcluding(true);
    try {
      await base44.auth.updateMe({ last_notification_check: new Date().toISOString() });
    } catch (e) {}
    setConcluding(false);
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentIndex < notifications.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleConclude();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  if (loading || !isOpen) return null;

  const current = notifications[currentIndex];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="aged-card rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1A1614] border-b border-[rgba(201,145,58,0.15)] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell size={20} className="text-gold" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#C9913A] text-charcoal text-[10px] flex items-center justify-center font-bold">
                {notifications.length}
              </span>
            </div>
            <span className="font-display text-lg text-parchment">Notifications</span>
          </div>
          <button onClick={handleConclude} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between text-xs text-parchment/40 mb-2">
            <span>{currentIndex + 1} of {notifications.length}</span>
            <span>{notifications.length - currentIndex - 1} remaining</span>
          </div>
          <div className="flex gap-1">
            {notifications.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-[#C9913A]' : i < currentIndex ? 'bg-[rgba(201,145,58,0.4)]' : 'bg-[rgba(201,145,58,0.12)]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Notification card */}
        <div className="px-6 py-4">
          <NotificationCard notification={current} user={user} />
        </div>

        {/* Navigation */}
        <div className="sticky bottom-0 bg-[#1A1614] border-t border-[rgba(201,145,58,0.15)] px-6 py-4 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-parchment/60 hover:text-amber-light disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <button
            onClick={handleNext}
            disabled={concluding}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {currentIndex === notifications.length - 1 ? (
              concluding ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Done</>
            ) : (
              <>Next <ChevronRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}