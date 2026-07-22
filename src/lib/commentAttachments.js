import { base44 } from '@/api/base44Client';

/**
 * Uploads files attached to a comment (a note, the back of a photograph,
 * a clipping, etc.) as lightweight ContentItems linked back to the comment
 * via related_content_item_ids.
 *
 * These are NOT event uploads — they carry no date, location, or ancestor
 * tags, and are marked 'reviewed' + tagged 'comment-attachment' so they
 * stay out of the event-intake / admin-review pipeline and never appear on
 * the timeline or migration map. Their context lives in the comment text.
 */
export async function uploadCommentAttachments(files, user) {
  const ids = [];
  for (const file of files) {
    const uploadRes = await base44.integrations.Core.UploadFile({ file });
    const item = await base44.entities.ContentItem.create({
      title: file.name,
      content_type: file.type && file.type.startsWith('image/') ? 'photo' : 'narrative',
      file_url: uploadRes.file_url,
      uploaded_by_id: user?.id || null,
      review_status: 'reviewed',
      tags: ['comment-attachment'],
    });
    ids.push(item.id);
  }
  return ids;
}