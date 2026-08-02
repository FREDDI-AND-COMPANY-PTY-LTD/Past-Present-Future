import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Maximize } from 'lucide-react';

const FULL = { x_min: 0, y_min: 0, x_max: 1, y_max: 1 };
const isFull = (b) => !b || ((b.x_max - b.x_min) >= 0.95 && (b.y_max - b.y_min) >= 0.95);

/**
 * Mask-and-drag cropper — a fixed-aspect mask frame with the image dragged
 * (panned) behind it and a zoom slider. Replaces the react-easy-crop integration.
 *
 * Emits the visible region via onCropComplete as { x, y, width, height } in
 * 0–100 (percent of the source image), matching the shape the crop handlers
 * already consume.
 */
export default function MaskDragCropper({ image, aspect, initialCropBounds, onCropComplete, onInteractionStart }) {
  const containerRef = useRef(null);
  const [natural, setNatural] = useState(null);
  const [size, setSize] = useState(null); // { cw, ch, maskW, maskH }
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const inited = useRef(false);

  useEffect(() => {
    if (!image) return;
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = image;
  }, [image]);

  const computeLayout = useCallback(() => {
    const el = containerRef.current;
    if (!el || !natural || aspect == null) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (!cw || !ch) return;
    let maskW, maskH;
    const containerAspect = cw / ch;
    if (aspect >= containerAspect) {
      maskW = cw;
      maskH = cw / aspect;
    } else {
      maskH = ch;
      maskW = ch * aspect;
    }
    setSize({ cw, ch, maskW, maskH });
  }, [natural, aspect]);

  useLayoutEffect(() => {
    computeLayout();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => computeLayout());
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeLayout]);

  const baseScale = () => {
    if (!size || !natural) return 0;
    return Math.max(size.maskW / natural.w, size.maskH / natural.h);
  };

  const displaySize = () => {
    const s = baseScale();
    if (!s) return null;
    return { w: natural.w * s * zoom, h: natural.h * s * zoom };
  };

  const clampOffset = (ox, oy) => {
    const d = displaySize();
    if (!d || !size) return { x: 0, y: 0 };
    const maxX = Math.max(0, (d.w - size.maskW) / 2);
    const maxY = Math.max(0, (d.h - size.maskH) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, ox)), y: Math.max(-maxY, Math.min(maxY, oy)) };
  };

  const emit = useCallback(() => {
    const d = displaySize();
    if (!d || !size || !natural) return;
    const off = clampOffset(offset.x, offset.y);
    const xMin = (d.w / 2 - size.maskW / 2 - off.x) / d.w;
    const yMin = (d.h / 2 - size.maskH / 2 - off.y) / d.h;
    const w = size.maskW / d.w;
    const h = size.maskH / d.h;
    onCropComplete?.({
      x: Math.max(0, Math.min(1, xMin)) * 100,
      y: Math.max(0, Math.min(1, yMin)) * 100,
      width: Math.min(1, w) * 100,
      height: Math.min(1, h) * 100,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, natural, zoom, offset, onCropComplete]);

  useEffect(() => { emit(); }, [emit]);

  // Restore an existing crop (re-edit) once layout + natural dims are known.
  useEffect(() => {
    if (inited.current || !size || !natural) return;
    inited.current = true;
    const b = isFull(initialCropBounds) ? FULL : initialCropBounds;
    const wNorm = Math.max(0.01, b.x_max - b.x_min);
    const hNorm = Math.max(0.01, b.y_max - b.y_min);
    const s = Math.max(size.maskW / natural.w, size.maskH / natural.h);
    const z = 1 / Math.min(wNorm, hNorm);
    const dW = natural.w * s * z;
    const dH = natural.h * s * z;
    const ox = dW * (0.5 - b.x_min) - size.maskW / 2;
    const oy = dH * (0.5 - b.y_min) - size.maskH / 2;
    setZoom(Math.min(3, Math.max(1, z)));
    const maxX = Math.max(0, (dW - size.maskW) / 2);
    const maxY = Math.max(0, (dH - size.maskH) / 2);
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, natural, initialCropBounds]);

  const startDrag = (e) => {
    onInteractionStart?.();
    const px = e.clientX ?? e.touches?.[0]?.clientX;
    const py = e.clientY ?? e.touches?.[0]?.clientY;
    if (px == null) return;
    setDrag({ x: px, y: py, offX: offset.x, offY: offset.y });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const px = e.clientX ?? e.touches?.[0]?.clientX;
      const py = e.clientY ?? e.touches?.[0]?.clientY;
      if (px == null) return;
      setOffset(() => clampOffset(drag.offX + (px - drag.x), drag.offY + (py - drag.y)));
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const reset = () => {
    onInteractionStart?.();
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const d = displaySize();
  const imgLeft = d ? (size.maskW - d.w) / 2 + offset.x : 0;
  const imgTop = d ? (size.maskH - d.h) / 2 + offset.y : 0;

  return (
    <div>
      <div ref={containerRef} className="relative w-full bg-black rounded-lg overflow-hidden select-none" style={{ height: 360 }}>
        {size && natural && d && (
          <div
            className="absolute"
            style={{ left: (size.cw - size.maskW) / 2, top: (size.ch - size.maskH) / 2, width: size.maskW, height: size.maskH }}
          >
            <div
              className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => { e.preventDefault(); startDrag(e); }}
            >
              <img
                src={image}
                alt="crop"
                draggable={false}
                className="absolute pointer-events-none sepia-tint"
                style={{ width: d.w, height: d.h, left: imgLeft, top: imgTop, maxWidth: 'none', maxHeight: 'none' }}
              />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/15 pointer-events-none" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/15 pointer-events-none" />
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/15 pointer-events-none" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/15 pointer-events-none" />
            </div>
            <div
              className="absolute inset-0 pointer-events-none border-2 border-[#C9913A]"
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)' }}
            />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-parchment/50 flex-shrink-0">Zoom</span>
        <input
          type="range" min={1} max={3} step={0.01} value={zoom}
          onChange={(e) => { onInteractionStart?.(); setZoom(Number(e.target.value)); }}
          className="flex-1 accent-[#C9913A]"
        />
        <span className="text-xs text-amber-light/70 tabular-nums w-10 text-right">{zoom.toFixed(2)}×</span>
      </div>
      <div className="flex justify-center mt-3">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors"
        >
          <Maximize size={14} /> Reset to Full Frame
        </button>
      </div>
    </div>
  );
}