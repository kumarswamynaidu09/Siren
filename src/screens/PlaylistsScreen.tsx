import React, { useState } from 'react';
import { Playlist, Track } from '../types';
import { usePlayer } from '../context/PlayerContext';

interface PlaylistsScreenProps {
  playlists: Playlist[];
  tracks: Track[];
  onOpenCreateModal: () => void;
  onOpenActionSheet: (track: Track) => void;
  onDeletePlaylist: (id: string) => void;
  onOpenScanner: () => void;
}

export const PlaylistsScreen: React.FC<PlaylistsScreenProps> = ({
  playlists,
  tracks,
  onOpenCreateModal,
  onOpenActionSheet,
  onDeletePlaylist,
  onOpenScanner,
}) => {
  const { playTrack } = usePlayer();
  const [filter, setFilter] = useState<'all' | 'downloaded' | 'collaborative' | 'smart'>('all');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [activeMenuPlaylist, setActiveMenuPlaylist] = useState<Playlist | null>(null);

  // Map track IDs to Track objects for a given playlist
  const getPlaylistTracks = (playlist: Playlist): Track[] => {
    return playlist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => t !== undefined);
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    const plTracks = getPlaylistTracks(playlist);
    if (plTracks.length > 0) {
      playTrack(plTracks[0], plTracks);
    } else {
      alert(`"${playlist.name}" is currently empty. Add tracks from your library!`);
    }
  };

  // If a playlist is opened in detail view
  if (selectedPlaylist) {
    const pTracks = getPlaylistTracks(selectedPlaylist);
    return (
      <div className="flex flex-col w-full max-w-xl mx-auto px-6 pt-20 pb-44">
        {/* Back Button and Title */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setSelectedPlaylist(null)}
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl font-bold text-on-surface truncate">{selectedPlaylist.name}</h1>
            <p className="text-xs text-on-surface-variant truncate">{selectedPlaylist.description}</p>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between p-4 bg-surface-container rounded-2xl mb-5 border border-white/[0.04]">
          <div className="text-xs text-on-surface-variant">
            {pTracks.length} {pTracks.length === 1 ? 'track' : 'tracks'}
          </div>
          <button
            onClick={() => handlePlayPlaylist(selectedPlaylist)}
            className="px-5 py-2.5 bg-primary-container text-white font-semibold text-xs rounded-full flex items-center gap-1.5 shadow-lg shadow-primary-container/25 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              play_arrow
            </span>
            <span>Play All</span>
          </button>
        </div>

        {/* Tracks List */}
        <div className="flex flex-col gap-2">
          {pTracks.length === 0 ? (
            <div className="py-16 text-center text-on-surface-variant bg-surface-container-low rounded-2xl p-6 border border-white/[0.04]">
              <span className="material-symbols-outlined text-[42px] text-surface-variant mb-2">
                queue_music
              </span>
              <p className="text-sm font-semibold text-on-surface mb-1">No tracks in this playlist</p>
              <p className="text-xs text-on-surface-variant mb-4">
                Browse your Library and tap the 3-dots menu to add songs to "{selectedPlaylist.name}".
              </p>
            </div>
          ) : (
            pTracks.map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, pTracks)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors group cursor-pointer border border-white/[0.03]"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-surface-variant shrink-0">
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
                      {track.artist} • {track.album}
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
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto px-6 pt-20 pb-44">
      {/* Title & New Playlist Button */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">Your Playlists</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant">Curated vibes and custom rotations</p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="bg-primary-container text-white text-xs font-bold px-4 py-3 rounded-full flex items-center gap-1.5 shadow-[0_4px_16px_rgba(255,86,37,0.35)] hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>New Playlist</span>
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
            filter === 'all'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          All ({playlists.length})
        </button>
        <button
          onClick={() => setFilter('downloaded')}
          className={`text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
            filter === 'downloaded'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Local Storage
        </button>
        <button
          onClick={() => setFilter('collaborative')}
          className={`text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
            filter === 'collaborative'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Custom
        </button>
        <button
          onClick={() => setFilter('smart')}
          className={`text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
            filter === 'smart'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Smart Mixes
        </button>
      </div>

      {/* Playlists Cards Grid */}
      <div className="flex flex-col gap-4">
        {playlists.map((playlist) => {
          const plTracks = getPlaylistTracks(playlist);
          const covers = plTracks.filter((t) => t.coverArtUrl).slice(0, 4);

          return (
            <div
              key={playlist.id}
              onClick={() => setSelectedPlaylist(playlist)}
              className="bg-surface-container p-4 rounded-2xl flex flex-col gap-3.5 shadow-sm hover:bg-surface-container-high transition-all group cursor-pointer border border-white/[0.04]"
            >
              {/* 2x2 Grid Cover Artwork Collage */}
              <div className="relative w-full h-48 rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5 bg-surface-container-lowest">
                {covers.length >= 4 ? (
                  covers.map((c, i) => (
                    <img key={i} src={c.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                  ))
                ) : covers.length > 0 ? (
                  <div className="col-span-2 row-span-2 relative w-full h-full">
                    <img src={covers[0].coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="col-span-2 row-span-2 flex flex-col items-center justify-center bg-gradient-to-br from-surface-container-low to-surface-variant p-4 text-center">
                    <span className="material-symbols-outlined text-primary text-[42px] mb-1">
                      {playlist.isSystem ? 'favorite' : 'queue_music'}
                    </span>
                    <span className="text-xs text-on-surface-variant font-medium">Acoustic Session</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <span className="text-[11px] font-medium bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-on-surface border border-white/10">
                    {plTracks.length} {plTracks.length === 1 ? 'track' : 'tracks'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPlaylist(playlist);
                    }}
                    className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity active:scale-95 pointer-events-auto"
                    aria-label={`Play ${playlist.name}`}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_arrow
                    </span>
                  </button>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col min-w-0 pr-2">
                  <h2 className="text-base font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                    {playlist.name}
                  </h2>
                  <p className="text-xs text-on-surface-variant truncate">
                    {playlist.description}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuPlaylist(playlist);
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">more_vert</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Playlist Context Action Sheet */}
      {activeMenuPlaylist && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveMenuPlaylist(null)}
        >
          <div
            className="bg-surface-container-high w-full max-w-lg rounded-t-3xl p-6 flex flex-col gap-3 shadow-2xl border-t border-white/[0.08]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-surface-variant rounded-full mx-auto mb-2" />
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
              <span className="text-base font-bold text-on-surface">
                {activeMenuPlaylist.name}
              </span>
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                onClick={() => setActiveMenuPlaylist(null)}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <button
              onClick={() => {
                handlePlayPlaylist(activeMenuPlaylist);
                setActiveMenuPlaylist(null);
              }}
              className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-surface-variant text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-primary text-[22px]">play_arrow</span>
              <span className="text-sm font-medium">Play All Tracks</span>
            </button>

            {!activeMenuPlaylist.isSystem && (
              <button
                onClick={() => {
                  if (confirm(`Delete playlist "${activeMenuPlaylist.name}"?`)) {
                    onDeletePlaylist(activeMenuPlaylist.id);
                    setActiveMenuPlaylist(null);
                  }
                }}
                className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-surface-variant text-error transition-colors"
              >
                <span className="material-symbols-outlined text-error text-[22px]">delete</span>
                <span className="text-sm font-medium">Delete Playlist</span>
              </button>
            )}

            <button
              onClick={() => setActiveMenuPlaylist(null)}
              className="w-full py-2.5 mt-2 rounded-xl bg-surface-variant text-on-surface text-xs font-semibold hover:bg-surface-bright transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
