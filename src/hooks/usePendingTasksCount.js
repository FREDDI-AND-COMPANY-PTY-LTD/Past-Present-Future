import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Counts the signed-in user's pending tasks — comments where they are tagged
 * and have not yet acknowledged. Mirrors the filter used by the Tasks page.
 * Live-updates via the Comment realtime subscription.
 */
export function usePendingTasksCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let unsub = null;

    const load = async () => {
      try {
        const me = await base44.auth.me();
        if (!me || cancelled) return;
        const comments = await base44.entities.Comment.list('-created_date', 200);
        if (cancelled) return;
        // Only a resolve or dismiss clears a tagged comment from the feed — a
        // bare acknowledgement no longer removes it.
        const myTasks = (comments || []).filter(c =>
          c.tagged_user_ids?.includes(me.id) &&
          c.review_state !== 'resolved' &&
          c.review_state !== 'dismissed'
        );
        setCount(myTasks.length);
      } catch (e) {}
    };

    load();
    try {
      unsub = base44.entities.Comment.subscribe(() => load());
    } catch (e) {}

    return () => { cancelled = true; if (unsub) unsub(); };
  }, []);

  return count;
}