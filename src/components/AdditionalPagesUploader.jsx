import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Camera, Upload, X, Loader2, Check, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { buildMultiPagePdf } from '@/lib/multipagePdf';

/**
 * Lets a user append extra pages to an already-uploaded event image (the back
 * of a certificate, extra booklet pages, etc.) and combine the whole set —
 * front page first — into a single multi-page PDF for the one event.
 *
 * The primary page is passed as the original File so we render it from a local
 * object URL (no CORS canvas taint); added pages are captured via camera or
 * picked from the device. On "Combine", the PDF is handed to onComplete.
 */
export default function AdditionalPagesUploader({ primaryImageFile, onComplete, onCancel }) {
  const [pages, setPages] = useState([]);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const cameraRef = useRef(null);
  const fileRef = useRef(null);

  // Use a local object URL for the front page so the canvas never taints.
  const primaryObjectUrl = useMemo(
    () => (primaryImageFile ? URL.createObjectURL(primaryImageFile) : ''),
    [primaryImageFile]
  );
  useEffect(() => () => { if (primaryObjectUrl) URL.revokeObjectURL(primaryObjectUrl); }, [primaryObjectUrl]);

  const addPage = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPages((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, url: URL.createObjectURL(f), file: f }]);
    e.target.value = '';
  };

  const removePage = (id) =>
    setPages((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((x) => x.id !== id);
    });

  const movePage = (idx, dir) =>
    setPages((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });

  const combine = async () => {
    setBuilding(true);
    setError('');
    try {
      const pdfFile = await buildMultiPagePdf([primaryObjectUrl, ...pages], 'event-document');
      pages.forEach((p) => URL.revokeObjectURL(p.url));
      onComplete(pdfFile, pages.length + 1);
    } catch (e) {
      setError('Could not build the PDF. Please try again.');
      setBuilding(false);
    }
  };

  return (
    <div className="aged-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <FileText size={18} className="text-gold" />
        <h3 className="font-display text-lg text-parchment">Upload Additional Pages</h3>
      </div>
      <p className="text-xs text-parchment/50 mb-4 leading-relaxed">
        Add the back of a certificate, extra pages of a booklet, or any pages that belong to this same event. All pages — including the one you've already uploaded — combine into a single multi-page PDF.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="aged-card rounded-xl p-2 relative">
          <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-[#C9913A] text-xs text-charcoal font-semibold">Page 1 · Front</span>
          {primaryObjectUrl && (
            <img src={primaryObjectUrl} alt="front page" className="w-full h-40 object-contain rounded-lg sepia-tint" />
          )}
        </div>
        {pages.map((p, idx) => (
          <div key={p.id} className="aged-card rounded-xl p-2 relative">
            <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-[#0D0B0A]/80 text-xs text-gold border border-[rgba(201,145,58,0.3)]">Page {idx + 2}</span>
            <img src={p.url} alt={`page ${idx + 2}`} className="w-full h-40 object-contain rounded-lg sepia-tint" />
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

      <div className="flex flex-col sm:flex-row gap-3 mt-5">
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={building}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.25)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors disabled:opacity-50"
        >
          <Camera size={16} /> Add Page (Camera)
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={building}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.25)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors disabled:opacity-50"
        >
          <Upload size={16} /> Add Page (File)
        </button>
        <button
          onClick={onCancel}
          disabled={building}
          className="px-4 py-2.5 rounded-lg border border-[rgba(245,236,215,0.15)] text-parchment/70 text-sm font-medium hover:bg-[rgba(245,236,215,0.05)] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={addPage} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={addPage} />
      </div>

      {pages.length > 0 && (
        <button
          onClick={combine}
          disabled={building}
          className="w-full mt-4 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          {building ? (
            <><Loader2 size={18} className="animate-spin" /> Building PDF...</>
          ) : (
            <><Check size={18} /> Combine into Multi-Page PDF ({pages.length + 1} pages)</>
          )}
        </button>
      )}

      {error && <p className="text-sm text-red-300/70 mt-3 text-center">{error}</p>}
    </div>
  );
}