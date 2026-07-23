import { base44 } from '@/api/base44Client';

/**
 * Permanently deletes a ContentItem upload and cleans up its related records
 * (comments, conflict flags, edit requests, family links, sources) so nothing
 * dangles in the archive. Also writes an ActivityLog entry.
 *
 * Returns true on success, throws on failure.
 */
export async function deleteContentItem(item, actor) {
  const id = item?.id;
  if (!id) throw new Error('No item to delete');

  // Clean up related records first (best-effort, non-blocking failures)
  await Promise.all([
    base44.entities.Comment.deleteMany({ entity_type: 'ContentItem', entity_id: id }).catch(() => {}),
    base44.entities.ConflictFlag.deleteMany({ content_item_id: id }).catch(() => {}),
    base44.entities.EditRequest.deleteMany({ content_item_id: id }).catch(() => {}),
    base44.entities.FamilyLink.deleteMany({ content_item_id: id }).catch(() => {}),
    base44.entities.Source.deleteMany({ entity_type: 'ContentItem', entity_id: id }).catch(() => {}),
  ]);

  // Delete the content item itself
  await base44.entities.ContentItem.delete(id);

  // Log the action
  if (actor) {
    await base44.entities.ActivityLog.create({
      action_type: 'delete',
      user_id: actor.id || null,
      user_name: actor.full_name || actor.email || 'Admin',
      content_item_id: id,
      content_item_title: item.title || '',
      description: `Deleted upload "${item.title || 'Untitled'}" from the archive`,
    }).catch(() => {});
  }

  return true;
}