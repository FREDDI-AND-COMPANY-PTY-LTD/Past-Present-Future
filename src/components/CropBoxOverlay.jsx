import React, { useState, useEffect } from 'react';

const MIN = 0.06; // minimum crop dimension (normalized)

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));

const HANDLES = [
  { key: 'nw', cursor: 'nwse-resize', pos: { left: 0, top: 0 }, offset: { x: -7, y: -7 } },
  { key: 'n', cursor: 'ns-resize', pos: { left: '50%', top: 0 }, offset: { x: -7, y: -7 } },
  { key: 'ne', cursor: 'nesw-resize', pos: { left: '100%', top: 0 }, offset: { x: -7, y: -7 } },
  { key: 'e', cursor: 'ew-resize', pos: { left: '100%', top: '50%' }, offset: { x: -7, y: -7 } },
  { key: 'se', cursor: 'nwse-resize', pos: { left: '100%', top: '100%' }, offset: { x: -7, y: -7 } },
  { key: 's', cursor: 'ns-resize', pos: { left: '50%', top: '100%' }, offset: { x: -7, y: -7 } },
  { key: 'sw', cursor: 'nesw-resize', pos: { left: 0, top: '100%' }, offset: { x: -7, y: -7 } },
  { key: 'w', cursor: 'ew-resize', pos: { left: 0, top: '50%' }, offset: { x: -7, y: -7 } },
];

/**
 * Draggable / resizable crop rectangle overlay rendered over an image.
 *
 * Props:
 *  - bounds:        { x_min, y_min, x_max, y_max } normalized 0-1
 *  - onChange:       called with new bounds on drag
 *  - containerRef:   ref of the positioned parent (the image container) — used to map
 *                    client pixel coords to normalized coords
 *  - interactive:    when false, the box is shown but not editable (pointer-events none)
 */
export default function CropBoxOverlay({ bounds, onChange, containerRef, interactive }) {
  const [drag, setDrag] = useState(null);

  const startDrag = (type, e) => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    setDrag({ type, startBounds: { ...bounds }, startClient: { x: cx, y: cy } });
  };

  useEffect(() => {
    if (!drag) return;
    const handleMove = (e) => {
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = (cx - drag.startClient.x) / rect.width;
      const dy = (cy - drag.startClient.y) / rect.height;
      const sb = drag.startBounds;
      let { x_min, y_min, x_max, y_max } = sb;
      const t = drag.type;

      if (t === 'move') {
        const w = sb.x_max - sb.x_min;
        const h = sb.y_max - sb.y_min;
        let nx = clamp(sb.x_min + dx);
        let ny = clamp(sb.y_min + dy);
        if (nx + w > 1) nx = 1 - w;
        if (ny + h > 1) ny = 1 - h;
        onChange({ x_min: nx, y_min: ny, x_max: nx + w, y_max: ny + h });
        return;
      }

      if (t.includes('w')) x_min = clamp(sb.x_min + dx, 0, sb.x_max - MIN);
      if (t.includes('e')) x_max = clamp(sb.x_max + dx, sb.x_min + MIN, 1);
      if (t.includes('n')) y_min = clamp(sb.y_min + dy, 0, sb.y_max - MIN);
      if (t.includes('s')) y_max = clamp(sb.y_max + dy, sb.y_min + MIN, 1);
      onChange({ x_min, y_min, x_max, y_max });
    };
    const handleUp = () => setDrag(null);
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
  }, [drag, containerRef, onChange]);

  const left = bounds.x_min * 100;
  const top = bounds.y_min * 100;
  const width = (bounds.x_max - bounds.x_min) * 100;
  const height = (bounds.y_max - bounds.y_min) * 100;

  return (
    <div
      className="absolute border-2 border-[#C9913A] z-20"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
        cursor: interactive ? 'move' : 'default',
        pointerEvents: interactive ? 'auto' : 'none',
        boxShadow: '0 0 0 9999px rgba(13,11,10,0.6)',
      }}
      onMouseDown={(e) => startDrag('move', e)}
      onTouchStart={(e) => startDrag('move', e)}
    >
      {/* Rule-of-thirds guides */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-0 right-0 h-px bg-[#C9913A]/20" />
        <div className="absolute top-2/3 left-0 right-0 h-px bg-[#C9913A]/20" />
        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-[#C9913A]/20" />
        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-[#C9913A]/20" />
      </div>

      {interactive && HANDLES.map(h => (
        <div
          key={h.key}
          onMouseDown={(e) => startDrag(h.key, e)}
          onTouchStart={(e) => startDrag(h.key, e)}
          className="absolute w-3.5 h-3.5 bg-[#0D0B0A] border-2 border-[#C9913A] rounded-sm z-30"
          style={{
            left: h.pos.left,
            top: h.pos.top,
            transform: `translate(${h.offset.x}px, ${h.offset.y}px)`,
            cursor: h.cursor,
          }}
        />
      ))}
    </div>
  );
}