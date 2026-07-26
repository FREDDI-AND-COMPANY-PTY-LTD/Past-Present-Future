import { jsPDF } from 'jspdf';

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// Flatten any transparency onto white (so camera PNGs/JPEGs archive cleanly)
// and emit a consistent JPEG data URL for jsPDF.
const toJpegDataUrl = (img) => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
};

// Build a single multi-page PDF from an ordered list of image sources.
// `sources` may be an array of strings (object/remote URLs) or { url } objects.
// Returns a File ready for upload.
export const buildMultiPagePdf = async (sources, namePrefix = 'multi-page-document') => {
  const urls = sources.map((s) => (typeof s === 'string' ? s : s.url)).filter(Boolean);
  if (urls.length === 0) throw new Error('No pages to build');

  const imgs = await Promise.all(urls.map(loadImage));
  const dataUrls = imgs.map(toJpegDataUrl);
  const first = imgs[0];

  const doc = new jsPDF({
    orientation: first.naturalWidth > first.naturalHeight ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [first.naturalWidth, first.naturalHeight],
  });
  doc.addImage(dataUrls[0], 'JPEG', 0, 0, first.naturalWidth, first.naturalHeight);

  for (let i = 1; i < imgs.length; i++) {
    const im = imgs[i];
    doc.addPage(
      [im.naturalWidth, im.naturalHeight],
      im.naturalWidth > im.naturalHeight ? 'landscape' : 'portrait'
    );
    doc.addImage(dataUrls[i], 'JPEG', 0, 0, im.naturalWidth, im.naturalHeight);
  }

  const blob = doc.output('blob');
  return new File([blob], `${namePrefix}-${Date.now()}.pdf`, { type: 'application/pdf' });
};