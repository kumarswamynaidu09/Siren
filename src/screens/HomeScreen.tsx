import React from 'react';
import { Track, NavTab } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { UserProfile, formatFileSize, formatRelativeDate } from '../utils/storage';

interface HomeScreenProps {
  tracks: Track[];
  userProfile: UserProfile;
  onOpenScanner: () => void;
  onSelectTab: (tab: NavTab) => void;
  onOpenActionSheet: (track: Track) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  tracks,
  userProfile,
  onOpenScanner,
  onSelectTab,
  onOpenActionSheet,
}) => {
  const { playTrack } = usePlayer();

  // Greeting based on real local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Recently played tracks (filtered by lastPlayedAt, ordered descending)
  const recentlyPlayed = [...tracks]
    .filter((t) => t.lastPlayedAt !== null)
    .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));

  // Fallback to recently added if none played yet
  const displayCarousel = recentlyPlayed.length > 0 ? recentlyPlayed.slice(0, 10) : tracks.slice(0, 10);

  // Your rotation tracks (ordered by playCount descending)
  const rotationTracks = [...tracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 5);

  // Recently added files
  const recentlyAdded = [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 6);

  // Quick action: Shuffle All
  const handleShuffleAll = () => {
    if (tracks.length === 0) {
      onOpenScanner();
      return;
    }
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled);
  };

  // Quick action: Play Rotation
  const handlePlayRotation = () => {
    if (tracks.length === 0) {
      onOpenScanner();
      return;
    }
    const ranked = [...tracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    playTrack(ranked[0], ranked);
  };

  // Quick action: Play Recently Played
  const handlePlayRecent = () => {
    if (recentlyPlayed.length > 0) {
      playTrack(recentlyPlayed[0], recentlyPlayed);
    } else if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    } else {
      onOpenScanner();
    }
  };

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto px-6 pt-20 pb-44 gap-8">
      {/* Greeting Header */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-on-surface-variant">{getGreeting()}</span>
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
          {userProfile.name || 'Kumar'}
        </h1>
      </div>

      {/* Quick Actions Pills */}
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={handleShuffleAll}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-container text-white rounded-full text-xs font-semibold shrink-0 shadow-lg shadow-primary-container/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            shuffle
          </span>
          <span>Shuffle All</span>
        </button>

        <button
          onClick={handlePlayRotation}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-surface-container-high text-on-surface rounded-full text-xs font-semibold shrink-0 hover:bg-surface-variant active:scale-[0.98] transition-all cursor-pointer border border-white/[0.04]"
        >
          <span className="material-symbols-outlined text-[18px]">autorenew</span>
          <span>Play Rotation</span>
        </button>

        <button
          onClick={handlePlayRecent}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-surface-container-high text-on-surface rounded-full text-xs font-semibold shrink-0 hover:bg-surface-variant active:scale-[0.98] transition-all cursor-pointer border border-white/[0.04]"
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          <span>Recently Played</span>
        </button>
      </div>

      {/* Section: Recently Played */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">Recently Played</h2>
          <span
            onClick={() => onSelectTab('library')}
            className="text-xs text-primary font-medium cursor-pointer hover:underline"
          >
            See all
          </span>
        </div>

        {displayCarousel.length === 0 ? (
          <div className="p-6 rounded-2xl bg-surface-container-low text-center border border-white/[0.04]">
            <p className="text-xs text-on-surface-variant">No played tracks yet.</p>
          </div>
        ) : (
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
            {displayCarousel.map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, tracks)}
                className="flex flex-col gap-2 w-38 shrink-0 group cursor-pointer"
              >
                <div className="relative w-38 h-38 rounded-2xl overflow-hidden bg-surface-container-high shadow-md border border-white/[0.06]">
                  {track.coverArtUrl ? (
                    <img
                      src={track.coverArtUrl}
                      alt={track.album}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-surface-container to-surface-variant flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-[32px]">music_note</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playTrack(track, tracks);
                    }}
                    className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-250 active:scale-95"
                    aria-label={`Play ${track.title}`}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_arrow
                    </span>
                  </button>
                </div>

                <div className="flex flex-col pr-1">
                  <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                    {track.title}
                  </span>
                  <span className="text-[11px] text-on-surface-variant truncate">
                    {track.artist}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section: Your Rotation */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">Your Rotation</h2>
          <span
            onClick={() => onSelectTab('rotation')}
            className="text-xs text-primary font-medium cursor-pointer hover:underline"
          >
            Manage
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {rotationTracks.map((track) => (
            <div
              key={track.id}
              onClick={() => playTrack(track, tracks)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors group cursor-pointer border border-white/[0.03]"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="relative w-12 h-12 rounded-lg bg-surface-container-high shrink-0 overflow-hidden shadow-inner">
                  {track.coverArtUrl ? (
                    <img src={track.coverArtUrl} alt={track.album} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[20px]">music_note</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                    {track.title}
                  </span>
                  <span className="text-xs text-on-surface-variant truncate">
                    {track.artist}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-on-surface-variant font-mono tabular-nums">
                  {track.playCount > 1000 ? `${(track.playCount / 1000).toFixed(1)}k plays` : `${track.playCount || 0} plays`}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(track, tracks);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant group-hover:text-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section: Recently Added */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">Recently Added</h2>
          <span
            onClick={onOpenScanner}
            className="text-xs text-primary font-medium cursor-pointer hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">radar</span>
            <span>Scan device</span>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {recentlyAdded.map((track) => (
            <div
              key={track.id}
              onClick={() => playTrack(track, tracks)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors group cursor-pointer border border-white/[0.03]"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-11 h-11 rounded-lg bg-surface-variant flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">audio_file</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                    {track.name}
                  </span>
                  <span className="text-[11px] text-on-surface-variant truncate">
                    {track.path.replace('/storage/emulated/0/', '')} • {formatFileSize(track.size)} • {formatRelativeDate(track.addedAt)}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenActionSheet(track);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
