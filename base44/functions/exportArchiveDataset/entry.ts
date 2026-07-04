import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DRIVE_FOLDER_NAME = 'Freddi Ancestry Archive';

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  let s = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (/[",\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowsToCsv(headers, rows) {
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map(row => headers.map(h => csvEscape(row[h])).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

function ancestorRows(ancestors) {
  return (ancestors || []).map(a => ({
    full_name: a.full_name,
    birth_date: a.birth_date || '',
    birth_place: a.birth_place || '',
    death_date: a.death_date || '',
    death_place: a.death_place || '',
    nationality: a.nationality || '',
    bloodline: a.bloodline || '',
    biography: a.biography || '',
    living: a.living,
    era: a.era || '',
    mother_id: a.mother_id || '',
    father_id: a.father_id || '',
    partner_id: a.partner_id || '',
  }));
}

function contentRows(items) {
  return (items || []).map(c => ({
    title: c.title,
    content_type: c.content_type,
    date: c.date || '',
    location_name: c.location_name || '',
    latitude: c.latitude || '',
    longitude: c.longitude || '',
    description: c.description || '',
    era: c.era || '',
    transcribed_text: (c.transcribed_text || '').slice(0, 500),
    file_url: c.file_url || '',
    external_url: c.external_url || '',
    ancestor_ids: (c.ancestor_ids || []).join('; '),
    conflict_flag_status: c.conflict_flag_status || '',
    tags: (c.tags || []).join('; '),
  }));
}

function sourceRows(sources) {
  return (sources || []).map(s => ({
    entity_type: s.entity_type,
    entity_id: s.entity_id,
    field_name: s.field_name,
    source_type: s.source_type,
    validation_status: s.validation_status,
    document_type: s.document_type || '',
    document_url: s.document_url || '',
    provided_by_name: s.provided_by_name || '',
    notes: s.notes || '',
  }));
}

function commentRows(comments) {
  return (comments || []).map(c => ({
    entity_type: c.entity_type,
    entity_id: c.entity_id,
    field_name: c.field_name,
    author_name: c.author_name || '',
    content: c.content,
    parent_comment_id: c.parent_comment_id || '',
  }));
}

function conflictRows(flags) {
  return (flags || []).map(f => ({
    ancestor_id: f.ancestor_id || '',
    content_item_id: f.content_item_id || '',
    field_name: f.field_name || '',
    status: f.status,
    dispute_description: f.dispute_description,
    bloodline: f.bloodline || '',
    resolution_note: f.resolution_note || '',
  }));
}

function branchRows(branches) {
  return (branches || []).map(b => ({
    name: b.name,
    description: b.description || '',
    accent_color: b.accent_color || '',
    ancestor_id: b.ancestor_id || '',
  }));
}

function migrationRows(routes) {
  const rows = [];
  (routes || []).forEach(r => {
    (r.waypoints || []).forEach((wp, i) => {
      rows.push({
        route_name: r.name,
        bloodline: r.bloodline || '',
        waypoint_order: i + 1,
        label: wp.label || '',
        lat: wp.lat,
        lng: wp.lng,
        date: wp.date || '',
        description: wp.description || '',
      });
    });
  });
  return rows;
}

function activityRows(logs) {
  return (logs || []).map(l => ({
    action_type: l.action_type,
    user_name: l.user_name || '',
    description: l.description,
    ancestor_id: l.ancestor_id || '',
    branch_id: l.branch_id || '',
    content_item_title: l.content_item_title || '',
  }));
}

function buildCsv(dataset) {
  const sections = [
    { title: 'ANCESTORS', headers: ['full_name','birth_date','birth_place','death_date','death_place','nationality','bloodline','biography','living','era','mother_id','father_id','partner_id'], rows: dataset.ancestors },
    { title: 'CONTENT_ITEMS', headers: ['title','content_type','date','location_name','latitude','longitude','description','era','transcribed_text','file_url','external_url','ancestor_ids','conflict_flag_status','tags'], rows: dataset.content_items },
    { title: 'SOURCES', headers: ['entity_type','entity_id','field_name','source_type','validation_status','document_type','document_url','provided_by_name','notes'], rows: dataset.sources },
    { title: 'COMMENTS', headers: ['entity_type','entity_id','field_name','author_name','content','parent_comment_id'], rows: dataset.comments },
    { title: 'CONFLICT_FLAGS', headers: ['ancestor_id','content_item_id','field_name','status','dispute_description','bloodline','resolution_note'], rows: dataset.conflict_flags },
    { title: 'BRANCHES', headers: ['name','description','accent_color','ancestor_id'], rows: dataset.branches },
    { title: 'MIGRATION_WAYPOINTS', headers: ['route_name','bloodline','waypoint_order','label','lat','lng','date','description'], rows: dataset.migration },
    { title: 'ACTIVITY_LOG', headers: ['action_type','user_name','description','ancestor_id','branch_id','content_item_title'], rows: dataset.activity },
  ];

  let csv = '';
  sections.forEach((sec, idx) => {
    csv += `=== ${sec.title} ===\r\n`;
    csv += rowsToCsv(sec.headers, sec.rows);
    csv += `\r\n\r\n`;
  });
  return csv;
}

async function findOrCreateFolder(authHeader) {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D%27${encodeURIComponent(DRIVE_FOLDER_NAME)}%27%20and%20mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse&fields=files(id,name)`,
    { headers: authHeader }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const createData = await createRes.json();
  return createData.id;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const sr = base44.asServiceRole;
    const [ancestors, contentItems, sources, comments, conflictFlags, branches, migrationRoutes, activityLogs] = await Promise.all([
      sr.entities.Ancestor.list('-created_date', 500),
      sr.entities.ContentItem.list('-created_date', 500),
      sr.entities.Source.list('-created_date', 500),
      sr.entities.Comment.list('-created_date', 500),
      sr.entities.ConflictFlag.list('-created_date', 500),
      sr.entities.Branch.list('-created_date', 500),
      sr.entities.MigrationRoute.list('-created_date', 500),
      sr.entities.ActivityLog.list('-created_date', 500),
    ]);

    const dataset = {
      ancestors: ancestorRows(ancestors),
      content_items: contentRows(contentItems),
      sources: sourceRows(sources),
      comments: commentRows(comments),
      conflict_flags: conflictRows(conflictFlags),
      branches: branchRows(branches),
      migration: migrationRows(migrationRoutes),
      activity: activityRows(activityLogs),
    };

    const csv = buildCsv(dataset);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Freddi_Archive_Dataset_${dateStr}.csv`;

    // If backup requested, upload to Google Drive
    let backupResult = null;
    if (body.backup_to_drive) {
      try {
        const { accessToken } = await sr.connectors.getConnection('googledrive');
        const authHeader = { Authorization: `Bearer ${accessToken}` };
        const folderId = await findOrCreateFolder(authHeader);

        const boundary = 'freddi_dataset_' + Date.now();
        const metadata = { name: fileName, parents: [folderId] };
        const csvBytes = new TextEncoder().encode(csv);

        const multipartBody =
          `--${boundary}\r\n` +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) + '\r\n' +
          `--${boundary}\r\n` +
          'Content-Type: text/csv\r\n\r\n';

        const trailer = `\r\n--${boundary}--`;
        const encoder = new TextEncoder();
        const part1 = encoder.encode(multipartBody);
        const part3 = encoder.encode(trailer);
        const bodyBytes = new Uint8Array(part1.length + csvBytes.length + part3.length);
        bodyBytes.set(part1, 0);
        bodyBytes.set(csvBytes, part1.length);
        bodyBytes.set(part3, part1.length + csvBytes.length);

        const uploadRes = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
          {
            method: 'POST',
            headers: { ...authHeader, 'Content-Type': `multipart/related; boundary=${boundary}` },
            body: bodyBytes,
          }
        );
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) {
          backupResult = { status: 'success', drive_file_id: uploadData.id, drive_file_name: uploadData.name };
          try {
            await sr.entities.ActivityLog.create({
              action_type: 'upload',
              user_name: user.full_name || 'Admin',
              description: `Dataset backup "${fileName}" uploaded to Google Drive (file ID: ${uploadData.id})`,
            });
          } catch (_) {}
        } else {
          backupResult = { status: 'error', details: uploadData };
        }
      } catch (e) {
        backupResult = { status: 'error', details: e.message };
      }
    }

    // If download requested, return the CSV file directly
    if (body.download) {
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    }

    return Response.json({
      dataset,
      csv,
      file_name: fileName,
      backup_result: backupResult,
      counts: {
        ancestors: dataset.ancestors.length,
        content_items: dataset.content_items.length,
        sources: dataset.sources.length,
        comments: dataset.comments.length,
        conflict_flags: dataset.conflict_flags.length,
        branches: dataset.branches.length,
        migration_waypoints: dataset.migration.length,
        activity_logs: dataset.activity.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});