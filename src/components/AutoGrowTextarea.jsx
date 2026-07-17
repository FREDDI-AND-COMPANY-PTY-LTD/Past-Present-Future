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
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  };

  const collapse = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '';
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onFocus={expand}
      onBlur={collapse}
      rows={rows}
      className={className}
      placeholder={placeholder}
      {...props}
    />
  );
}