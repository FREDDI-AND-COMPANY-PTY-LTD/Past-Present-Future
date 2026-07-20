// Display rule: approved ancestors present their surname in ALL CAPS, as on a
// birth certificate. Staged/unapproved placeholders keep their stored casing.
const APPROVED_STATUSES = ['auto_approved', 'overwritten', 'admin_verified'];

export function formatAncestorName(ancestorOrName, reviewStatus) {
  const isObj = ancestorOrName && typeof ancestorOrName === 'object';
  const name = isObj ? ancestorOrName.full_name : ancestorOrName;
  if (!name) return '';
  const status = isObj ? ancestorOrName.review_status : reviewStatus;
  if (status && !APPROVED_STATUSES.includes(status)) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.toUpperCase();
  return [...parts.slice(0, -1), parts[parts.length - 1].toUpperCase()].join(' ');
}