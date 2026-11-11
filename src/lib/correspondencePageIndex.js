/**
 * Verified page index for the scanned correspondence volume
 * ("Freddi–Venice Correspondence — scanned originals (57 pp.)").
 *
 * Every letter was read on the scans itself and its true volume page recorded
 * below. The printed print-out bundles carry their own page numbers
 * (e.g. "003233 p.04"), but those numbers do NOT run in step with the volume
 * pages — the print-outs are pasted two to a page and each bundle restarts its
 * numbering. So the bundle arithmetic below is only a fallback, and
 * LETTER_PAGES is the authority.
 */

export const VOLUME_PAGE_COUNT = 57;

/** Where each printed bundle's p.01 actually lands in the master volume. */
export const BUNDLE_START = {
  '003219': 1,   // pages 1–13
  '003204': 14,  // pages 14–28
  '003188': 29,  // pages 29–42
  '003233': 43,  // pages 43–57
};

/**
 * FV code → [first volume page, last volume page] as read on the scans.
 * Codes with no entry (e.g. the Facebook Messenger screenshots FV-0038A–F)
 * are not part of this volume.
 */
export const LETTER_PAGES = {
  'FV-0001': [13, 13],
  'FV-0002': [12, 12],
  'FV-0003': [52, 53],
  'FV-0004': [31, 31],
  'FV-0005': [9, 11],
  'FV-0006': [9, 11],
  'FV-0007': [7, 8],
  'FV-0008': [7, 8],
  'FV-0009': [6, 6],
  'FV-0010': [3, 6],
  'FV-0011': [2, 2],
  'FV-0012': [1, 1],
  'FV-0013': [28, 28],
  'FV-0014': [28, 28],
  'FV-0015': [26, 27],
  'FV-0016': [24, 25],
  'FV-0017': [23, 23],
  'FV-0018': [17, 20],
  'FV-0019': [19, 20],
  'FV-0020': [21, 22],
  'FV-0021': [14, 16],
  'FV-0022': [14, 15],
  'FV-0023': [41, 41],
  'FV-0024': [40, 40],
  'FV-0025': [39, 39],
  'FV-0026': [38, 38],
  'FV-0027': [37, 37],
  'FV-0028': [33, 36],
  'FV-0029': [33, 36],
  'FV-0030': [32, 34],
  'FV-0031': [31, 31],
  'FV-0032': [29, 29],
  'FV-0033': [29, 30],
  'FV-0034': [51, 52],
  'FV-0035': [51, 51],
  'FV-0036': [50, 53],
  'FV-0037': [50, 53],
  'FV-0038': [47, 49],
  'FV-0039': [46, 46],
  'FV-0040': [45, 45],
  'FV-0041': [43, 43],
  'FV-0042': [43, 44],
};

const clamp = (n) => Math.min(Math.max(n, 1), VOLUME_PAGE_COUNT);

/** Turns a scan reference like "003233 p.04-05" into volume pages. */
export function scanPageToVolume(reference) {
  const m = (reference || '').match(/(\d{6})\s*p\.?\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
  if (!m) return null;
  const start = BUNDLE_START[m[1]];
  if (!start) return null;
  const page = Number(m[2]);
  const page2 = m[3] ? Number(m[3]) : null;
  return {
    bundle: m[1],
    page,
    page2,
    volumePage: clamp(start + page - 1),
    volumePage2: page2 ? clamp(start + page2 - 1) : null,
    total: VOLUME_PAGE_COUNT,
  };
}

/** Verified page range for a letter, or null when it is not in this volume. */
export function letterPage(fv) {
  const range = LETTER_PAGES[(fv || '').toUpperCase()];
  return range ? { first: range[0], last: range[1] } : null;
}