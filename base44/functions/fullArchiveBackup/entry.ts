import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DRIVE_FOLDER_NAME = 'Freddi Ancestry Archive';

// App-user connector IDs — set these after registering the workspace connectors.
// Until then, OneDrive and Dropbox members are skipped gracefully.
const CONNECTOR_IDS: Record<string, string> = {
  one_drive: '',
  dropbox: '',
};

function guessMimeType(fileName: string): string {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', tiff: 'image/tiff',
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
    webm: 'video/webm', mkv: 'video/x-matroska',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json',
  };
  return map[ext || ''] || 'application/octet-stream';
}

function sanitizeFileName(name: string): string {
  return (name || 'untitled').replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 80).trim() || 'untitled';
}

function getExtension(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.includes('.') ? path.split('.').pop()!.toLowerCase() : 'bin';
  } catch {
    return 'bin';
  }
}

// ── Google Drive helpers (shared connector) ──────────────────────────────────

async function driveFindOrCreateFolder(authHeader: Record<string, string>, name: string, parentId?: string): Promise<string> {
  const parentQ = parentId ? `%20and%20'${parentId}'%20in%20parents` : '';
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D'${encodeURIComponent(name)}'%20and%20mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse${parentQ}&fields=files(id,name)`,
    { headers: authHeader }
  );
  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) return searchData.files[0].id;
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) }),
  });
  const createData = await createRes.json();
  return createData.id;
}

async function driveUploadFile(authHeader: Record<string, string>, folderId: string, fileName: string, fileBytes: Uint8Array, mimeType: string): Promise<void> {
  const boundary = 'freddi_backup_' + Math.random().toString(36).substring(2);
  const metadata = { name: fileName, parents: [folderId] };
  const multipartBody =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const trailer = `\r\n--${boundary}--`;
  const encoder = new TextEncoder();
  const part1 = encoder.encode(multipartBody);
  const part3 = encoder.encode(trailer);
  const bodyBytes = new Uint8Array(part1.length + fileBytes.length + part3.length);
  bodyBytes.set(part1, 0);
  bodyBytes.set(fileBytes, part1.length);
  bodyBytes.set(part3, part1.length + fileBytes.length);
  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: bodyBytes,
  });
  if (!uploadRes.ok) throw new Error(`Drive upload failed for ${fileName}`);
}

async function backupToGoogleDrive(sr: any, snapshot: any, mediaFiles: any[], dateStr: string): Promise<{ mediaSuccess: number; mediaFailed: number }> {
  const { accessToken } = await sr.connectors.getConnection('googledrive');
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const rootId = await driveFindOrCreateFolder(authHeader, DRIVE_FOLDER_NAME);
  const backupId = await driveFindOrCreateFolder(authHeader, `Full Backup ${dateStr}`, rootId);
  const mediaId = await driveFindOrCreateFolder(authHeader, 'media', backupId);

  const jsonBytes = new TextEncoder().encode(JSON.stringify(snapshot, null, 2));
  await driveUploadFile(authHeader, backupId, 'archive_data.json', jsonBytes, 'application/json');

  let mediaSuccess = 0, mediaFailed = 0;
  for (const media of mediaFiles) {
    try {
      const fileRes = await fetch(media.url);
      if (!fileRes.ok) { mediaFailed++; continue; }
      const fileBytes = new Uint8Array(await fileRes.arrayBuffer());
      await driveUploadFile(authHeader, mediaId, media.name, fileBytes, guessMimeType(media.name));
      mediaSuccess++;
    } catch { mediaFailed++; }
  }
  return { mediaSuccess, mediaFailed };
}

// ── OneDrive helpers (app-user connector, Microsoft Graph) ───────────────────

async function oneDriveUploadFile(accessToken: string, folderPath: string, fileName: string, fileBytes: Uint8Array, mimeType: string): Promise<void> {
  const itemPath = `${folderPath}/${fileName}`;
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${itemPath}:/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': mimeType },
    body: fileBytes,
  });
  if (!res.ok) throw new Error(`OneDrive upload failed for ${fileName}`);
}

async function backupToOneDrive(sr: any, member: any, snapshot: any, mediaFiles: any[], dateStr: string): Promise<{ mediaSuccess: number; mediaFailed: number }> {
  const { accessToken } = await sr.connectors.getCurrentAppUserConnection(CONNECTOR_IDS.one_drive);
  const folderPath = `${member.cloud_folder_address || DRIVE_FOLDER_NAME}/Full Backup ${dateStr}`;

  const jsonBytes = new TextEncoder().encode(JSON.stringify(snapshot, null, 2));
  await oneDriveUploadFile(accessToken, folderPath, 'archive_data.json', jsonBytes, 'application/json');

  let mediaSuccess = 0, mediaFailed = 0;
  for (const media of mediaFiles) {
    try {
      const fileRes = await fetch(media.url);
      if (!fileRes.ok) { mediaFailed++; continue; }
      const fileBytes = new Uint8Array(await fileRes.arrayBuffer());
      await oneDriveUploadFile(accessToken, `${folderPath}/media`, media.name, fileBytes, guessMimeType(media.name));
      mediaSuccess++;
    } catch { mediaFailed++; }
  }
  return { mediaSuccess, mediaFailed };
}

// ── Dropbox helpers (app-user connector) ─────────────────────────────────────

async function dropboxUploadFile(accessToken: string, folderPath: string, fileName: string, fileBytes: Uint8Array): Promise<void> {
  const apiArg = JSON.stringify({ path: `${folderPath}/${fileName}`, mode: 'overwrite', autorename: true });
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': apiArg,
      'Content-Type': 'application/octet-stream',
    },
    body: fileBytes,
  });
  if (!res.ok) throw new Error(`Dropbox upload failed for ${fileName}`);
}

async function backupToDropbox(sr: any, member: any, snapshot: any, mediaFiles: any[], dateStr: string): Promise<{ mediaSuccess: number; mediaFailed: number }> {
  const { accessToken } = await sr.connectors.getCurrentAppUserConnection(CONNECTOR_IDS.dropbox);
  const folderPath = `${member.cloud_folder_address || DRIVE_FOLDER_NAME}/Full Backup ${dateStr}`;

  const jsonBytes = new TextEncoder().encode(JSON.stringify(snapshot, null, 2));
  await dropboxUploadFile(accessToken, folderPath, 'archive_data.json', jsonBytes);

  let mediaSuccess = 0, mediaFailed = 0;
  for (const media of mediaFiles) {
    try {
      const fileRes = await fetch(media.url);
      if (!fileRes.ok) { mediaFailed++; continue; }
      const fileBytes = new Uint8Array(await fileRes.arrayBuffer());
      await dropboxUploadFile(accessToken, `${folderPath}/media`, media.name, fileBytes);
      mediaSuccess++;
    } catch { mediaFailed++; }
  }
  return { mediaSuccess, mediaFailed };
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

async function buildSnapshot(sr: any) {
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

  const snapshot = {
    export_date: new Date().toISOString(),
    app: 'Jason Lewis FREDDI — Family History Archive',
    description: 'Complete archive backup — all structured data and media.',
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

  // Collect media URLs
  const mediaFiles: any[] = [];
  const seenUrls = new Set<string>();
  const addMedia = (url: string, name: string) => {
    if (!url || seenUrls.has(url)) return;
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com')) return;
    seenUrls.add(url);
    const ext = getExtension(url);
    mediaFiles.push({ url, name: `${sanitizeFileName(name)}.${ext}` });
  };

  (contentItems || []).forEach(c => { if (c.file_url) addMedia(c.file_url, c.title || 'content item'); });
  (ancestors || []).forEach(a => {
    const baseName = a.full_name || 'ancestor';
    if (a.profile_photo) addMedia(a.profile_photo, `${baseName} profile photo`);
    if (a.birth_certificate) addMedia(a.birth_certificate, `${baseName} birth certificate`);
    if (a.marriage_certificate) addMedia(a.marriage_certificate, `${baseName} marriage certificate`);
    if (a.passport_document) addMedia(a.passport_document, `${baseName} passport`);
  });
  (sources || []).forEach((s: any, i: number) => { if (s.document_url) addMedia(s.document_url, `source ${i + 1} ${s.document_type || 'document'}`); });
  (conflictFlags || []).forEach((f: any, i: number) => { if (f.supporting_file_url) addMedia(f.supporting_file_url, `dispute evidence ${i + 1}`); });
  (newsletters || []).forEach((n: any, i: number) => {
    (n.photo_urls || []).forEach((url: string, j: number) => addMedia(url, `newsletter ${i + 1} photo ${j + 1}`));
  });

  return { snapshot, mediaFiles };
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}

    const { snapshot, mediaFiles } = await buildSnapshot(sr);
    const dateStr = new Date().toISOString().slice(0, 10);

    // Get all branch members
    const branchMembers = await sr.entities.User.filter({ is_branch_member: true });

    const results: any[] = [];

    for (const member of branchMembers) {
      const provider = member.cloud_provider || 'google_drive';
      try {
        let mediaResult;
        if (provider === 'google_drive') {
          mediaResult = await backupToGoogleDrive(sr, snapshot, mediaFiles, dateStr);
        } else if (provider === 'one_drive') {
          if (!CONNECTOR_IDS.one_drive) throw new Error('OneDrive connector not configured');
          mediaResult = await backupToOneDrive(sr, member, snapshot, mediaFiles, dateStr);
        } else if (provider === 'dropbox') {
          if (!CONNECTOR_IDS.dropbox) throw new Error('Dropbox connector not configured');
          mediaResult = await backupToDropbox(sr, member, snapshot, mediaFiles, dateStr);
        } else {
          throw new Error(`Unknown provider: ${provider}`);
        }

        results.push({ member: member.email, provider, status: 'success', ...mediaResult });
      } catch (e: any) {
        results.push({ member: member.email, provider, status: 'failed', reason: e.message });
      }
    }

    // If no branch members yet (e.g. still onboarding), fall back to shared Google Drive
    if (branchMembers.length === 0) {
      try {
        const mediaResult = await backupToGoogleDrive(sr, snapshot, mediaFiles, dateStr);
        results.push({ member: 'fallback (no branch members)', provider: 'google_drive', status: 'success', ...mediaResult });
      } catch (e: any) {
        results.push({ member: 'fallback', provider: 'google_drive', status: 'failed', reason: e.message });
      }
    }

    // Log the backup
    try {
      await sr.entities.ActivityLog.create({
        action_type: 'upload',
        ...(user ? { user_id: user.id, user_name: user.full_name || user.email } : {}),
        description: `Monthly archive backup — ${branchMembers.length} branch member(s) processed (${dateStr})`,
      });
    } catch (_) {}

    return Response.json({ status: 'success', backup_date: snapshot.export_date, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});