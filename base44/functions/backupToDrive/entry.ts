import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DRIVE_FOLDER_NAME = 'Freddi Ancestry Archive';

async function findOrCreateFolder(authHeader) {
  // Search for existing folder
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D%27${encodeURIComponent(DRIVE_FOLDER_NAME)}%27%20and%20mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse&fields=files(id,name)`,
    { headers: authHeader }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const createData = await createRes.json();
  return createData.id;
}

function guessMimeType(fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', tiff: 'image/tiff',
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
    webm: 'video/webm', mkv: 'video/x-matroska',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    const contentItem = body.data;
    if (!contentItem || !contentItem.file_url) {
      return Response.json({ status: 'skipped', reason: 'no file_url' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Find or create the backup folder
    const folderId = await findOrCreateFolder(authHeader);

    // Fetch the file from Base44 storage (server-to-server, no extra client upload)
    const fileRes = await fetch(contentItem.file_url);
    if (!fileRes.ok) {
      return Response.json({ status: 'error', reason: 'could not fetch file', code: fileRes.status });
    }
    const fileBytes = await fileRes.arrayBuffer();

    // Build a clean filename from the item title
    const safeTitle = (contentItem.title || 'untitled').replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 80);
    const urlPath = new URL(contentItem.file_url).pathname;
    const ext = urlPath.includes('.') ? urlPath.split('.').pop() : 'bin';
    const fileName = `${safeTitle}.${ext}`;
    const mimeType = guessMimeType(fileName);

    // Multipart upload to Google Drive
    const boundary = 'freddi_backup_' + Date.now();
    const metadata = {
      name: fileName,
      parents: [folderId],
      description: contentItem.description || '',
    };

    const multipartBody =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) + '\r\n' +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n` +
      '\r\n';

    const trailer = `\r\n--${boundary}--`;

    const encoder = new TextEncoder();
    const bodyBytes = new Uint8Array(
      encoder.encode(multipartBody).length + fileBytes.byteLength + encoder.encode(trailer).length
    );
    bodyBytes.set(encoder.encode(multipartBody), 0);
    bodyBytes.set(new Uint8Array(fileBytes), encoder.encode(multipartBody).length);
    bodyBytes.set(encoder.encode(trailer), encoder.encode(multipartBody).length + fileBytes.byteLength);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
      {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: bodyBytes,
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      return Response.json({ status: 'error', reason: 'drive upload failed', details: uploadData });
    }

    // Log the backup in the activity log
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'upload',
        user_id: contentItem.uploaded_by_id || null,
        user_name: 'System Backup',
        content_item_id: body.event?.entity_id || null,
        content_item_title: contentItem.title || '',
        description: `Auto-backed up "${contentItem.title}" to Google Drive (file ID: ${uploadData.id})`,
      });
    } catch (_) {}

    return Response.json({
      status: 'success',
      drive_file_id: uploadData.id,
      drive_file_name: uploadData.name,
      folder_id: folderId,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});