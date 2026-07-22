import React, { useRef } from 'react';
import { Paperclip, X, Image as ImageIcon, FileText } from 'lucide-react';

/**
 * Inline "attach a note or back-of-photo" control for comment boxes.
 * Renders an attach button plus removable file chips; the selected files
 * are uploaded and linked to the comment on submit. Context for the
 * attachment is typed directly into the comment box, so this is not an
 * event upload.
 */
export default function CommentAttachInput({ files, onChange }) {
  const inputRef = useRef(null);

  const pick = () => inputRef.current?.click();

  const onPick = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) onChange([...files, ...selected]);
    e.target.value = '';
  };

  const remove = (idx) => onChange(files.filter((_, i) => i !== idx));

  return (
    <>
      <button
        type="button"
        onClick={pick}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:border-[rgba(201,145,58,0.4)] transition-colors"
      >
        <Paperclip size={12} /> Attach {files.length > 0 && `(${files.length})`}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.doc,.docx"
        className="hidden"
        onChange={onPick}
      />
      {files.map((f, idx) => (
        <span
          key={idx}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)]"
        >
          {f.type && f.type.startsWith('image/') ? <ImageIcon size={10} /> : <FileText size={10} />}
          <span className="max-w-[140px] truncate">{f.name}</span>
          <button type="button" onClick={() => remove(idx)} className="text-parchment/30 hover:text-parchment">
            <X size={10} />
          </button>
        </span>
      ))}
    </>
  );
}