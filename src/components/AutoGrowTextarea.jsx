import React, { useRef } from 'react';

/**
 * A textarea that auto-grows to fit its content.
 * Height is driven by content only — NOT by focus/blur — so clicking
 * adjacent buttons (Tag, Post, Reply) never causes the textarea to
 * collapse and shift the layout, which would make clicks miss.
 */
export default function AutoGrowTextarea({
  value,
  onChange,
  rows = 2,
  expandedRows = 14,
  className = '',
  placeholder,
  ...props
}) {
  const ref = useRef(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const maxHeight = lineHeight * expandedRows;
    const minHeight = lineHeight * rows;
    el.style.height = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight) + 'px';
  };

  const handleChange = (e) => {
    if (onChange) onChange(e);
    requestAnimationFrame(resize);
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={handleChange}
      rows={rows}
      className={className}
      placeholder={placeholder}
      {...props}
    />
  );
}