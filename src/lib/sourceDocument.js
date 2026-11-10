import { base44 } from '@/api/base44Client';

const fvTagsOf = (item) => (item?.tags || []).filter((t) => /^FV-/i.test(t));
const scanRefOf = (text) => {
  const m = (text || '').match(/Scan source:\s*([^.;]+)/i);
  return m ? m[1].trim() : '';
};

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
  return { scans, transcript, reference, letters: references };
}