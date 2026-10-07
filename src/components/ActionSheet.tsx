import React, { useState } from 'react';
import { Track, Playlist } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { formatFileSize, formatDuration } from '../utils/storage';

interface ActionSheetProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onOpenCreatePlaylist: () => void;
}

export const ActionSheet: React.FC<ActionSheetProps> = ({
  track,
  isOpen,
  onClose,
  playlists,
  onAddToPlaylist,
  onDeleteTrack,
  onOpenCreatePlaylist,
}) => {
  const { playNextInQueue, toggleFavorite } = usePlayer();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);

  if (!isOpen || !track) return null;

  const handlePlayNext = () => {
    playNextInQueue(track);
    onClose();
  };

  const handleToggleFav = async () => {
    await toggleFavorite(track.id);
    onClose();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: track.title,
          text: `Listening to ${track.title} by ${track.artist} on SIREN`,
        });
      } catch {
        // Ignored share abort
      }
    } else {
      navigator.clipboard?.writeText?.(`${track.title} by ${track.artist}`);
      alert('Track info copied to clipboard');
    }
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg bg-surface-container-high rounded-t-3xl p-5 pb-9 flex flex-col gap-2 shadow-2xl border-t border-white/[0.08] animate-in slide-in-from-bottom duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag Handle */}
          <div className="w-12 h-1 bg-surface-variant rounded-full mx-auto mb-2" />

          {/* Track Header Card */}
          <div className="flex items-center gap-3 px-2 py-2 mb-2 bg-surface-container/50 rounded-2xl">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-variant shrink-0">
              {track.coverArtUrl ? (
                <img src={track.coverArtUrl} alt={track.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">music_note</span>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-semibold text-on-surface text-sm truncate">
                {track.title}
              </span>
              <span className="text-xs text-on-surface-variant truncate">
                {track.artist} • {track.album}
              </span>
            </div>
          </div>

          {/* Action List */}
          <button
            onClick={handlePlayNext}
            className="flex items-center gap-3.5 w-full p-3 rounded-xl hover:bg-surface-variant text-on-surface transition-colors cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-primary text-[22px]">play_arrow</span>
            <span className="text-sm font-medium">Play Next</span>
          </button>

          <button
            onClick={() => setShowPlaylistSelector(true)}
            className="flex items-center gap-3.5 w-full p-3 rounded-xl hover:bg-surface-variant text-on-surface transition-colors cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-primary text-[22px]">playlist_add</span>
            <span className="text-sm font-medium">Add to Playlist</span>
          </button>

          <button
            onClick={handleToggleFav}
            className="flex items-center gap-3.5 w-full p-3 rounded-xl hover:bg-surface-variant text-on-surface transition-colors cursor-pointer text-left"
          >
            <span
              className="material-symbols-outlined text-primary text-[22px]"
              style={track.isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              favorite
            </span>
            <span className="text-sm font-medium">
              {track.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            </span>
          </button>

          <button
            onClick={() => setShowInfoModal(true)}
            className="flex items-center gap-3.5 w-full p-3 rounded-xl hover:bg-surface-variant text-on-surface transition-colors cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">info</span>
            <span className="text-sm font-medium">Audio Specs & File Info</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-3.5 w-full p-3 rounded-xl hover:bg-surface-variant text-on-surface transition-colors cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">share</span>
            <span className="text-sm font-medium">Share Track</span>
          </button>

          <button
            onClick={() => {
              if (confirm(`Remove "${track.title}" from SIREN library? (Actual file will stay on your device)`)) {
                onDeleteTrack(track.id);
                onClose();
              }
            }}
            className="flex items-center gap-3.5 w-full p-3 rounded-xl hover:bg-surface-variant text-error transition-colors cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-error text-[22px]">delete</span>
            <span className="text-sm font-medium">Remove from SIREN Library</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 mt-2 rounded-xl bg-surface-variant text-on-surface text-sm font-medium hover:bg-surface-bright transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Playlist Selector Modal */}
      {showPlaylistSelector && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-high border border-white/10 w-full max-w-sm rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-on-surface text-base">Select Playlist</h3>
              <button
                onClick={() => setShowPlaylistSelector(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 my-3 no-scrollbar">
              {playlists.map((pl) => {
                const isAlreadyIn = pl.trackIds.includes(track.id);
                return (
                  <button
                    key={pl.id}
                    onClick={() => {
                      onAddToPlaylist(pl.id, track.id);
                      setShowPlaylistSelector(false);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-container hover:bg-surface-container-highest transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-primary text-[20px]">queue_music</span>
                      <span className="text-sm font-medium text-on-surface">{pl.name}</span>
                    </div>
                    {isAlreadyIn && (
                      <span className="text-xs text-primary font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">check</span> Added
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <button
                onClick={() => {
                  setShowPlaylistSelector(false);
                  onOpenCreatePlaylist();
                }}
                className="text-xs text-primary-container font-semibold hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span> New Playlist
              </button>
              <button
                onClick={() => setShowPlaylistSelector(false)}
                className="text-xs text-on-surface-variant px-3 py-1.5 rounded-lg hover:bg-surface-container"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File & Audio Specs Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-high border border-white/10 w-full max-w-sm rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">audio_file</span>
                <h3 className="font-bold text-on-surface text-base">Audio Specifications</h3>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="bg-surface-container rounded-xl p-3.5 space-y-2.5 text-xs text-on-surface-variant font-mono">
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-on-surface-variant">File Name:</span>
                <span className="text-on-surface truncate max-w-[170px]" title={track.name}>
                  {track.name}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-on-surface-variant">Format:</span>
                <span className="text-on-surface uppercase font-bold">{track.formatLabel || track.extension}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-on-surface-variant">Duration:</span>
                <span className="text-on-surface">{formatDuration(track.duration)}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-on-surface-variant">File Size:</span>
                <span className="text-on-surface">{formatFileSize(track.size)}</span>
              </div>
              {track.sampleRate && (
                <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                  <span className="text-on-surface-variant">Sample Rate:</span>
                  <span className="text-on-surface">{(track.sampleRate / 1000).toFixed(1)} kHz</span>
                </div>
              )}
              {track.bitDepth && (
                <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                  <span className="text-on-surface-variant">Bit Depth:</span>
                  <span className="text-on-surface">{track.bitDepth}-bit</span>
                </div>
              )}
              <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-on-surface-variant">Play Count:</span>
                <span className="text-primary font-bold">{track.playCount || 0} plays</span>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-on-surface-variant">Device Path:</span>
                <span className="text-on-surface break-all text-[11px] bg-surface-container-low p-2 rounded-lg">
                  {track.path}/{track.name}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-surface-variant hover:bg-surface-bright text-xs font-semibold text-on-surface transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
