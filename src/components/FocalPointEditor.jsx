import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Crop, Check, Loader2, X, Sparkles, Scan, Crosshair, Maximize } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CropBoxOverlay from '@/components/CropBoxOverlay';
import CropImage from '@/components/CropImage';

const FULL = { x_min: 0, y_min: 0, x_max: 1, y_max: 1 };
const isFullFrame = (b) => !b || ((b.x_max - b.x_min) >= 0.95 && (b.y_max - b.y_min) >= 0.95);

export default function FocalPointEditor({ itemId, fileUrl, title, focalX, focalY, cropBounds, reasoning, onApprove, onClose }) {
  const [posX, setPosX] = useState(focalX);
  const [posY, setPosY] = useState(focalY);
  const [crop, setCrop] = useState(cropBounds && !isFullFrame(cropBounds) ? cropBounds : { ...FULL });
  const [mode, setMode] = useState('focal'); // 'focal' | 'crop'
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const containerRef = useRef(null);

  const updateFromClient = useCallback((clientX, clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(crop.x_min, Math.min(crop.x_max, (clientX - rect.left) / rect.width));
    const y = Math.max(crop.y_min, Math.min(crop.y_max, (clientY - rect.top) / rect.height));
    setPosX(x);
    setPosY(y);
    setChanged(true);
  }, [crop]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      if (e.touches) { updateFromClient(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }
      else updateFromClient(e.clientX, e.clientY);
    };
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, updateFromClient]);

  const handleCropChange = (next) => {
    setCrop(next);
    // Keep focal point inside the crop box
    setPosX(x => Math.max(next.x_min, Math.min(next.x_max, x)));
    setPosY(y => Math.max(next.y_min, Math.min(next.y_max, y)));
    setChanged(true);
  };

  const buildPayload = () => ({
    focal_point_x: posX,
    focal_point_y: posY,
    crop_bounds: isFullFrame(crop) ? null : crop,
  });

  const handleApprove = () => onApprove(buildPayload());

  const handleSaveOverride = async () => {
    setSaving(true);
    try {
      if (itemId) await base44.entities.ContentItem.update(itemId, buildPayload());
      onApprove(buildPayload());
    } catch (e) {}
    setSaving(false);
  };

  const liveBounds = isFullFrame(crop) ? null : crop;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
          <div className="flex items-center gap-2">
            <Crop size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Review Image Crop</h3>
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

          {/* Mode toggle */}
          <div className="flex items-center gap-2 p-1 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] w-fit">
            <button
              onClick={() => setMode('focal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'focal' ? 'bg-[rgba(201,145,58,0.15)] text-gold border border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border border-transparent'}`}
            >
              <Crosshair size={14} /> Focal Point
            </button>
            <button
              onClick={() => setMode('crop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'crop' ? 'bg-[rgba(201,145,58,0.15)] text-gold border border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border border-transparent'}`}
            >
              <Scan size={14} /> Crop Box
            </button>
          </div>

          <div>
            <p className="text-sm text-parchment/60 mb-2">
              {mode === 'focal'
                ? 'Drag the marker to set the focal point — the part that stays visible when cropped to any shape.'
                : 'Drag the gold box edges or corners to set the content borders (e.g. trim scanner borders or a frame). Drag inside the box to reposition it.'}
            </p>
            <div className="flex justify-center">
              <div
                ref={containerRef}
                className="relative inline-block rounded-lg overflow-hidden bg-black/40 select-none"
                style={{ cursor: mode === 'focal' ? 'crosshair' : 'default' }}
                onMouseDown={(e) => { if (mode === 'focal') { setDragging(true); updateFromClient(e.clientX, e.clientY); e.preventDefault(); } }}
                onTouchStart={(e) => { if (mode === 'focal') { setDragging(true); updateFromClient(e.touches[0].clientX, e.touches[0].clientY); } }}
              >
                <img src={fileUrl} alt={title} className="block max-w-full max-h-[400px] sepia-tint pointer-events-none" draggable={false} />

                {/* Crop box (always visible; editable only in crop mode) */}
                <CropBoxOverlay
                  bounds={crop}
                  onChange={handleCropChange}
                  containerRef={containerRef}
                  interactive={mode === 'crop'}
                />

                {/* Focal point marker (draggable in focal mode) */}
                {mode === 'focal' && (
                  <div
                    className="absolute pointer-events-none z-30"
                    style={{ left: `${posX * 100}%`, top: `${posY * 100}%`, transform: 'translate(-50%, -50%)' }}
                  >
                    <div className="w-10 h-10 rounded-full border-2 border-[#C9913A] bg-[rgba(201,145,58,0.15)] flex items-center justify-center gold-pulse">
                      <div className="w-2 h-2 rounded-full bg-[#E8C97A]" />
                    </div>
                    <div className="absolute top-1/2 left-1/2 w-20 h-px bg-[#C9913A]/30 -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute top-1/2 left-1/2 h-20 w-px bg-[#C9913A]/30 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                )}
              </div>
            </div>

            {mode === 'crop' && (
              <div className="flex justify-center mt-3">
                <button
                  onClick={() => { setCrop({ ...FULL }); setChanged(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors"
                >
                  <Maximize size={14} /> Reset to Full Frame
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-parchment/60 mb-3">Preview — how this image will appear when cropped</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-parchment/40 mb-1.5">Card (3:2)</p>
                <div className="h-28 rounded-lg overflow-hidden bg-black/40 border border-[rgba(201,145,58,0.15)]">
                  <CropImage src={fileUrl} alt="preview" focalX={posX} focalY={posY} cropBounds={liveBounds} className="w-full h-full" imgClassName="sepia-tint" />
                </div>
              </div>
              <div>
                <p className="text-xs text-parchment/40 mb-1.5">Square</p>
                <div className="h-28 w-28 mx-auto rounded-lg overflow-hidden bg-black/40 border border-[rgba(201,145,58,0.15)]">
                  <CropImage src={fileUrl} alt="preview" focalX={posX} focalY={posY} cropBounds={liveBounds} className="w-full h-full" imgClassName="sepia-tint" />
                </div>
              </div>
              <div>
                <p className="text-xs text-parchment/40 mb-1.5">Banner (16:9)</p>
                <div className="h-28 rounded-lg overflow-hidden bg-black/40 border border-[rgba(201,145,58,0.15)]">
                  <CropImage src={fileUrl} alt="preview" focalX={posX} focalY={posY} cropBounds={liveBounds} className="w-full h-full" imgClassName="sepia-tint" />
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
              {changed ? 'Approve Edits' : 'Approve'}
            </button>
            <button
              onClick={handleSaveOverride}
              disabled={!changed || saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              Save My Adjustment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}