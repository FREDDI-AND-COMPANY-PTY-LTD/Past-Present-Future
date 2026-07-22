import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DRIVE_FOLDER_NAME = 'Freddi Ancestry Archive';

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

async function backupToGoogleDrive(sr: any, snapshot: any, mediaFiles: any[], dateStr: string, label?: string): Promise<{ mediaSuccess: number; mediaFailed: number }> {
  const { accessToken } = await sr.connectors.getConnection('googledrive');
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const rootId = await driveFindOrCreateFolder(authHeader, DRIVE_FOLDER_NAME);
  const folderName = label ? `${label} Backup ${dateStr}` : `Full Backup ${dateStr}`;
  const backupId = await driveFindOrCreateFolder(authHeader, folderName, rootId);
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

// ── Branch scoping ────────────────────────────────────────────────────────────

// BFS over ancestors from the given root IDs: blood descendants + partners married in.
function computeDescendants(ancestors: any[], rootIds: string[]): Set<string> {
  const idSet = new Set(rootIds.filter(Boolean));
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of ancestors) {
      if (idSet.has(a.id)) continue;
      if ((a.mother_id && idSet.has(a.mother_id)) || (a.father_id && idSet.has(a.father_id))) {
        idSet.add(a.id);
        changed = true;
      }
    }
  }
  for (const a of ancestors) {
    if (idSet.has(a.id) && a.partner_id) idSet.add(a.partner_id);
  }
  return idSet;
}

// ── Snapshot builder ────────────────────────────────────────────────────────────

