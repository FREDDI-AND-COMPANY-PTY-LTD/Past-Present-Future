import React, { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Camera, X, Loader2, Check, ChevronLeft, ChevronRight } from 'lucide-react';

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

/**
 * Camera-based multi-page document capture.
 *
 * The user photographs one page at a time (rear camera on mobile). Each capture
 * is added to an ordered list. On "Complete Upload" every page is rendered to a
 * single multi-page PDF and handed to the parent's onComplete handler — which
 * feeds it through the normal AI analysis + archiving flow as one ContentItem.
 */
export default function MultiPageCameraCapture({ onComplete }) {
  const [pages, setPages] = useState([]);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const cameraRef = useRef(null);

  const capturePage = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPages(prev => [...prev, { id: `${Date.now()}-${prev.length}`, url: URL.createObjectURL(f), file: f }]);
    e.target.value = '';
  };

  const removePage = (id) => setPages(prev => prev.filter(p => p.id !== id));

  const movePage = (idx, dir) => setPages(prev => {
    const j = idx + dir;
    if (j < 0 || j >= prev.length) return prev;
    const arr = [...prev];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    return arr;
  });

  const completeUpload = async () => {
    if (pages.length === 0) return;
    setBuilding(true);
    setError('');
    try {
      const imgs = await Promise.all(pages.map(p => loadImage(p.url)));
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
        doc.addPage([im.naturalWidth, im.naturalHeight], im.naturalWidth > im.naturalHeight ? 'landscape' : 'portrait');
        doc.addImage(dataUrls[i], 'JPEG', 0, 0, im.naturalWidth, im.naturalHeight);
      }
      const blob = doc.output('blob');
      pages.forEach(p => URL.revokeObjectURL(p.url));
      const pdfFile = new File([blob], `multi-page-document-${Date.now()}.pdf`, { type: 'application/pdf' });
      onComplete(pdfFile);
    } catch (e) {
      setError('Could not build the PDF. Please try again.');
      setBuilding(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <p className="text-parchment/60 text-sm mb-4 max-w-md mx-auto">
          Capture each page of your document with the camera. Pages are combined into a single multi-page PDF when you complete the upload.
        </p>
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={building}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold hover:opacity-90 transition-opacity gold-glow disabled:opacity-50"
        >
          <Camera size={18} /> {pages.length === 0 ? 'Capture First Page' : 'Capture Next Page'}
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={capturePage} />
      </div>

      {pages.length > 0 && (
        <>
          <p className="text-xs text-parchment/40 uppercase tracking-wider mb-3">{pages.length} page{pages.length !== 1 ? 's' : ''} captured</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {pages.map((p, idx) => (
              <div key={p.id} className="aged-card rounded-xl p-2 relative">
                <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-[#0D0B0A]/80 text-xs text-gold border border-[rgba(201,145,58,0.3)]">Page {idx + 1}</span>
                <img src={p.url} alt={`page ${idx + 1}`} className="w-full h-40 object-contain rounded-lg sepia-tint" />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex gap-1">
                    <button onClick={() => movePage(idx, -1)} disabled={idx === 0} className="p-1 rounded text-parchment/50 hover:text-gold disabled:opacity-30"><ChevronLeft size={14} /></button>
                    <button onClick={() => movePage(idx, 1)} disabled={idx === pages.length - 1} className="p-1 rounded text-parchment/50 hover:text-gold disabled:opacity-30"><ChevronRight size={14} /></button>
                  </div>
                  <button onClick={() => removePage(p.id)} className="p-1 rounded text-parchment/50 hover:text-red-300"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={completeUpload}
              disabled={building}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity gold-glow flex items-center justify-center gap-2"
            >
              {building ? <><Loader2 size={20} className="animate-spin" /> Building PDF...</> : <><Check size={18} /> Complete Upload ({pages.length} page{pages.length !== 1 ? 's' : ''})</>}
            </button>
            <button
              onClick={() => setPages([])}
              disabled={building}
              className="px-5 py-3 rounded-lg border border-[rgba(245,236,215,0.15)] text-parchment/70 font-medium hover:bg-[rgba(245,236,215,0.05)] transition-colors disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-300/70 mt-4 text-center">{error}</p>}
    </div>
  );
}