import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/storage';

export const QueueDrawer: React.FC = () => {
  const {
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    isQueueDrawerOpen,
    setQueueDrawerOpen,
    playTrack,
    removeFromQueue,
    clearQueue,
  } = usePlayer();

  if (!isQueueDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md flex items-end justify-center">
      <div
        className="w-full max-w-md bg-surface-container-high border-t border-white/10 rounded-t-3xl max-h-[85vh] flex flex-col p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div
          onClick={() => setQueueDrawerOpen(false)}
          className="w-12 h-1.5 bg-surface-variant rounded-full mx-auto mb-4 cursor-pointer hover:bg-white/20 transition-colors"
        />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div>
            <h3 className="font-bold text-on-surface text-lg">Listening Queue</h3>
            <p className="text-xs text-on-surface-variant">
              {queue.length} {queue.length === 1 ? 'track' : 'tracks'} loaded
            </p>
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 1 && (
              <button
                onClick={clearQueue}
                className="text-xs text-error hover:underline px-2 py-1"
              >
                Clear Queue
              </button>
            )}
            <button
              onClick={() => setQueueDrawerOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 no-scrollbar">
          {queue.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-sm">
              Queue is empty
            </div>
          ) : (
            queue.map((track, idx) => {
              const isCurrent = idx === currentIndex;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => playTrack(track)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-primary-container/15 border border-primary-container/30'
                      : 'hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-surface-variant shrink-0">
                      {track.coverArtUrl ? (
                        <img
                          src={track.coverArtUrl}
                          alt={track.album}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-[18px]">music_note</span>
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span
                            className="material-symbols-outlined text-primary-container text-[18px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {isPlaying ? 'volume_up' : 'pause'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span
                        className={`text-sm font-medium truncate ${
                          isCurrent ? 'text-primary-container font-semibold' : 'text-on-surface'
                        }`}
                      >
                        {track.title}
                      </span>
                      <span className="text-xs text-on-surface-variant truncate">
                        {track.artist}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-on-surface-variant font-mono">
                      {formatDuration(track.duration)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(idx);
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-surface-variant transition-colors"
                      title="Remove from queue"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
