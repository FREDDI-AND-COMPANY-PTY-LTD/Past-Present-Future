import React from 'react';

const COLUMN_LABELS = {
  editrequest: ['Before', 'Proposed'],
  duplicate: ['Flagged', 'Existing'],
  familylink: ['In the document', 'In the archive'],
  conflict: ['As recorded', 'As asserted'],
};

const MARK_STYLES = {
  same: { label: 'same', className: 'text-parchment/40 border-[rgba(245,236,215,0.15)]' },
  diff: { label: 'differs', className: 'text-red-300 border-red-500/30 bg-red-500/10' },
  new: { label: 'new', className: 'text-amber-light border-[rgba(201,145,58,0.3)] bg-[rgba(201,145,58,0.08)]' },
};

export default function ReviewCompare({ item, survivor, onSurvivorChange }) {
  const [leftLabel, rightLabel] = COLUMN_LABELS[item.type] || ['Left', 'Right'];
  const rows = item.compare || [];

  return (
    <div className="mt-3 rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A] p-3">
      {rows.length === 0 ? (
        <p className="text-xs text-parchment/40">No fields to compare for this record.</p>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(70px,0.8fr)_1fr_1fr] gap-2 text-[10px] uppercase tracking-wider text-parchment/30 mb-1.5">
            <span>Field</span>
            <span>{leftLabel}</span>
            <span>{rightLabel}</span>
          </div>
          <div className="space-y-1.5">
            {rows.map((r, idx) => {
              const mark = MARK_STYLES[r.mark] || MARK_STYLES.new;
              return (
                <div key={`${r.label}-${idx}`} className="grid grid-cols-[minmax(70px,0.8fr)_1fr_1fr] gap-2 items-start">
                  <span className="text-xs text-parchment/45 capitalize">{r.label}</span>
                  <span className="text-xs text-parchment/75 break-words">{r.left}</span>
                  <span className="text-xs text-parchment/75 break-words flex items-start gap-1.5">
                    <span className="flex-1">{r.right}</span>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] uppercase tracking-wide ${mark.className}`}>
                      {mark.label}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {item.survivor_options?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[rgba(201,145,58,0.12)]">
          <p className="text-[10px] uppercase tracking-wider text-parchment/40 mb-2">Surviving record to keep</p>
          <div className="space-y-1.5">
            {item.survivor_options.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-xs text-parchment/70 cursor-pointer">
                <input
                  type="radio"
                  name={`survivor-${item.id}`}
                  checked={survivor === o.id}
                  onChange={() => onSurvivorChange(o.id)}
                  className="accent-[#C9913A]"
                />
                <span className="truncate">{o.label}</span>
                {survivor === o.id && <span className="text-[10px] text-amber-light flex-shrink-0">kept</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}