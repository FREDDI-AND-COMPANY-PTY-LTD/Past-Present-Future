import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Play, Pause, ChevronRight, Navigation } from 'lucide-react';

/**
 * Clickable chronological timeline of migration waypoints.
 * Users can click any waypoint to fly the map to that location,
 * or press Play to auto-advance through the migration story.
 */
export default function MigrationTimeline({ waypoints, activeIndex, onSelect }) {
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);
  const listRef = useRef(null);

  // Auto-advance through waypoints when playing
  useEffect(() => {
    if (!playing) return;
    if (activeIndex >= waypoints.length - 1) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      onSelect(activeIndex + 1);
    }, 3500);
    return () => clearTimeout(timerRef.current);
  }, [playing, activeIndex, waypoints.length, onSelect]);

  // Scroll active waypoint into view in the timeline list
  useEffect(() => {
    if (activeIndex == null || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-waypoint-idx="${activeIndex}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeIndex]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
    } else {
      if (activeIndex == null || activeIndex >= waypoints.length - 1) {
        onSelect(0);
      }
      setPlaying(true);
    }
  };

  if (waypoints.length === 0) return null;

  return (
    <div className="aged-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-lg text-parchment">Migration Journey</h3>
          <p className="text-xs text-parchment/40 mt-0.5">Follow the bloodline across the world</p>
        </div>
        <button
          onClick={togglePlay}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity gold-glow"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? 'Pause' : activeIndex != null && activeIndex > 0 ? 'Resume' : 'Play Migration'}
        </button>
      </div>

      <div ref={listRef} className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
        {waypoints.map((wp, idx) => {
          const isActive = idx === activeIndex;
          const isPast = activeIndex != null && idx < activeIndex;
          return (
            <button
              key={idx}
              data-waypoint-idx={idx}
              onClick={() => onSelect(idx)}
              className={`w-full text-left rounded-lg p-3 transition-all duration-200 border ${
                isActive
                  ? 'bg-[rgba(201,145,58,0.12)] border-[rgba(201,145,58,0.4)]'
                  : isPast
                  ? 'bg-[rgba(201,145,58,0.04)] border-transparent hover:bg-[rgba(201,145,58,0.06)]'
                  : 'bg-transparent border-transparent hover:bg-[rgba(201,145,58,0.04)]'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Numbered circle */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isActive
                    ? 'bg-[#C9913A] border-[#E8C97A] text-charcoal gold-pulse'
                    : isPast
                    ? 'bg-[rgba(201,145,58,0.2)] border-[rgba(201,145,58,0.3)] text-amber-light'
                    : 'bg-[#0D0B0A] border-[rgba(201,145,58,0.2)] text-parchment/50'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className={isActive ? 'text-gold' : 'text-parchment/30'} />
                    <p className={`text-sm font-medium ${isActive ? 'text-gold' : 'text-parchment/80'}`}>{wp.label}</p>
                  </div>
                  {wp.date && (
                    <p className="text-xs text-amber-light/60 mt-0.5">{wp.date}</p>
                  )}
                  {wp.description && (
                    <p className={`text-xs leading-relaxed mt-1 ${isActive ? 'text-parchment/70' : 'text-parchment/40'}`}>{wp.description}</p>
                  )}
                  {isActive && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-gold">
                      <Navigation size={10} /> Showing on map
                      <ChevronRight size={12} className="ml-auto" />
                    </div>
                  )}
                </div>
              </div>
              {/* Connector line */}
              {idx < waypoints.length - 1 && (
                <div className="ml-4 mt-1 h-4 w-px bg-gradient-to-b from-[rgba(201,145,58,0.3)] to-transparent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}