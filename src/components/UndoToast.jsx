import React, { useState, useEffect, useRef } from 'react';
import { Undo, X } from 'lucide-react';

/**
 * A toast notification with an Undo button and a depleting progress bar.
 * Auto-dismisses after `duration` ms. Calls onUndo when the Undo button is clicked.
 */
export default function UndoToast({ message, onUndo, onDismiss, duration = 10000 }) {
  const [remaining, setRemaining] = useState(duration);
  const intervalRef = useRef(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(intervalRef.current);
        onDismiss();
      }
    }, 50);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleUndo = () => {
    clearInterval(intervalRef.current);
    onUndo();
  };

  const handleDismiss = () => {
    clearInterval(intervalRef.current);
    onDismiss();
  };

  const progress = (remaining / duration) * 100;

  return (
    <div className="aged-card rounded-xl p-4 shadow-2xl flex items-center gap-3 min-w-[280px] max-w-sm animate-fade-in-up">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-parchment truncate">{message}</p>
        <div className="mt-2 h-1 rounded-full bg-[rgba(201,145,58,0.1)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#C9913A] to-[#E8C97A] transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <button
        onClick={handleUndo}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
      >
        <Undo size={14} /> Undo
      </button>
      <button
        onClick={handleDismiss}
        className="text-parchment/30 hover:text-parchment transition-colors flex-shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}