import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Crop, Check, X, Sparkles, Maximize } from 'lucide-react';
import Cropper from 'react-easy-crop';
import CropImage from '@/components/CropImage';

const FULL = { x_min: 0, y_min: 0, x_max: 1, y_max: 1 };
const isFullFrame = (b) => !b || ((b.x_max - b.x_min) >= 0.95 && (b.y_max - b.y_min) >= 0.95);

// The crop layer — frames the actual image content to save into the archive
// (e.g. trimming scanner borders, re-framing a photo). This is the uploader's
// job at upload time. The focal point (how the image displays inside the app)
// is a separate, automatic layer handled by the AI — not exposed here.
const ASPECTS = [
  { label: 'Original', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:4', value: 3 / 4 },
  { label: '9:16', value: 9 / 16 },
];

export default function CropEditor({ fileUrl, title, cropBounds, focalX, focalY, reasoning, onApprove, onClose }) {
  const [crop, setCrop] = useState(cropBounds && !isFullFrame(cropBounds) ? cropBounds : { ...FULL });
  const [naturalAspect, setNaturalAspect] = useState(null);
  const [aspect, setAspect] = useState(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(() => (cropBounds && !isFullFrame(cropBounds)) ? Math.min(2, 1 / (cropBounds.x_max - cropBounds.x_min)) : 1);
  const [changed, setChanged] = useState(false);
  const userInteracted = useRef(false);

  useEffect(() => {
    if (!fileUrl) return;
    const img = new Image();
    img.onload = () => {
      const r = img.naturalWidth / img.naturalHeight;
      setNaturalAspect(r);
      setAspect(prev => prev ?? r);
    };
    img.src = fileUrl;
  }, [fileUrl]);

  const handleCropComplete = useCallback((area) => {
    if (!userInteracted.current) return;
    const n = {
      x_min: area.x / 100, y_min: area.y / 100,
      x_max: (area.x + area.width) / 100, y_max: (area.y + area.height) / 100,
    };
    setCrop(n);
    setChanged(true);
  }, []);

  const pickAspect = (a) => {
    userInteracted.current = true;
    setAspect(a.value ?? naturalAspect ?? 1);
    setZoom(1);
    setCropPos({ x: 0, y: 0 });
  };

  const resetCrop = () => {
    setAspect(naturalAspect ?? 1);
    setZoom(1);
    setCropPos({ x: 0, y: 0 });
    setCrop({ ...FULL });
    setChanged(true);
  };

  const handleApprove = () => onApprove({
    focal_point_x: focalX,
    focal_point_y: focalY,
    crop_bounds: isFullFrame(crop) ? null : crop,
  });

  const liveBounds = isFullFrame(crop) ? null : crop;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
          <div className="flex items-center gap-2">
            <Crop size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Crop Image</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {reasoning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)]">
              <Sparkles size={14} className="text-gold flex-shrink-0 mt-0.5" />
              <p className="text-xs text-parchment/60 leading-relaxed">{reasoning}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-parchment/60 mb-2">
              Drag to reposition and pinch (or use the slider) to zoom — just like your phone photo editor. Pick an aspect ratio to frame the content. This sets what gets saved to the archive.
            </p>
            <div className="flex justify-center">
              <div className="w-full">
                <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ height: 360 }}>
                  {aspect != null && (
                    <Cropper
                      image={fileUrl}
                      crop={cropPos}
                      zoom={zoom}
                      aspect={aspect}
                      onCropChange={setCropPos}
                      onZoomChange={setZoom}
                      onCropComplete={handleCropComplete}
                      onInteractionStart={() => { userInteracted.current = true; }}
                    />
                  )}
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {ASPECTS.map(a => {
                    const val = a.value ?? naturalAspect;
                    const isActive = aspect != null && val != null && Math.abs(val - aspect) < 0.001;
                    return (
                      <button
                        key={a.label}
                        onClick={() => pickAspect(a)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isActive ? 'border-[#C9913A] bg-[rgba(201,145,58,0.1)] text-gold' : 'border-[rgba(201,145,58,0.15)] text-parchment/50 hover:border-[rgba(201,145,58,0.3)]'}`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-parchment/50 flex-shrink-0">Zoom</span>
                  <input
                    type="range" min={1} max={3} step={0.01} value={zoom}
                    onChange={(e) => { userInteracted.current = true; setZoom(Number(e.target.value)); }}
                    className="flex-1 accent-[#C9913A]"
                  />
                  <span className="text-xs text-amber-light/70 tabular-nums w-10 text-right">{zoom.toFixed(2)}×</span>
                </div>
                <div className="flex justify-center mt-3">
                  <button
                    onClick={resetCrop}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors"
                  >
                    <Maximize size={14} /> Reset to Full Frame
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm text-parchment/60 mb-3">Preview — how this image will appear</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-parchment/40 mb-1.5">Card (3:2)</p>
                <div className="h-28 rounded-lg overflow-hidden bg-black/40 border border-[rgba(201,145,58,0.15)]">
                  <CropImage src={fileUrl} alt="preview" focalX={focalX} focalY={focalY} cropBounds={liveBounds} className="w-full h-full" imgClassName="sepia-tint" />
                </div>
              </div>
              <div>
                <p className="text-xs text-parchment/40 mb-1.5">Square</p>
                <div className="h-28 w-28 mx-auto rounded-lg overflow-hidden bg-black/40 border border-[rgba(201,145,58,0.15)]">
                  <CropImage src={fileUrl} alt="preview" focalX={focalX} focalY={focalY} cropBounds={liveBounds} className="w-full h-full" imgClassName="sepia-tint" />
                </div>
              </div>
              <div>
                <p className="text-xs text-parchment/40 mb-1.5">Banner (16:9)</p>
                <div className="h-28 rounded-lg overflow-hidden bg-black/40 border border-[rgba(201,145,58,0.15)]">
                  <CropImage src={fileUrl} alt="preview" focalX={focalX} focalY={focalY} cropBounds={liveBounds} className="w-full h-full" imgClassName="sepia-tint" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleApprove}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm font-semibold hover:bg-[rgba(201,145,58,0.08)] transition-colors"
            >
              <Check size={18} />
              {changed ? 'Approve Crop' : 'Approve'}
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[rgba(245,236,215,0.05)] border border-[rgba(245,236,215,0.15)] text-parchment/70 text-sm font-medium hover:bg-[rgba(245,236,215,0.1)] hover:text-parchment transition-colors"
            >
              <X size={16} /> Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}