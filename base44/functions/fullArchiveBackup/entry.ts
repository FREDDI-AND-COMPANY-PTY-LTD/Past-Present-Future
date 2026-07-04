import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DRIVE_FOLDER_NAME = 'Freddi Ancestry Archive';

async function findOrCreateFolder(authHeader, name, parentId) {
  const parentQ = parentId ? `%20and%20%27${parentId}%27%20in%20parents` : '';
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D%27${encodeURIComponent(name)}%27%20and%20mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse${parentQ}&fields=files(id,name)`,
    { headers: authHeader }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
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

function sanitizeFileName(name) {
  return (name || 'untitled').replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 80).trim() || 'untitled';
}

function getExtension(url) {
  try {
    const path = new URL(url).pathname;
    return path.includes('.') ? path.split('.').pop().toLowerCase() : 'bin';
  } catch {
    return 'bin';
  }
}

async function uploadFileToDrive(authHeader, folderId, fileName, fileBytes, mimeType, description) {
  const boundary = 'freddi_backup_' + Math.random().toString(36).substring(2);
  const metadata = {
    name: fileName,
    parents: [folderId],
    ...(description ? { description } : {}),
  };

  const multipartBody =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const trailer = `\r\n--${boundary}--`;

  const encoder = new TextEncoder();
  const part1 = encoder.encode(multipartBody);
  const part3 = encoder.encode(trailer);
  const fileTyped = new Uint8Array(fileBytes);
  const bodyBytes = new Uint8Array(part1.length + fileTyped.length + part3.length);
  bodyBytes.set(part1, 0);
  bodyBytes.set(fileTyped, part1.length);
  bodyBytes.set(part3, part1.length + fileTyped.length);

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
    throw new Error(`Drive upload failed for ${fileName}`);
  }
  return uploadData;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;

    // Fetch ALL entities — complete archive, nothing omitted
    const [ancestors, contentItems, sources, comments, conflictFlags, branches, migrationRoutes, newsletters, activityLogs] = await Promise.all([
      sr.entities.Ancestor.list('-created_date', 500),
      sr.entities.ContentItem.list('-created_date', 500),
      sr.entities.Source.list('-created_date', 500),
      sr.entities.Comment.list('-created_date', 500),
      sr.entities.ConflictFlag.list('-created_date', 500),
      sr.entities.Branch.list('-created_date', 500),
      sr.entities.MigrationRoute.list('-created_date', 500),
      sr.entities.Newsletter.list('-created_date', 500),
      sr.entities.ActivityLog.list('-created_date', 500),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);

    // Build comprehensive JSON snapshot — includes ALL fields (raw AI analysis, visual elements, etc.)
    const snapshot = {
      export_date: new Date().toISOString(),
      exported_by: user.full_name || user.email,
      app: 'Jason Lewis FREDDI — Family History Archive',
      description: 'Complete archive backup — all structured data and media. This snapshot contains everything needed to reconstruct the family tree, migration map, and timeline. Your data is yours.',
      counts: {
        ancestors: (ancestors || []).length,
        content_items: (contentItems || []).length,
        sources: (sources || []).length,
        comments: (comments || []).length,
        conflict_flags: (conflictFlags || []).length,
        branches: (branches || []).length,
        migration_routes: (migrationRoutes || []).length,
        newsletters: (newsletters || []).length,
        activity_logs: (activityLogs || []).length,
      },
      data: {
        ancestors: ancestors || [],
        content_items: contentItems || [],
        sources: sources || [],
        comments: comments || [],
        conflict_flags: conflictFlags || [],
        branches: branches || [],
        migration_routes: migrationRoutes || [],
        newsletters: newsletters || [],
        activity_logs: activityLogs || [],
      },
    };

    // Get Drive connection
    let accessToken;
    try {
      const conn = await sr.connectors.getConnection('googledrive');
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({
        error: 'Google Drive is not connected. Please ask your admin to enable cloud backups.',
      }, { status: 400 });
    }
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Create dated folder structure: Freddi Ancestry Archive / Full Backup YYYY-MM-DD / media
    const rootFolderId = await findOrCreateFolder(authHeader, DRIVE_FOLDER_NAME);
    const backupFolderId = await findOrCreateFolder(authHeader, `Full Backup ${dateStr}`, rootFolderId);
    const mediaFolderId = await findOrCreateFolder(authHeader, 'media', backupFolderId);

    // Upload the complete JSON data file first (most important — media is supplementary)
    const jsonStr = JSON.stringify(snapshot, null, 2);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    await uploadFileToDrive(authHeader, backupFolderId, 'archive_data.json', jsonBytes, 'application/json', 'Complete archive data — all records, AI analysis, and metadata');

    // Collect all unique media URLs with meaningful filenames
    const mediaFiles = [];
    const seenUrls = new Set();

    const addMedia = (url, name) => {
      if (!url || seenUrls.has(url)) return;
      // Skip external video URLs (YouTube/Vimeo) — not downloadable media
      if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com')) return;
      seenUrls.add(url);
      const ext = getExtension(url);
      mediaFiles.push({ url, name: `${sanitizeFileName(name)}.${ext}` });
    };

    (contentItems || []).forEach(c => {
      if (c.file_url) addMedia(c.file_url, c.title || 'content item');
    });
    (ancestors || []).forEach(a => {
      const baseName = a.full_name || 'ancestor';
      if (a.profile_photo) addMedia(a.profile_photo, `${baseName} profile photo`);
      if (a.birth_certificate) addMedia(a.birth_certificate, `${baseName} birth certificate`);
      if (a.marriage_certificate) addMedia(a.marriage_certificate, `${baseName} marriage certificate`);
      if (a.passport_document) addMedia(a.passport_document, `${baseName} passport`);
    });
    (sources || []).forEach((s, i) => {
      if (s.document_url) addMedia(s.document_url, `source ${i + 1} ${s.document_type || 'document'}`);
    });
    (conflictFlags || []).forEach((f, i) => {
      if (f.supporting_file_url) addMedia(f.supporting_file_url, `dispute evidence ${i + 1}`);
    });
    (newsletters || []).forEach((n, i) => {
      (n.photo_urls || []).forEach((url, j) => {
        addMedia(url, `newsletter ${i + 1} photo ${j + 1}`);
      });
    });

    // Download and upload each media file
    let mediaSuccess = 0;
    let mediaFailed = 0;
    const failures = [];

    for (const media of mediaFiles) {
      try {
        const fileRes = await fetch(media.url);
        if (!fileRes.ok) {
          mediaFailed++;
          failures.push({ name: media.name, reason: `fetch returned ${fileRes.status}` });
          continue;
        }
        const fileBytes = await fileRes.arrayBuffer();
        const mimeType = guessMimeType(media.name);
        await uploadFileToDrive(authHeader, mediaFolderId, media.name, fileBytes, mimeType);
        mediaSuccess++;
      } catch (e) {
        mediaFailed++;
        failures.push({ name: media.name, reason: e.message });
      }
    }

    // Log the backup
    try {
      await sr.entities.ActivityLog.create({
        action_type: 'upload',
        user_id: user.id,
        user_name: user.full_name || user.email,
        description: `Full archive backup — ${snapshot.counts.content_items} content items, ${mediaSuccess} media files to Google Drive (Full Backup ${dateStr})`,
      });
    } catch (_) {}

    return Response.json({
      status: 'success',
      backup_date: snapshot.export_date,
      backup_folder: `Freddi Ancestry Archive / Full Backup ${dateStr}`,
      counts: snapshot.counts,
      media: {
        total: mediaFiles.length,
        success: mediaSuccess,
        failed: mediaFailed,
        failures: failures.slice(0, 10),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});