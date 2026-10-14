import React, { useState, useEffect, useRef } from 'react';

const MONTHS = [
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
];

function parseValue(value) {
  if (!value) return { day: '', month: '', year: '' };
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) };
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (m) return { day: String(Number(m[1])), month: String(Number(m[2])), year: m[3] };
  const d = new Date(value);
  if (!isNaN(d.getTime())) return { year: String(d.getFullYear()), month: String(d.getMonth() + 1), day: String(d.getDate()) };
  return { day: '', month: '', year: '' };
}

function toISO(y, mo, d) {
  if (!y || !mo || !d) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function DateSelectInput({ value, onChange, className = '' }) {
  const [parts, setParts] = useState(() => parseValue(value));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setParts(parseValue(value));
      lastEmitted.current = value;
    }
  }, [value]);

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear + 1; y >= 1850; y--) years.push(y);

  const emit = (next) => {
    setParts(next);
    const full = toISO(next.year, next.month, next.day);
    lastEmitted.current = full;
    onChange(full);
  };

  const selectClass =
    'flex-1 min-w-0 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-2 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] cursor-pointer';

  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={parts.day}
        onChange={(e) => emit({ ...parts, day: e.target.value })}
        className={selectClass}
        style={{ colorScheme: 'dark' }}
        aria-label="Day"
        data-testid="birth-day"
      >
        <option value="">Day</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select
        value={parts.month}
        onChange={(e) => emit({ ...parts, month: e.target.value })}
        className={selectClass}
        style={{ colorScheme: 'dark' }}
        aria-label="Month"
        data-testid="birth-month"
      >
        <option value="">Month</option>
        {MONTHS.map((mo) => (
          <option key={mo.value} value={mo.value}>{mo.label}</option>
        ))}
      </select>
      <select
        value={parts.year}
        onChange={(e) => emit({ ...parts, year: e.target.value })}
        className={selectClass}
        style={{ colorScheme: 'dark' }}
        aria-label="Year"
        data-testid="birth-year"
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}