import { Copy, AlertTriangle, Heart, Edit3, LifeBuoy, Tag } from 'lucide-react';

export const REVIEW_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'duplicate', label: 'Duplicate matches', icon: Copy },
  { key: 'conflict', label: 'Contested facts', icon: AlertTriangle },
  { key: 'familylink', label: 'Family links', icon: Heart },
  { key: 'editrequest', label: 'Edit requests', icon: Edit3 },
  { key: 'problemreport', label: 'Problem reports', icon: LifeBuoy },
  { key: 'tag', label: 'Tagged queries', icon: Tag },
];

export const STATE_TABS = [
  { key: 'open', label: 'Open' },
  { key: 'later', label: 'Later' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
];

export const SORTS = [
  { key: 'confidence', label: 'Confidence & priority' },
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
];

const TYPE_META = {
  duplicate: { label: 'Duplicate match', primary: 'Merge', icon: Copy },
  conflict: { label: 'Contested fact', primary: 'Accept change', icon: AlertTriangle },
  familylink: { label: 'Family link', primary: 'Approve link', icon: Heart },
  editrequest: { label: 'Edit request', primary: 'Approve edit', icon: Edit3 },
  problemreport: { label: 'Problem report', primary: 'Mark fixed', icon: LifeBuoy },
  tag: { label: 'Tagged query', primary: 'Reply & clear', icon: Tag },
};

export const typeMeta = (type) => TYPE_META[type] || TYPE_META.conflict;

// Left severity stripe: red at ≥90%, gold at ≥70%, faint otherwise.
// Priority stands in where a record carries no confidence score.
export const stripeClass = (item) => {
  if (item.confidence != null) {
    if (item.confidence >= 0.9) return 'bg-red-500';
    if (item.confidence >= 0.7) return 'bg-[#C9913A]';
    return 'bg-[rgba(201,145,58,0.25)]';
  }
  if (item.priority === 'high') return 'bg-red-500';
  if (item.priority === 'medium') return 'bg-[#C9913A]';
  return 'bg-[rgba(201,145,58,0.25)]';
};

export const badgeFor = (item) => {
  if (item.confidence != null) {
    const tone = item.confidence >= 0.9 ? 'red' : item.confidence >= 0.7 ? 'gold' : 'muted';
    return { label: `${Math.round(item.confidence * 100)}% match`, tone };
  }
  const priority = item.priority || 'medium';
  const label = priority === 'high' ? 'High priority' : priority === 'low' ? 'Low priority' : 'Medium priority';
  const tone = priority === 'high' ? 'red' : priority === 'low' ? 'muted' : 'gold';
  return { label, tone };
};

export const ageOf = (date) => {
  if (!date) return '';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d';
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
};

export const sortItems = (items, sort) => {
  const priorityRank = { high: 3, medium: 2, low: 1 };
  const list = [...items];
  if (sort === 'newest') {
    list.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  } else if (sort === 'oldest') {
    list.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
  } else {
    list.sort((a, b) => {
      const sa = a.confidence != null ? a.confidence : (priorityRank[a.priority] || 2) / 3;
      const sb = b.confidence != null ? b.confidence : (priorityRank[b.priority] || 2) / 3;
      if (sb !== sa) return sb - sa;
      return new Date(b.created_date || 0) - new Date(a.created_date || 0);
    });
  }
  return list;
};