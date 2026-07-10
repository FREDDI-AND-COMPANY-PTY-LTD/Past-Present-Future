import React, { useState, useRef, useEffect } from 'react';

/**
 * Textarea with @-mention autocomplete.
 * Typing "@" triggers a dropdown of registered users (excluding the current user).
 * Selecting a user inserts "@Full Name" into the text and adds their ID to taggedUserIds.
 */
export default function MentionTextarea({
  value,
  onChange,
  onTaggedUsersChange,
  taggedUserIds,
  users,
  currentUser,
  placeholder,
  rows = 3,
  className = '',
}) {
  const textareaRef = useRef(null);
  const [mentionQuery, setMentionQuery] = useState(null); // { startIndex, search }
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Detect @ mention in the text as the user types
  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);

    const caretPos = e.target.selectionStart;
    const textBeforeCaret = newValue.slice(0, caretPos);

    // Find the last "@" that starts a potential mention
    const lastAt = textBeforeCaret.lastIndexOf('@');
    if (lastAt === -1) {
      setMentionQuery(null);
      return;
    }

    // The text after "@" up to the caret must be a single word (no spaces) to still be a mention
    const textAfterAt = textBeforeCaret.slice(lastAt + 1);
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
      setMentionQuery(null);
      return;
    }

    // Ensure the "@" is at start or preceded by whitespace
    const charBefore = lastAt > 0 ? textBeforeCaret[lastAt - 1] : ' ';
    if (!/\s/.test(charBefore) && lastAt !== 0) {
      setMentionQuery(null);
      return;
    }

    setMentionQuery({ startIndex: lastAt, search: textAfterAt.toLowerCase() });
    setHighlightedIndex(0);
  };

  // Filter users based on the mention search text
  const otherUsers = users.filter(u => u.id !== currentUser?.id);
  const filteredMentions = mentionQuery
    ? otherUsers.filter(u => {
        const name = (u.full_name || u.email || '').toLowerCase();
        return name.includes(mentionQuery.search);
      }).slice(0, 6)
    : [];

  // Insert a mention: replace the "@query" with "@Full Name" and tag the user
  const insertMention = (mentionedUser) => {
    if (!mentionQuery) return;
    const before = value.slice(0, mentionQuery.startIndex);
    const after = value.slice(mentionQuery.startIndex + 1 + mentionQuery.search.length);
    const displayName = mentionedUser.full_name || mentionedUser.email;
    const newValue = `${before}@${displayName} ${after}`;
    onChange(newValue);

    // Add to tagged users
    if (!taggedUserIds.includes(mentionedUser.id)) {
      onTaggedUsersChange([...taggedUserIds, mentionedUser.id]);
    }

    setMentionQuery(null);
    // Restore focus after React re-renders
    setTimeout(() => {
      if (textareaRef.current) {
        const newCaret = before.length + displayName.length + 2; // @name + space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCaret, newCaret);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (!mentionQuery || filteredMentions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % filteredMentions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredMentions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setMentionQuery(null);
    }
  };

  const handleBlur = () => {
    // Delay to allow click on mention dropdown
    setTimeout(() => setMentionQuery(null), 150);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        rows={rows}
        className={className}
        placeholder={placeholder}
      />
      {mentionQuery && filteredMentions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.25)] bg-[#1A1614] shadow-2xl">
          {filteredMentions.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${i === highlightedIndex ? 'bg-[rgba(201,145,58,0.12)]' : 'hover:bg-[rgba(201,145,58,0.06)]'}`}
            >
              <div className="w-6 h-6 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-xs text-gold flex-shrink-0">
                {(u.full_name || u.email).charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-parchment truncate">{u.full_name || u.email}</p>
                {u.email && u.full_name && <p className="text-xs text-parchment/40 truncate">{u.email}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}