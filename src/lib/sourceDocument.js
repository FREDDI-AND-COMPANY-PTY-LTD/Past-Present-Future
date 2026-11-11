import { base44 } from '@/api/base44Client';
import { VOLUME_PAGE_COUNT, letterPage, scanPageToVolume } from '@/lib/correspondencePageIndex';

const fvTagsOf = (item) => (item?.tags || []).filter((t) => /^FV-/i.test(t));
// "Scan source: 003233 p.04-05." → "003233 p.04-05" — the page number must keep
// its own dot, so the reference is matched whole rather than cut at the first stop.
const scanRefOf = (text) => {
  const m = (text || '').match(/Scan source:\s*(\d{6}\s*p\.?\s*\d+(?:\s*[-–]\s*\d+)?)/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
};

const rangeLocation = (fv, range) => ({
  bundle: null,
  letter: fv,
  page: range.first,
  page2: range.last !== range.first ? range.last : null,
  volumePage: range.first,
  volumePage2: range.last !== range.first ? range.last : null,
  total: VOLUME_PAGE_COUNT,
});

/**
 * Finds the scanned originals a text-only archive record was read from, and the
 * page they sit on. The verified letter index wins; the bundle reference
 * printed on the record is the fallback.
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

  const ownReference = item.scan_reference || scanRefOf(item.description);
  const reference = ownReference || references[0]?.ref || '';

  // Verified page first — the letter code is what the scans were indexed by.
  const letterFv = fvTags.find((t) => letterPage(t));
  const range = letterFv ? letterPage(letterFv) : null;
  // A page the classifier read off the page itself beats the reference lookup.
  const location = item.scan_page
    ? { bundle: null, letter: letterFv || null, page: item.scan_page, page2: null, volumePage: item.scan_page, volumePage2: null, total: VOLUME_PAGE_COUNT }
    : range
      ? rangeLocation(letterFv, range)
      : scanPageToVolume(reference);

  if (!scans && !transcript && !location) return null;
  return { scans, transcript, reference, letter: letterFv || null, location, letters: references };
}