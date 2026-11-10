import { base44 } from '@/api/base44Client';

const fvTagsOf = (item) => (item?.tags || []).filter((t) => /^FV-/i.test(t));
const scanRefOf = (text) => {
  const m = (text || '').match(/Scan source:\s*([^.;]+)/i);
  return m ? m[1].trim() : '';
};

/**
 * Where each scanned bundle begins inside the master scans volume.
 * The volume is the four printed bundles bound in archival order, so a bundle's
 * own page numbering restarts at p.01 — these offsets translate it to the
 * volume's page number so the viewer can open straight at the letter.
 */
const BUNDLE_START = { '003188': 1, '003204': 15, '003219': 30, '003233': 44 };
export const VOLUME_PAGE_COUNT = 57;

/** Turns a scan reference like "003233 p.04" into a page in the master volume. */
export function scanPageToVolume(reference) {
  const m = (reference || '').match(/(\d{6})\s*p\.?\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
  if (!m) return null;
  const start = BUNDLE_START[m[1]];
  if (!start) return null;
  const page = Number(m[2]);
  const page2 = m[3] ? Number(m[3]) : null;
  const clamp = (n) => Math.min(Math.max(n, 1), VOLUME_PAGE_COUNT);
  return {
    bundle: m[1],
    page,
    page2,
    volumePage: clamp(start + page - 1),
    volumePage2: page2 ? clamp(start + page2 - 1) : null,
    total: VOLUME_PAGE_COUNT,
  };
}

/**
 * Finds the scanned originals a text-only archive record was read from.
 * The correspondence letters are letters inside one scanned volume, so an
 * extracted event (or a single letter) points at that volume plus the scan
 * reference recorded on the letter, so an approver can look it up.
 */
export async function resolveSourceRecord(item) {
  if (!item || item.file_url) return null;
  const fvTags = fvTagsOf(item);

  const letters = await base44.entities.ContentItem
    .filter({ content_type: 'correspondence' }, '-created_date', 200)
    .catch(() => []);

  const volumes = (letters || []).filter((l) => l.file_url);
  const scans = volumes.find((v) => (v.tags || []).includes('scans')) || null;
  const transcript = volumes.find((v) => (v.tags || []).includes('transcript')) || null;

  const matched = (letters || []).filter((l) => fvTagsOf(l).some((t) => fvTags.includes(t)));
  const references = matched
    .map((l) => ({ fv: fvTagsOf(l)[0], title: l.title, ref: scanRefOf(l.description), id: l.id }))
    .filter((r) => r.ref);

  const ownRef = scanRefOf(item.description);
  const reference = ownRef || references[0]?.ref || '';

  if (!scans && !transcript && !reference) return null;
  return { scans, transcript, reference, letters: references, location: scanPageToVolume(reference) };
}