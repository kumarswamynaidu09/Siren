import React from 'react';
import { usePlayer } from '../context/PlayerContext';

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    nextTrack,
    setFullScreenPlayerOpen,
  } = usePlayer();

  if (!currentTrack) {
    return (
      <div className="fixed bottom-18 inset-x-0 z-30 px-6 max-w-xl mx-auto pointer-events-none">
        <div className="bg-surface-container-high/60 backdrop-blur-xl rounded-xl p-3 flex items-center justify-between border border-white/[0.04] opacity-70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">music_note</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-medium text-on-surface">No track loaded</span>
              <span className="text-[11px] text-on-surface-variant">Choose or scan music</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px] opacity-40">play_arrow</span>
            <span className="material-symbols-outlined text-[20px] opacity-40">skip_next</span>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-18 inset-x-0 z-30 px-6 max-w-xl mx-auto">
      <div
        onClick={() => setFullScreenPlayerOpen(true)}
        className="relative overflow-hidden bg-surface-container-high/95 backdrop-blur-xl rounded-xl p-2.5 sm:p-3 flex items-center justify-between shadow-[0_4px_24px_rgba(0,0,0,0.55)] border border-white/[0.08] cursor-pointer hover:bg-surface-container-highest transition-all group"
      >
        {/* Subtle top progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/[0.05]">
          <div
            className="h-full bg-primary-container transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Left: Thumbnail & Metadata */}
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-surface-variant shrink-0 shadow-inner">
            {currentTrack.coverArtUrl ? (
              <img
                src={currentTrack.coverArtUrl}
                alt={currentTrack.album}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-surface-container to-surface-variant flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[20px]">music_note</span>
              </div>
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-primary-container animate-ping" />
              </div>
            )}
          </div>

          <div className="flex flex-col text-left min-w-0">
            <span className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
              {currentTrack.title}
            </span>
            <span className="text-xs text-on-surface-variant truncate">
              {currentTrack.artist}
            </span>
          </div>
        </div>

        {/* Right: Quick Play/Pause & Next */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:text-primary active:scale-90 transition-all cursor-pointer"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <span
              className="material-symbols-outlined text-[26px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button
            onClick={nextTrack}
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:text-primary active:scale-90 transition-all cursor-pointer"
            aria-label="Next track"
          >
            <span className="material-symbols-outlined text-[24px]">skip_next</span>
          </button>
        </div>
      </div>
    </div>
  );
};
