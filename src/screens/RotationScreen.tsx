import React, { useState, useMemo } from 'react';
import { Track, RotationFilter } from '../types';
import { usePlayer } from '../context/PlayerContext';

interface RotationScreenProps {
  tracks: Track[];
  onOpenActionSheet: (track: Track) => void;
  onOpenScanner: () => void;
}

export const RotationScreen: React.FC<RotationScreenProps> = ({
  tracks,
  onOpenActionSheet,
  onOpenScanner,
}) => {
  const { playTrack, currentTrack } = usePlayer();
  const [filter, setFilter] = useState<RotationFilter>('all');

  // Filtered and ranked songs according to playCount & time window
  const rotationList = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const monthMs = 30 * 24 * 60 * 60 * 1000;

    let filtered = [...tracks];

    if (filter === 'week') {
      filtered = filtered.filter((t) => t.lastPlayedAt && now - t.lastPlayedAt <= weekMs);
    } else if (filter === 'month') {
      filtered = filtered.filter((t) => t.lastPlayedAt && now - t.lastPlayedAt <= monthMs);
    }

    // Sort by play count descending, then by lastPlayedAt
    return filtered.sort((a, b) => {
      const diff = (b.playCount || 0) - (a.playCount || 0);
      if (diff !== 0) return diff;
      return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
    });
  }, [tracks, filter]);

  const handlePlayRotation = () => {
    if (rotationList.length > 0) {
      playTrack(rotationList[0], rotationList);
    } else if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    } else {
      onOpenScanner();
    }
  };

  const handleShuffleRotation = () => {
    if (rotationList.length > 0) {
      const shuffled = [...rotationList].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    } else if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    } else {
      onOpenScanner();
    }
  };

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto px-6 pt-20 pb-44">
      {/* Header / Title Section */}
      <div className="flex flex-col mb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-on-surface">
          YOUR ROTATION
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
          The songs you keep coming back to.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handlePlayRotation}
          className="flex-1 bg-primary hover:brightness-110 text-on-primary font-semibold text-xs py-3 px-4 rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_arrow
          </span>
          <span>Play Rotation</span>
        </button>

        <button
          onClick={handleShuffleRotation}
          className="flex-1 bg-surface-container-high hover:bg-surface-variant text-on-surface font-semibold text-xs py-3 px-4 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer border border-white/[0.04]"
        >
          <span className="material-symbols-outlined text-[18px]">shuffle</span>
          <span>Shuffle Rotation</span>
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
          }`}
        >
          All Time
        </button>

        <button
          onClick={() => setFilter('month')}
          className={`px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
            filter === 'month'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
          }`}
        >
          This Month
        </button>

        <button
          onClick={() => setFilter('week')}
          className={`px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
            filter === 'week'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
          }`}
        >
          This Week
        </button>
      </div>

      {/* Ranked List of Songs */}
      <div className="flex flex-col gap-2">
        {rotationList.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant flex flex-col items-center p-6 bg-surface-container-low rounded-2xl border border-white/[0.04]">
            <span className="material-symbols-outlined text-[42px] text-surface-variant mb-2">
              autorenew
            </span>
            <p className="text-sm font-semibold text-on-surface mb-1">No songs in this rotation window</p>
            <p className="text-xs text-on-surface-variant max-w-xs">
              Play your local tracks to let Siren build your algorithmic acoustic rotation.
            </p>
          </div>
        ) : (
          rotationList.map((track, idx) => {
            const rankStr = idx + 1 < 10 ? `0${idx + 1}` : `${idx + 1}`;
            const isCurrent = currentTrack?.id === track.id;

            return (
              <div
                key={track.id}
                onClick={() => playTrack(track, rotationList)}
                className={`flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-white/[0.03] ${
                  isCurrent
                    ? 'bg-primary-container/15 border-primary-container/30'
                    : 'bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <span className="font-mono font-bold text-sm text-on-surface-variant w-6 text-center shrink-0">
                    {rankStr}
                  </span>

                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-variant shrink-0 relative shadow-inner">
                    {track.coverArtUrl ? (
                      <img src={track.coverArtUrl} alt={track.album} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[20px]">music_note</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-sm font-semibold truncate transition-colors ${
                        isCurrent ? 'text-primary-container' : 'text-on-surface group-hover:text-primary'
                      }`}
                    >
                      {track.title}
                    </span>
                    <span className="text-xs text-on-surface-variant truncate">
                      {track.artist} • {track.album}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-on-surface-variant font-mono tabular-nums">
                    {track.playCount > 1000
                      ? `${(track.playCount / 1000).toFixed(1)}k plays`
                      : `${track.playCount || 0} plays`}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenActionSheet(track);
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">more_vert</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
