import React, { useRef } from 'react';

/**
 * A textarea that expands to show all its content when focused,
 * then shrinks back to its collapsed `rows` height on blur.
 * Especially helpful on mobile where long text is otherwise hidden.
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

  const expand = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const maxHeight = lineHeight * expandedRows;
    const minHeight = lineHeight * Math.min(expandedRows, 4);
    el.style.height = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight) + 'px';
  };

  const collapse = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '';
  };

  const handleChange = (e) => {
    if (onChange) onChange(e);
    requestAnimationFrame(expand);
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={handleChange}
      onFocus={expand}
      onBlur={collapse}
      rows={rows}
      className={className}
      placeholder={placeholder}
      {...props}
    />
  );
}