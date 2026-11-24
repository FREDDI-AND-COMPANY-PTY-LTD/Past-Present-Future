import React from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';

/**
 * A small badge that sits over the brand/home link showing the user's pending
 * task count. Links to the Tasks page so the user can clear them.
 */
export default function TaskNotificationBadge({ count, to = '/tasks' }) {
  if (!count) return null;
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      title={`${count} pending task${count === 1 ? '' : 's'}`}
      className="absolute -top-1.5 -right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-[10px] font-bold border border-[#0D0B0A] hover:opacity-90 transition-opacity z-10 gold-pulse"
    >
      <Bell size={9} />
      <span>{count > 9 ? '9+' : count}</span>
    </Link>
  );
}