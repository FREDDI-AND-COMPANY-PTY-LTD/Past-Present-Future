import React, { useState, useRef, useLayoutEffect } from 'react';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hasBox = (b) => b && ((b.x_max - b.x_min) < 0.95 || (b.y_max - b.y_min) < 0.95);
// A meaningful subject region is bigger than a sliver (avoids a tiny AI box
// forcing an extreme zoom). Full-frame (0,0,1,1) is valid and means "the whole
// image is the subject" — frame the entire image.
const hasSubject = (b) => b && (b.x_max - b.x_min) > 0.02 && (b.y_max - b.y_min) > 0.02;

/**
 * Renders an archive image cropped to fit its frame.
 *
 * Smart framing (when subjectBounds is present): the renderer computes a crop
 * window matching the frame's aspect ratio that ENCLOSES THE ENTIRE SUBJECT
 * (all faces + bodies / salient area), so heads and bodies are never
 * decapitated when the same image is shown in a square, 16:9 banner, 9:16
 * mobile, or 4:3 card. The focal point is used only as a centre tie-breaker
 * when the window is larger than the subject. The window is clamped inside
 * the crop_bounds (inner frame) when present.
 *
 * Legacy framing (no subjectBounds): cover-fit and centre on the focal point,
 * clamped to the crop box — the original behaviour, used for records that
 * predate smart-crop or that a human has manually overridden.
 */
export default function CropImage({
  src,
  alt = '',
  focalX = 0.5,
  focalY = 0.4,
  cropBounds,
  subjectBounds,
  className = 'w-full h-full',
  imgClassName = '',
}) {
  const frameRef = useRef(null);
  const [natural, setNatural] = useState(null);
  const [style, setStyle] = useState({ visibility: 'hidden' });

  const compute = () => {
    if (!natural || !frameRef.current) return;
    const fw = frameRef.current.clientWidth;
    const fh = frameRef.current.clientHeight;
    if (!fw || !fh) return;
    const nw = natural.w;
    const nh = natural.h;

    const box = hasBox(cropBounds) ? cropBounds : { x_min: 0, y_min: 0, x_max: 1, y_max: 1 };
    const effX0 = box.x_min * nw, effX1 = box.x_max * nw;
    const effY0 = box.y_min * nh, effY1 = box.y_max * nh;

    // ── Subject-region smart framing ──
    if (hasSubject(subjectBounds)) {
      const R = fw / fh;
      // Subject in pixels, clamped to the effective (inner-frame) bounds
      const sx0 = Math.max(effX0, subjectBounds.x_min * nw);
      const sx1 = Math.min(effX1, subjectBounds.x_max * nw);
      const sy0 = Math.max(effY0, subjectBounds.y_min * nh);
      const sy1 = Math.min(effY1, subjectBounds.y_max * nh);
      const sw = Math.max(1, sx1 - sx0);
      const sh = Math.max(1, sy1 - sy0);

      // Smallest window of aspect R that contains the whole subject
      let winW = Math.max(sw, sh * R);
      let winH = winW / R;
      // Cap to the effective bounds (an extreme aspect mismatch may clip the
      // subject — unavoidable when the subject's own aspect is far from R)
      const maxW = effX1 - effX0;
      const maxH = effY1 - effY0;
      if (winW > maxW) { winW = maxW; winH = winW / R; }
      if (winH > maxH) { winH = maxH; winW = winH * R; }

      // Centre on the focal point, then keep the subject contained, then
      // keep the window inside the effective bounds.
      const fxPx = clamp(focalX, 0, 1) * nw;
      const fyPx = clamp(focalY, 0, 1) * nh;
      let wx0 = fxPx - winW / 2;
      let wy0 = fyPx - winH / 2;
      if (winW >= sw) wx0 = clamp(wx0, sx1 - winW, sx0); else wx0 = (sx0 + sx1) / 2 - winW / 2;
      if (winH >= sh) wy0 = clamp(wy0, sy1 - winH, sy0); else wy0 = (sy0 + sy1) / 2 - winH / 2;
      wx0 = clamp(wx0, effX0, Math.max(effX0, effX1 - winW));
      wy0 = clamp(wy0, effY0, Math.max(effY0, effY1 - winH));

      const s = fw / winW;
      setStyle({
        position: 'absolute', left: 0, top: 0,
        width: `${nw}px`, height: `${nh}px`,
        maxWidth: 'none', maxHeight: 'none',
        transform: `translate(${-s * wx0}px, ${-s * wy0}px) scale(${s})`,
        transformOrigin: '0 0', visibility: 'visible',
      });
      return;
    }

    // ── Legacy focal-point framing ──
    const bw = (box.x_max - box.x_min) * nw;
    const bh = (box.y_max - box.y_min) * nh;
    const s = Math.max(fw / bw, fh / bh);

    const sliceH = fh / s;
    let y0 = focalY * nh - sliceH / 2;
    const yTop = box.y_min * nh;
    const yBot = box.y_max * nh - sliceH;
    if (yBot >= yTop) {
      y0 = Math.max(yTop, Math.min(yBot, y0));
    } else {
      y0 = ((box.y_min + box.y_max) / 2) * nh - sliceH / 2;
    }
    const dy = -s * y0;

    const sliceW = fw / s;
    let x0 = focalX * nw - sliceW / 2;
    const xLeft = box.x_min * nw;
    const xRight = box.x_max * nw - sliceW;
    if (xRight >= xLeft) {
      x0 = Math.max(xLeft, Math.min(xRight, x0));
    } else {
      x0 = ((box.x_min + box.x_max) / 2) * nw - sliceW / 2;
    }
    const dx = -s * x0;

    setStyle({
      position: 'absolute', left: 0, top: 0,
      width: `${nw}px`, height: `${nh}px`,
      maxWidth: 'none', maxHeight: 'none',
      transform: `translate(${dx}px, ${dy}px) scale(${s})`,
      transformOrigin: '0 0', visibility: 'visible',
    });
  };

  useLayoutEffect(() => {
    compute();
    if (!frameRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => compute());
    ro.observe(frameRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, cropBounds, subjectBounds, focalX, focalY]);

  return (
    <div ref={frameRef} className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        draggable={false}
        onLoad={(e) => setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
        style={style}
      />
    </div>
  );
}