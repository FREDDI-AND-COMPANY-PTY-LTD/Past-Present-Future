import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react';

function formatTime(t) {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * In-app player for uploaded audio and video files.
 *  - video: full-width HTML5 <video> with native controls + dark styling
 *  - audio: custom compact player (play/pause, seek, volume, time)
 */
export default function MediaPlayer({ src, type = 'video', title }) {
  if (!src) return null;

  if (type === 'video') {
    return (
      <div className="w-full">
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-[70vh] bg-black rounded-xl"
          title={title}
        />
      </div>
    );
  }

  return <AudioPlayer src={src} title={title} />;
}

function AudioPlayer({ src, title }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => { setDuration(a.duration || 0); setLoading(false); };
    const onTime = () => { if (!seeking) setCurrent(a.currentTime); };
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => { setLoading(false); setPlaying(true); };
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('playing', onPlaying);
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('playing', onPlaying);
    };
  }, [seeking]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => {}); } else { a.pause(); setPlaying(false); }
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  };

  const onSeek = (e) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * duration;
    setCurrent(pct * duration);
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <audio ref={audioRef} src={src} preload="metadata" title={title} />
      <div className="aged-card rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal flex items-center justify-center hover:opacity-90 transition-opacity gold-glow"
            aria-label={playing ? 'Pause' : 'Play'}
      >
        {loading && playing ? <Loader2 size={20} className="animate-spin" /> : playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
      </button>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-parchment truncate mb-2">{title || 'Audio recording'}</p>
            {/* Seek bar */}
            <div
              onClick={onSeek}
              className="group relative h-2 rounded-full bg-[rgba(245,236,215,0.1)] cursor-pointer"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#C9913A] to-[#E8C97A]"
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#E8C97A] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-parchment/50 tabular-nums">{formatTime(current)}</span>
              <button onClick={toggleMute} className="text-parchment/50 hover:text-gold transition-colors" aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <span className="text-xs text-parchment/50 tabular-nums">{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}