// Generates a JPEG thumbnail of a PDF's first page, entirely in the browser.
// pdf.js is loaded from a CDN on first use (no npm install needed); the worker
// is configured to the matching CDN build. The returned Blob can be uploaded
// via the UploadFile integration and stored as a ContentItem.thumbnail_url.

let pdfjsPromise = null;
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

function loadPdfJs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      return resolve(window.pdfjsLib);
    }
    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.async = true;
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) return reject(new Error('pdf.js failed to load from CDN'));
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Failed to load pdf.js from CDN'));
    document.head.appendChild(script);
  });
  return pdfjsPromise;
}

/**
 * Render the first page of a PDF to a JPEG blob.
 * @param {string} pdfUrl  URL of the PDF file.
 * @param {object} opts
 * @param {number} opts.maxWidth  Target pixel width of the thumbnail (default 800).
 * @returns {Promise<Blob>} JPEG blob ready for UploadFile.
 */
export async function generatePdfThumbnail(pdfUrl, { maxWidth = 800 } = {}) {
  const pdfjsLib = await loadPdfJs();
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, Math.max(1, maxWidth / base.width));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  );
  try { await pdf.destroy(); } catch (_) {}
  if (!blob) throw new Error('Thumbnail rendering produced no image');
  return blob;
}

/**
 * Render EVERY page of a PDF to JPEG blobs (used to merge an existing PDF
 * with newly-added pages into one combined multi-page PDF).
 * @param {string} pdfUrl  URL of the PDF file.
 * @param {object} opts
 * @param {number} opts.maxWidth  Target pixel width per page (default 1400).
 * @returns {Promise<Blob[]>}  One JPEG blob per page, in order.
 */
export async function renderAllPdfPages(pdfUrl, { maxWidth = 1400 } = {}) {
  const pdfjsLib = await loadPdfJs();
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  const blobs = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, Math.max(1, maxWidth / base.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (blob) blobs.push(blob);
  }
  try { await pdf.destroy(); } catch (_) {}
  return blobs;
}

/** Quick check for whether a URL points to a directly-renderable image file. */
export function isImageUrl(url) {
  if (!url) return false;
  return /\.(jpg|jpeg|png|webp|gif|bmp)(\?|$)/i.test(url);
}

/** Quick check for whether a URL points to a PDF. */
export function isPdfUrl(url) {
  if (!url) return false;
  return /\.pdf(\?|$)/i.test(url);
}