// When `scope` is provided, filters every record set to only those belonging to
// the branch admin's branch(es): descendants of the branch root + content tagged
// to the branch. When omitted, exports the full archive (global admin / builder).
async function buildSnapshot(sr: any, scope?: { branchIds: string[]; descIds: Set<string> }) {
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

  let dAncestors = ancestors || [];
  let dContent = contentItems || [];
  let dSources = sources || [];
  let dComments = comments || [];
  let dFlags = conflictFlags || [];
  let dBranches = branches || [];
  let dRoutes = migrationRoutes || [];
  let dNewsletters = newsletters || [];
  let dLogs = activityLogs || [];
  let scopedLabel: string | undefined;

  if (scope) {
    const { branchIds, descIds } = scope;
    const branchContentIds = new Set(
      (contentItems || []).filter((i: any) =>
        branchIds.includes(i.branch_id) || (i.ancestor_ids || []).some((aid: string) => descIds.has(aid))
      ).map((i: any) => i.id)
    );
    const inAncestor = (id: string) => !!id && descIds.has(id);
    const inContent = (id: string) => !!id && branchContentIds.has(id);

    dAncestors = (ancestors || []).filter((a: any) => descIds.has(a.id));
    dContent = (contentItems || []).filter((i: any) => branchContentIds.has(i.id));
    dSources = (sources || []).filter((s: any) =>
      (s.entity_type === 'Ancestor' && inAncestor(s.entity_id)) ||
      (s.entity_type === 'ContentItem' && inContent(s.entity_id))
    );
    dComments = (comments || []).filter((c: any) =>
      (c.entity_type === 'Ancestor' && inAncestor(c.entity_id)) ||
      (c.entity_type === 'ContentItem' && inContent(c.entity_id))
    );
    dFlags = (conflictFlags || []).filter((f: any) =>
      inAncestor(f.ancestor_id) || inContent(f.content_item_id)
    );
    dBranches = (branches || []).filter((b: any) => branchIds.includes(b.id));
    dRoutes = (migrationRoutes || []).filter((r: any) => !r.ancestor_id || inAncestor(r.ancestor_id));
    dNewsletters = (newsletters || []).filter((n: any) =>
      (n.featured_item_ids || []).some((id: string) => branchContentIds.has(id))
    );
    dLogs = (activityLogs || []).filter((l: any) =>
      (l.branch_id && branchIds.includes(l.branch_id)) ||
      inAncestor(l.ancestor_id) || inContent(l.content_item_id)
    );
    scopedLabel = 'branch-scoped';
  }

  const snapshot = {
    export_date: new Date().toISOString(),
    app: 'Jason Lewis FREDDI — Family History Archive',
    description: scope
      ? 'Branch-scoped backup — only this branch admin\'s records.'
      : 'Complete archive backup — all structured data and media.',
    scope: scopedLabel || 'full-archive',
    counts: {
      ancestors: dAncestors.length,
      content_items: dContent.length,
      sources: dSources.length,
      comments: dComments.length,
      conflict_flags: dFlags.length,
      branches: dBranches.length,
      migration_routes: dRoutes.length,
      newsletters: dNewsletters.length,
      activity_logs: dLogs.length,
    },
    data: {
      ancestors: dAncestors,
      content_items: dContent,
      sources: dSources,
      comments: dComments,
      conflict_flags: dFlags,
      branches: dBranches,
      migration_routes: dRoutes,
      newsletters: dNewsletters,
      activity_logs: dLogs,
    },
  };

  // Collect media URLs from scoped records only
  const mediaFiles: any[] = [];
  const seenUrls = new Set<string>();
  const addMedia = (url: string, name: string) => {
    if (!url || seenUrls.has(url)) return;
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com')) return;
    seenUrls.add(url);
    const ext = getExtension(url);
    mediaFiles.push({ url, name: `${sanitizeFileName(name)}.${ext}` });
  };

  dContent.forEach((c: any) => { if (c.file_url) addMedia(c.file_url, c.title || 'content item'); });
  dAncestors.forEach((a: any) => {
    const baseName = a.full_name || 'ancestor';
    if (a.profile_photo) addMedia(a.profile_photo, `${baseName} profile photo`);
    if (a.birth_certificate) addMedia(a.birth_certificate, `${baseName} birth certificate`);
    if (a.marriage_certificate) addMedia(a.marriage_certificate, `${baseName} marriage certificate`);
    if (a.passport_document) addMedia(a.passport_document, `${baseName} passport`);
  });
  dSources.forEach((s: any, i: number) => { if (s.document_url) addMedia(s.document_url, `source ${i + 1} ${s.document_type || 'document'}`); });
  dFlags.forEach((f: any, i: number) => { if (f.supporting_file_url) addMedia(f.supporting_file_url, `dispute evidence ${i + 1}`); });
  dNewsletters.forEach((n: any, i: number) => {
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

    const dateStr = new Date().toISOString().slice(0, 10);
    const results: any[] = [];

    const [allBranches, allAncestors] = await Promise.all([
      sr.entities.Branch.list('-created_date', 500).catch(() => []),
      sr.entities.Ancestor.list('-created_date', 500).catch(() => []),
    ]);
    const isAdmin = user?.role === 'admin';

    if (user) {
      // Invoked by a user — branch-admin scoping
      const myBranches = (allBranches || []).filter((b: any) => b.admin_user_id && b.admin_user_id === user.id);
      if (myBranches.length > 0) {
        // Branch admin — scoped backup of their branch(es) only
        const branchIds = myBranches.map((b: any) => b.id);
        const rootIds = myBranches.map((b: any) => b.ancestor_id).filter(Boolean);
        const descIds = computeDescendants(allAncestors || [], rootIds);
        const label = myBranches.map((b: any) => sanitizeFileName(b.name)).join('_');
        const { snapshot, mediaFiles } = await buildSnapshot(sr, { branchIds, descIds });
        try {
          const r = await backupToGoogleDrive(sr, snapshot, mediaFiles, dateStr, label);
          results.push({ target: `branch: ${label}`, status: 'success', ...r });
        } catch (e: any) {
          results.push({ target: `branch: ${label}`, status: 'failed', reason: e.message });
        }
      } else if (!isAdmin) {
        // Visitor / non-member — no backup of a host branch
        return Response.json({ status: 'skipped', reason: 'no branch admin rights — visitors receive no backup' });
      } else {
        // Global admin with no branch claim — full archive backup
        const { snapshot, mediaFiles } = await buildSnapshot(sr);
        try {
          const r = await backupToGoogleDrive(sr, snapshot, mediaFiles, dateStr);
          results.push({ target: 'admin Google Drive (full archive)', status: 'success', ...r });
        } catch (e: any) {
          results.push({ target: 'admin Google Drive', status: 'failed', reason: e.message });
        }
      }
    } else {
      // Scheduled (no user) — full archive backup for the builder, plus a
      // branch-scoped backup for every branch admin (each gets only their own branch).
      const { snapshot, mediaFiles } = await buildSnapshot(sr);
      try {
        const r = await backupToGoogleDrive(sr, snapshot, mediaFiles, dateStr);
        results.push({ target: 'admin Google Drive (full archive)', status: 'success', ...r });
      } catch (e: any) {
        results.push({ target: 'admin Google Drive', status: 'failed', reason: e.message });
      }

      const byAdmin = new Map<string, any[]>();
      for (const b of (allBranches || [])) {
        if (!b.admin_user_id) continue;
        if (!byAdmin.has(b.admin_user_id)) byAdmin.set(b.admin_user_id, []);
        byAdmin.get(b.admin_user_id)!.push(b);
      }
      for (const [, adminBranches] of byAdmin) {
        try {
          const branchIds = adminBranches.map((b: any) => b.id);
          const rootIds = adminBranches.map((b: any) => b.ancestor_id).filter(Boolean);
          const descIds = computeDescendants(allAncestors || [], rootIds);
          const label = adminBranches.map((b: any) => sanitizeFileName(b.name)).join('_');
          const { snapshot, mediaFiles } = await buildSnapshot(sr, { branchIds, descIds });
          const r = await backupToGoogleDrive(sr, snapshot, mediaFiles, dateStr, label);
          results.push({ target: `branch: ${label}`, status: 'success', ...r });
        } catch (e: any) {
          results.push({ target: 'branch backup', status: 'failed', reason: e.message });
        }
      }
    }

    // Log the backup
    try {
      await sr.entities.ActivityLog.create({
        action_type: 'upload',
        ...(user ? { user_id: user.id, user_name: user.full_name || user.email } : {}),
        description: `Monthly archive backup (${dateStr}) — ${results.length} target(s)`,
      });
    } catch (_) {}

    return Response.json({ status: 'success', backup_date: new Date().toISOString(), results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});