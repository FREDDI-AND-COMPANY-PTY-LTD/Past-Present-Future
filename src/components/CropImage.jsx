import React, { useState, useRef, useLayoutEffect } from 'react';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hasBox = (b) => b && ((b.x_max - b.x_min) < 0.95 || (b.y_max - b.y_min) < 0.95);

/**
 * Renders an archive image cropped to its focal point / crop box, mirroring how
 * it appears on cards, detail pages and the hero — but computed from the image's
 * REAL pixel dimensions so the crop box can be cover-fit to the frame without
 * decapitating the subject.
 *
 * Behaviour:
 *  - No crop box: cover-fit the whole image, centre the focal point, clamp so
 *    the image edges stay in frame (head above a focal on the face stays visible).
 *  - Crop box set: cover-fit the BOX to the frame. When the box is taller than the
 *    frame (vertical overflow), anchor to the TOP of the box so the head is never
 *    clipped (chin may clip). When wider than the frame, centre the focal
 *    horizontally. When it fits, centre the focal and clamp to the box edges.
 */
export default function CropImage({
  src,
  alt = '',
  focalX = 0.5,
  focalY = 0.4,
  cropBounds,
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
    const isBox = hasBox(cropBounds);
    const bw = (box.x_max - box.x_min) * nw;
    const bh = (box.y_max - box.y_min) * nh;

    // Cover-fit the box to the frame.
    const s = Math.max(fw / bw, fh / bh);

    // Pick the visible slice (in image pixels) that centres on the focal point,
    // then clamp it inside the crop box. This honours the focal point on BOTH
    // axes and only anchors to an edge when the focal sits right at that edge —
    // so the focal point always has an effect. (Previously, tall portraits that
    // overflowed the frame vertically were force-top-anchored, which ignored
    // focal_point_y entirely — the Armando FREDDI portrait hit exactly that.)
    const sliceH = fh / s;
    let y0 = focalY * nh - sliceH / 2;
    const yTop = box.y_min * nh;
    const yBot = box.y_max * nh - sliceH;
    if (yBot >= yTop) {
      y0 = Math.max(yTop, Math.min(yBot, y0));
    } else {
      // Box shorter than the slice (guard only — s cover-fits the box): centre the box.
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
      position: 'absolute',
      left: 0,
      top: 0,
      width: `${nw}px`,
      height: `${nh}px`,
      maxWidth: 'none',
      maxHeight: 'none',
      transform: `translate(${dx}px, ${dy}px) scale(${s})`,
      transformOrigin: '0 0',
      visibility: 'visible',
    });
  };

  useLayoutEffect(() => {
    compute();
    if (!frameRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => compute());
    ro.observe(frameRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, cropBounds, focalX, focalY]);

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