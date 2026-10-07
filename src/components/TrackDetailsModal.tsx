import React, { useState, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/storage';

export const TrackDetailsModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isShuffle,
    repeatMode,
    audioWaveData,
    outputDeviceName,
    isFullScreenPlayerOpen,
    setFullScreenPlayerOpen,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seek,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite,
    setQueueDrawerOpen,
  } = usePlayer();

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const progressContainerRef = useRef<HTMLDivElement | null>(null);

  if (!isFullScreenPlayerOpen || !currentTrack) return null;

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    updateScrubPosition(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      updateScrubPosition(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      seek(scrubTime);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const updateScrubPosition = (clientX: number) => {
    if (!progressContainerRef.current || duration <= 0) return;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setScrubTime(ratio * duration);
  };

  const formatLabel = currentTrack.formatLabel || (currentTrack.lossless ? 'LOSSLESS 24-BIT' : 'HI-RES AUDIO');

  return (
    <div className="fixed inset-0 z-50 bg-[#131315] text-[#e5e1e4] flex flex-col justify-between overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-bottom duration-250">
      {/* Top App Bar */}
      <header className="sticky top-0 z-30 bg-[#131315]/90 backdrop-blur-xl border-b border-white/[0.04]">
        {/* Swipe-to-dismiss drag handle indicator */}
        <div
          onClick={() => setFullScreenPlayerOpen(false)}
          className="w-full flex justify-center pt-2.5 pb-1 cursor-pointer"
        >
          <div className="w-12 h-1.5 bg-secondary-container/50 rounded-full hover:bg-secondary-container transition-colors" />
        </div>

        <div className="h-14 max-w-md mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFullScreenPlayerOpen(false)}
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-all cursor-pointer"
              aria-label="Back to library"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back_ios_new</span>
            </button>
            <div className="flex items-center gap-2">
              <img
                alt="SIREN Logo"
                className="h-7 w-auto object-contain"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJF8zDOCGg-nk6TTb4sRFVpfHPEcF_s66kwybFzHJxbAMYIo7V3_5RxrLSuhKdME1iSlux-nsJUVktJxDANDZRTeic85OKXJsSFX7yPOV7hNUVfJXKN7J9nAmX4mGRi8cOIygV4bp4a6OJGFCG_NVfFksjovov1A0ego6SVz7D-6w-YQuLSvX1_C-RXRyX6oT1hKWEooVDEpAJzuJMrgGtncDrDPFh-X2sFNuvYMWCPpZBRLPaauVt"
              />
              <span className="font-bold tracking-tight text-sm uppercase text-on-surface">
                TRACK DETAILS
              </span>
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md mx-auto w-full px-6 py-4 flex flex-col justify-around">
        {/* Main Artwork Hero with Ambient Glow */}
        <div className="flex flex-col items-center justify-center my-3 relative">
          {/* Subtle animated audio wave ring glow */}
          <div className="absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full bg-primary-container/15 animate-acoustic-pulse blur-3xl pointer-events-none" />

          {/* Artwork Card with acoustic shadow */}
          <div className="relative w-64 h-64 sm:w-76 sm:h-76 rounded-2xl overflow-hidden shadow-2xl bg-surface-container-high transition-transform duration-300">
            {currentTrack.coverArtUrl ? (
              <img
                src={currentTrack.coverArtUrl}
                alt={currentTrack.album}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1a1a20] to-[#25242d] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-18 h-18 rounded-2xl bg-surface-container-high flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-primary text-[36px]">graphic_eq</span>
                </div>
                <span className="text-sm font-semibold text-on-surface truncate max-w-[80%]">
                  {currentTrack.title}
                </span>
                <span className="text-xs text-on-surface-variant truncate max-w-[80%] mt-1">
                  {currentTrack.artist}
                </span>
              </div>
            )}

            {/* Live glowing codec badge overlay */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface/85 backdrop-blur-md flex items-center gap-1.5 border border-white/[0.08] shadow-md">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-ping" />
              <span className="text-[10px] font-bold text-on-surface uppercase tracking-wider">
                {formatLabel}
              </span>
            </div>
          </div>

          {/* Audio Wave Spectrum Visualizer Bar */}
          <div className="flex items-end justify-center gap-1.5 h-6 mt-4 w-56">
            {audioWaveData.map((val, idx) => (
              <div
                key={idx}
                className="w-1.5 rounded-full bg-primary-container transition-all duration-100 ease-out"
                style={{
                  height: `${isPlaying ? Math.max(15, val) : 20}%`,
                  opacity: isPlaying ? 0.85 : 0.35,
                }}
              />
            ))}
          </div>
        </div>

        {/* Track Title, Artist, & Favorite Heart Button */}
        <div className="flex items-center justify-between px-2 mb-4">
          <div className="flex flex-col min-w-0 pr-4">
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface truncate">
              {currentTrack.title}
            </h1>
            <p className="text-sm text-secondary truncate mt-0.5">
              {currentTrack.artist} <span className="text-outline mx-1">•</span> {currentTrack.album}
            </p>
          </div>

          {/* Favorite / Heart Button */}
          <button
            onClick={() => toggleFavorite(currentTrack.id)}
            className={`w-12 h-12 rounded-full bg-surface-container flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
              currentTrack.isFavorite ? 'text-primary-container' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            aria-label={currentTrack.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={currentTrack.isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              favorite
            </span>
          </button>
        </div>

        {/* Progress Slider & Timestamps */}
        <div className="flex flex-col gap-2 mb-6 px-2">
          <div
            ref={progressContainerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-full h-3 py-1 flex items-center cursor-pointer group touch-none"
          >
            {/* Background Rail */}
            <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-container rounded-full transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Thumb Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-lg pointer-events-none transition-transform group-hover:scale-125"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-secondary font-mono tabular-nums">
            <span>{formatDuration(displayTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Primary Playback Controls */}
        <div className="flex items-center justify-between mb-6 px-4">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
              isShuffle ? 'text-primary-container bg-surface-container' : 'text-secondary hover:text-on-surface'
            }`}
            title="Toggle shuffle"
          >
            <span className="material-symbols-outlined text-[24px]">shuffle</span>
          </button>

          {/* Previous */}
          <button
            onClick={prevTrack}
            className="w-12 h-12 rounded-full flex items-center justify-center text-on-surface hover:text-primary active:scale-90 transition-transform cursor-pointer"
            aria-label="Previous track"
          >
            <span className="material-symbols-outlined text-[34px]">skip_previous</span>
          </button>

          {/* Large Orange Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className="w-20 h-20 rounded-full bg-primary-container text-white flex items-center justify-center shadow-xl shadow-primary-container/35 active:scale-95 hover:brightness-105 transition-all cursor-pointer"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <span
              className="material-symbols-outlined text-[42px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          {/* Next */}
          <button
            onClick={nextTrack}
            className="w-12 h-12 rounded-full flex items-center justify-center text-on-surface hover:text-primary active:scale-90 transition-transform cursor-pointer"
            aria-label="Next track"
          >
            <span className="material-symbols-outlined text-[34px]">skip_next</span>
          </button>

          {/* Repeat */}
          <button
            onClick={toggleRepeat}
            className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
              repeatMode !== 'off' ? 'text-primary-container bg-surface-container' : 'text-secondary hover:text-on-surface'
            }`}
            title={`Repeat mode: ${repeatMode}`}
          >
            <span className="material-symbols-outlined text-[24px]">
              {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
            </span>
          </button>
        </div>

        {/* Secondary Controls / Footer Action Bar */}
        <div className="flex items-center justify-between bg-surface-container-low px-4 py-3 rounded-xl border border-white/[0.04]">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <span className="material-symbols-outlined text-primary text-[20px] shrink-0">devices</span>
            <span className="text-xs font-medium text-on-surface truncate">
              {outputDeviceName}
            </span>
          </div>

          <button
            onClick={() => setQueueDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface text-xs font-medium cursor-pointer shrink-0 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">queue_music</span>
            <span>Queue</span>
          </button>
        </div>
      </main>
    </div>
  );
};
