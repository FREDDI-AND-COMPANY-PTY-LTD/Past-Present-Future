import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Crop, Check, Loader2, X, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function FocalPointEditor({ itemId, fileUrl, title, focalX, focalY, reasoning, onApprove, onClose }) {
  const [posX, setPosX] = useState(focalX);
  const [posY, setPosY] = useState(focalY);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const containerRef = useRef(null);

  const updateFromClient = useCallback((clientX, clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setPosX(x);
    setPosY(y);
    setChanged(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      if (e.touches) {
        updateFromClient(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      } else {
        updateFromClient(e.clientX, e.clientY);
      }
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

  const handleSaveOverride = async () => {
    setSaving(true);
    try {
      await base44.entities.ContentItem.update(itemId, {
        focal_point_x: posX,
        focal_point_y: posY,
      });
      onApprove();
    } catch (e) {}
    setSaving(false);
  };

  const previewStyle = { objectPosition: `${posX * 100}% ${posY * 100}%` };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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

          <div>
            <p className="text-sm text-parchment/60 mb-2">Drag the marker to set the focal point — this determines which part stays visible when the image is cropped for cards and banners.</p>
            <div className="flex justify-center">
              <div
                ref={containerRef}
                className="relative inline-block rounded-lg overflow-hidden cursor-crosshair bg-black/40 select-none"
                onMouseDown={(e) => { setDragging(true); updateFromClient(e.clientX, e.clientY); e.preventDefault(); }}
                onTouchStart={(e) => { setDragging(true); updateFromClient(e.touches[0].clientX, e.touches[0].clientY); }}
              >
                <img
                  src={fileUrl}
                  alt={title}
                  className="block max-w-full max-h-[400px] sepia-tint pointer-events-none"
                  draggable={false}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{ left: `${posX * 100}%`, top: `${posY * 100}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div className="w-10 h-10 rounded-full border-2 border-[#C9913A] bg-[rgba(201,145,58,0.15)] flex items-center justify-center gold-pulse">
                    <div className="w-2 h-2 rounded-full bg-[#E8C97A]" />
                  </div>
                  <div className="absolute top-1/2 left-1/2 w-20 h-px bg-[#C9913A]/30 -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute top-1/2 left-1/2 h-20 w-px bg-[#C9913A]/30 -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm text-parchment/60 mb-3">Preview — how this image will appear when cropped</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-parchment/40 mb-1.5">Card (3:2)</p>
                <div className="relative h-28 rounded-lg overflow-hidden bg-black/40 border border-[rgba(201,145,58,0.15)]">
                  <img src={fileUrl} alt="preview" className="w-full h-full object-cover sepia-tint" style={previewStyle} />
                </div>
              </div>
              <div>
                <p className="text-xs text-parchment/40 mb-1.5">Square</p>
                <div className="relative h-28 w-28 mx-auto rounded-lg overflow-hidden bg-black/40 border border-[rgba(201,145,58,0.15)]">
                  <img src={fileUrl} alt="preview" className="w-full h-full object-cover sepia-tint" style={previewStyle} />
                </div>
              </div>
              <div>
                <p className="text-xs text-parchment/40 mb-1.5">Banner (16:9)</p>
                <div className="relative h-28 rounded-lg overflow-hidden bg-black/40 border border-[rgba(201,145,58,0.15)]">
                  <img src={fileUrl} alt="preview" className="w-full h-full object-cover sepia-tint" style={previewStyle} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onApprove}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm font-semibold hover:bg-[rgba(201,145,58,0.08)] transition-colors"
            >
              <Check size={18} />
              {changed ? 'Approve AI Crop' : 'Approve'}
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