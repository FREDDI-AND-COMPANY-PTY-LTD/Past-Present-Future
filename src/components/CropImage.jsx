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

    const vOverflow = s * bh > fh + 0.5;
    const hOverflow = s * bw > fw + 0.5;

    // Vertical position
    let dy;
    const centreY = fh / 2 - s * focalY * nh;
    if (vOverflow) {
      // Can't fit the box vertically — keep the top (head) in view.
      dy = isBox ? -s * box.y_min * nh : clamp(centreY, fh - s * nh, 0);
    } else {
      dy = clamp(centreY, fh - s * box.y_max * nh, -s * box.y_min * nh);
    }

    // Horizontal position — centre the focal point, clamp to box edges when it fits.
    const centreX = fw / 2 - s * focalX * nw;
    let dx;
    if (hOverflow) {
      dx = centreX;
    } else {
      dx = clamp(centreX, fw - s * box.x_max * nw, -s * box.x_min * nw);
    }

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