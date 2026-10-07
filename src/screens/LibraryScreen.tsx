import React, { useState, useMemo, useRef } from 'react';
import { Track, Playlist, LibraryTab, SortOption, OnlineMusicResult } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/storage';
import { isNaturalLanguageCommand, sendSirenAiMessage, executeAiToolCall } from '../services/sirenAiService';

interface LibraryScreenProps {
  tracks: Track[];
  playlists?: Playlist[];
  onOpenActionSheet: (track: Track) => void;
  onOpenScanner: () => void;
  onCreatePlaylist?: (name: string, description: string) => Promise<Playlist>;
  onAddToPlaylist?: (playlistId: string, trackId: string) => Promise<void>;
  onSelectTab?: (tab: any) => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  tracks,
  playlists = [],
  onOpenActionSheet,
  onOpenScanner,
  onCreatePlaylist,
  onAddToPlaylist,
  onSelectTab,
}) => {
  const { playTrack, currentTrack } = usePlayer();
  const [activeTab, setActiveTab] = useState<LibraryTab>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('Recently Played');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);

  // Siren AI State
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiLoadingMessage, setAiLoadingMessage] = useState<string | null>(null);
  const [aiStatusBanner, setAiStatusBanner] = useState<{ text: string; isError?: boolean } | null>(null);
  const [aiFilteredTracks, setAiFilteredTracks] = useState<Track[] | null>(null);
  const [onlineResults, setOnlineResults] = useState<OnlineMusicResult[] | null>(null);

  const cleanQuery = searchQuery.toLowerCase().trim();

  // Determine local tracks matching simple keyword query
  const localKeywordMatches = useMemo(() => {
    if (!cleanQuery) return tracks;
    return tracks.filter((t) =>
      t.title.toLowerCase().includes(cleanQuery) ||
      t.artist.toLowerCase().includes(cleanQuery) ||
      t.album.toLowerCase().includes(cleanQuery) ||
      t.name.toLowerCase().includes(cleanQuery)
    );
  }, [tracks, cleanQuery]);

  // Tracks to display (either AI filtered list or local real-time keyword filtered list)
  const displayTracks = useMemo(() => {
    let source = aiFilteredTracks !== null ? aiFilteredTracks : localKeywordMatches;
    const result = [...source];

    if (sortOption === 'Recently Played') {
      result.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
    } else if (sortOption === 'Most Played') {
      result.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    } else if (sortOption === 'Alphabetical') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOption === 'Artist') {
      result.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortOption === 'Date Added') {
      result.sort((a, b) => b.addedAt - a.addedAt);
    }

    return result;
  }, [aiFilteredTracks, localKeywordMatches, sortOption]);

  // Group by albums (reactive to search query or AI filter)
  const albumsMap = useMemo(() => {
    const map = new Map<string, { album: string; artist: string; coverArtUrl?: string; tracks: Track[] }>();
    const sourceTracks = aiFilteredTracks !== null ? aiFilteredTracks : tracks;

    sourceTracks.forEach((track) => {
      const key = `${track.album}|||${track.artist}`;
      if (!map.has(key)) {
        map.set(key, {
          album: track.album,
          artist: track.artist,
          coverArtUrl: track.coverArtUrl,
          tracks: [],
        });
      }
      map.get(key)!.tracks.push(track);
    });

    let albums = Array.from(map.values());

    if (cleanQuery && aiFilteredTracks === null) {
      albums = albums.filter((item) =>
        item.album.toLowerCase().includes(cleanQuery) ||
        item.artist.toLowerCase().includes(cleanQuery) ||
        item.tracks.some((t) => t.title.toLowerCase().includes(cleanQuery))
      );
    }

    return albums;
  }, [tracks, cleanQuery, aiFilteredTracks]);

  // Group by artists (reactive to search query or AI filter)
  const artistsMap = useMemo(() => {
    const map = new Map<string, { artist: string; albums: Set<string>; tracks: Track[]; coverArtUrl?: string }>();
    const sourceTracks = aiFilteredTracks !== null ? aiFilteredTracks : tracks;

    sourceTracks.forEach((track) => {
      if (!map.has(track.artist)) {
        map.set(track.artist, {
          artist: track.artist,
          albums: new Set(),
          tracks: [],
          coverArtUrl: track.coverArtUrl,
        });
      }
      const entry = map.get(track.artist)!;
      entry.albums.add(track.album);
      entry.tracks.push(track);
      if (!entry.coverArtUrl && track.coverArtUrl) {
        entry.coverArtUrl = track.coverArtUrl;
      }
    });

    let artists = Array.from(map.values()).map((a) => ({
      ...a,
      albumCount: a.albums.size,
    }));

    if (cleanQuery && aiFilteredTracks === null) {
      artists = artists.filter((item) =>
        item.artist.toLowerCase().includes(cleanQuery) ||
        item.tracks.some((t) =>
          t.title.toLowerCase().includes(cleanQuery) ||
          t.album.toLowerCase().includes(cleanQuery)
        )
      );
    }

    return artists;
  }, [tracks, cleanQuery, aiFilteredTracks]);

  // Group by folders / directories (reactive to search query)
  const foldersMap = useMemo(() => {
    const map = new Map<string, Track[]>();
    const sourceTracks = aiFilteredTracks !== null ? aiFilteredTracks : tracks;

    sourceTracks.forEach((track) => {
      const folder = track.path || '/storage/emulated/0/Music';
      if (!map.has(folder)) {
        map.set(folder, []);
      }
      map.get(folder)!.push(track);
    });

    let folders = Array.from(map.entries()).map(([path, folderTracks]) => ({
      path,
      tracks: folderTracks,
    }));

    if (cleanQuery && aiFilteredTracks === null) {
      folders = folders
        .map((f) => ({
          ...f,
          tracks: f.tracks.filter((t) =>
            t.title.toLowerCase().includes(cleanQuery) ||
            t.artist.toLowerCase().includes(cleanQuery) ||
            t.album.toLowerCase().includes(cleanQuery) ||
            f.path.toLowerCase().includes(cleanQuery)
          ),
        }))
        .filter((f) => f.tracks.length > 0 || f.path.toLowerCase().includes(cleanQuery));
    }

    return folders;
  }, [tracks, cleanQuery, aiFilteredTracks]);

  // Execute Siren AI command
  const handleExecuteAiCommand = async (commandText: string) => {
    const trimmed = commandText.trim();
    if (!trimmed) return;

    // Check if query contains explicit online indicator
    if (trimmed.toLowerCase().includes('online') || trimmed.toLowerCase().includes('on the web')) {
      setAiLoadingMessage('Searching online...');
    } else {
      setAiLoadingMessage('Siren is thinking...');
    }

    setIsAiProcessing(true);
    setAiStatusBanner(null);

    try {
      const response = await sendSirenAiMessage(trimmed, tracks, playlists);

      const actionResult = await executeAiToolCall(response, tracks, playlists, {
        playTrack: (track, queue) => {
          playTrack(track, queue);
        },
        createPlaylist: async (name, description) => {
          if (onCreatePlaylist) {
            return await onCreatePlaylist(name, description);
          }
          throw new Error('Playlist creation not available.');
        },
        addTracksToPlaylist: async (playlistId, trackIds) => {
          if (onAddToPlaylist) {
            for (const id of trackIds) {
              await onAddToPlaylist(playlistId, id);
            }
          }
        },
      });

      if (actionResult.type === 'filter_tracks') {
        setAiFilteredTracks(actionResult.tracks || []);
        setOnlineResults(null);
        setActiveTab('songs');
      } else if (actionResult.type === 'online_search') {
        setOnlineResults(actionResult.onlineResults || []);
        setAiFilteredTracks(null);
      } else if (actionResult.type === 'play_track') {
        // Track playback has been initiated with real local track!
      } else if (actionResult.type === 'created_playlist' && onSelectTab) {
        // If user created a playlist, notify them
      }

      setAiStatusBanner({
        text: actionResult.message,
        isError: !actionResult.success,
      });
    } catch (err) {
      console.error('AI invocation failed:', err);
      setAiStatusBanner({
        text: "Couldn't reach Siren AI. Your local library is still available.",
        isError: true,
      });
    } finally {
      setIsAiProcessing(false);
      setAiLoadingMessage(null);
    }
  };

  // Input change handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (aiFilteredTracks !== null) {
      setAiFilteredTracks(null);
    }
    if (onlineResults !== null) {
      setOnlineResults(null);
    }
    if (aiStatusBanner) {
      setAiStatusBanner(null);
    }
  };

  // Keyboard Enter handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      setAiFilteredTracks(null);
      setOnlineResults(null);
      setAiStatusBanner(null);
      return;
    }

    if (e.key === 'Enter') {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      // Local-first check:
      // If it's a natural-language command OR an online search OR no local matches exist:
      if (isNaturalLanguageCommand(trimmed, localKeywordMatches.length) || localKeywordMatches.length === 0) {
        handleExecuteAiCommand(trimmed);
      }
    }
  };

  // Voice Search handler
  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser environment.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.onstart = () => setIsListeningMic(true);
      recognition.onend = () => setIsListeningMic(false);
      recognition.onerror = () => setIsListeningMic(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setSearchQuery(transcript);
          // If spoken query looks like a command, trigger AI directly
          if (isNaturalLanguageCommand(transcript, 0)) {
            handleExecuteAiCommand(transcript);
          }
        }
      };
      recognition.start();
    } catch {
      setIsListeningMic(false);
    }
  };

  const sortOptionsList: SortOption[] = [
    'Recently Played',
    'Most Played',
    'Alphabetical',
    'Artist',
    'Date Added',
  ];

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto px-6 pt-20 pb-44">
      {/* Sticky Search & Tab Section */}
      <div className="sticky top-16 z-20 bg-[#131315]/95 backdrop-blur-xl py-3 -mx-6 px-6 border-b border-white/[0.04]">
        {/* Real-time Search Bar */}
        <div className="relative w-full mb-3">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search your music or ask Siren..."
            className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant pl-11 pr-11 py-3 rounded-xl text-sm outline-none focus:ring-1 focus:ring-primary-container transition-all border border-white/[0.06] focus:border-primary-container"
            aria-label="Search your music or ask Siren..."
          />

          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setAiFilteredTracks(null);
                setOnlineResults(null);
                setAiStatusBanner(null);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
              title="Clear search query"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          ) : (
            <button
              onClick={handleVoiceSearch}
              className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer ${
                isListeningMic ? 'text-primary-container animate-pulse' : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Voice Search"
            >
              <span className="material-symbols-outlined text-[20px]">mic</span>
            </button>
          )}
        </div>

        {/* Subtle AI Indicator while command is processing */}
        {isAiProcessing && (
          <div className="flex items-center gap-2 px-3.5 py-2 mb-3 bg-primary-container/10 border border-primary-container/25 rounded-xl text-xs text-primary transition-all">
            <span className="material-symbols-outlined text-[18px] text-primary-container animate-spin">
              autorenew
            </span>
            <span className="font-medium text-on-surface">
              {aiLoadingMessage || 'Siren is thinking...'}
            </span>
          </div>
        )}

        {/* AI Action Status Banner */}
        {aiStatusBanner && !isAiProcessing && (
          <div
            className={`flex items-center justify-between p-3 mb-3 rounded-xl border text-xs transition-all ${
              aiStatusBanner.isError
                ? 'bg-error-container/20 border-error-container/40 text-error'
                : 'bg-surface-container border-white/10 text-on-surface'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                {aiStatusBanner.isError ? 'info' : 'auto_awesome'}
              </span>
              <span className="truncate">{aiStatusBanner.text}</span>
            </div>
            <button
              onClick={() => setAiStatusBanner(null)}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-full shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Tab Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {(['songs', 'albums', 'artists', 'folders'] as LibraryTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-full text-xs font-semibold capitalize shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary-container text-white shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Subheader: Track count & Sort Menu */}
        <div className="flex items-center justify-between mt-3.5">
          <div className="flex items-center gap-1.5 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined text-[16px]">headphones</span>
            <span className="font-medium">
              {activeTab === 'songs' && `${displayTracks.length} tracks found`}
              {activeTab === 'albums' && `${albumsMap.length} albums found`}
              {activeTab === 'artists' && `${artistsMap.length} artists found`}
              {activeTab === 'folders' && `${foldersMap.length} storage folders`}
            </span>
            {searchQuery && (
              <span className="text-[11px] text-primary-container font-mono ml-1 truncate max-w-[140px]">
                for "{searchQuery}"
              </span>
            )}
            {aiFilteredTracks !== null && (
              <button
                onClick={() => {
                  setAiFilteredTracks(null);
                  setSearchQuery('');
                  setAiStatusBanner(null);
                }}
                className="ml-1 text-[11px] text-primary hover:underline font-semibold"
              >
                (Reset filter)
              </button>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-xs font-medium hover:bg-surface-container-high transition-colors cursor-pointer border border-white/[0.04]"
            >
              <span className="material-symbols-outlined text-[16px]">sort</span>
              <span>{sortOption}</span>
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>

            {isSortDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsSortDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-surface-container-high border border-white/10 rounded-xl p-1.5 shadow-2xl z-40 flex flex-col gap-0.5 animate-in zoom-in-95 duration-100">
                  {sortOptionsList.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setSortOption(opt);
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-on-surface hover:bg-surface-variant text-xs transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className={sortOption === opt ? 'text-primary font-semibold' : ''}>
                        {opt}
                      </span>
                      {sortOption === opt && (
                        <span className="material-symbols-outlined text-primary text-[16px]">
                          check
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ONLINE MUSIC DISCOVERY RESULTS (when invoked) */}
      {onlineResults && onlineResults.length > 0 && (
        <section className="mt-4 p-4 rounded-2xl bg-surface-container border border-primary-container/20 space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container text-[20px]">travel_explore</span>
              <h3 className="text-sm font-bold text-on-surface">Online Discovery Results</h3>
            </div>
            <button
              onClick={() => setOnlineResults(null)}
              className="text-xs text-on-surface-variant hover:text-on-surface"
            >
              Dismiss
            </button>
          </div>

          <p className="text-[11px] text-on-surface-variant">
            Legitimate music catalog metadata from Apple Music / iTunes. Siren does not download or stream-rip copyrighted content.
          </p>

          <div className="space-y-2">
            {onlineResults.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container-highest transition-colors border border-white/[0.04]"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-variant shrink-0">
                    {item.artworkUrl ? (
                      <img src={item.artworkUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[20px]">music_note</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-on-surface truncate">
                      {item.title}
                    </span>
                    <span className="text-xs text-on-surface-variant truncate">
                      {item.artist} {item.album ? `• ${item.album}` : ''}
                    </span>
                    <span className="text-[10px] text-primary/80 mt-0.5">
                      {item.source} • {item.playableStatus}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.previewUrl && (
                    <button
                      onClick={() => {
                        const tempAudio = new Audio(item.previewUrl);
                        tempAudio.play().catch(() => {});
                      }}
                      className="px-2.5 py-1 rounded-full bg-primary-container text-white text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      title="Play official 30s preview sample"
                    >
                      <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                      <span>Sample</span>
                    </button>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                      title="View on source catalog"
                    >
                      <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 1: SONGS */}
      {activeTab === 'songs' && (
        <div className="flex flex-col gap-1.5 mt-3">
          {displayTracks.length === 0 ? (
            <div className="py-16 text-center text-on-surface-variant flex flex-col items-center">
              <span className="material-symbols-outlined text-[48px] text-surface-variant mb-2">
                music_off
              </span>
              <p className="text-sm font-semibold text-on-surface">
                {searchQuery ? `No songs matching "${searchQuery}"` : 'No local audio files found'}
              </p>
              <p className="text-xs text-on-surface-variant mt-1 max-w-xs">
                {searchQuery
                  ? 'Try searching with a different track title, artist, or album name.'
                  : 'Scan your Android storage to discover music on your device.'}
              </p>
              {searchQuery ? (
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setAiFilteredTracks(null);
                    }}
                    className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold rounded-full border border-white/10 transition-colors"
                  >
                    Clear Search Filter
                  </button>
                  <button
                    onClick={() => handleExecuteAiCommand(searchQuery)}
                    className="px-4 py-2 bg-primary-container text-white text-xs font-semibold rounded-full shadow-md shadow-primary-container/20 flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    <span>Ask Siren AI</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenScanner}
                  className="mt-4 px-5 py-2.5 bg-primary-container text-white text-xs font-semibold rounded-full shadow-lg shadow-primary-container/25"
                >
                  Scan device storage
                </button>
              )}
            </div>
          ) : (
            displayTracks.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, displayTracks)}
                  className={`group flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-primary-container/10 border border-primary-container/30'
                      : 'hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-surface-variant shadow-inner">
                      {track.coverArtUrl ? (
                        <img
                          src={track.coverArtUrl}
                          alt={track.album}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-[20px]">music_note</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-[20px]">
                          play_arrow
                        </span>
                      </div>
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

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-xs text-on-surface-variant font-mono tabular-nums">
                      {formatDuration(track.duration)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenActionSheet(track);
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: ALBUMS */}
      {activeTab === 'albums' && (
        <div className="grid grid-cols-2 gap-3.5 mt-3">
          {albumsMap.length === 0 ? (
            <div className="col-span-2 py-16 text-center text-on-surface-variant flex flex-col items-center">
              <span className="material-symbols-outlined text-[48px] text-surface-variant mb-2">album</span>
              <p className="text-sm font-semibold text-on-surface">No albums matching "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-surface-container text-on-surface text-xs font-semibold rounded-full"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            albumsMap.map((item, idx) => (
              <div
                key={`${item.album}-${idx}`}
                onClick={() => playTrack(item.tracks[0], item.tracks)}
                className="group flex flex-col bg-surface-container p-3 rounded-2xl hover:bg-surface-container-high transition-all cursor-pointer border border-white/[0.04]"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-surface-variant mb-2.5 relative shadow-inner">
                  {item.coverArtUrl ? (
                    <img
                      src={item.coverArtUrl}
                      alt={item.album}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-surface-container-high to-surface-variant flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-[36px]">album</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center shadow-lg">
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        play_arrow
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                  {item.album}
                </span>
                <span className="text-xs text-on-surface-variant truncate">
                  {item.artist} • {item.tracks.length} {item.tracks.length === 1 ? 'track' : 'tracks'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: ARTISTS */}
      {activeTab === 'artists' && (
        <div className="flex flex-col gap-2 mt-3">
          {artistsMap.length === 0 ? (
            <div className="py-16 text-center text-on-surface-variant flex flex-col items-center">
              <span className="material-symbols-outlined text-[48px] text-surface-variant mb-2">person</span>
              <p className="text-sm font-semibold text-on-surface">No artists matching "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-surface-container text-on-surface text-xs font-semibold rounded-full"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            artistsMap.map((item, idx) => (
              <div
                key={`${item.artist}-${idx}`}
                onClick={() => playTrack(item.tracks[0], item.tracks)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container-low transition-all cursor-pointer border border-white/[0.03] group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-variant shrink-0 shadow-inner flex items-center justify-center">
                    {item.coverArtUrl ? (
                      <img src={item.coverArtUrl} alt={item.artist} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-primary text-[24px]">person</span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                      {item.artist}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {item.albumCount} {item.albumCount === 1 ? 'album' : 'albums'} • {item.tracks.length} songs
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                  chevron_right
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: FOLDERS */}
      {activeTab === 'folders' && (
        <div className="flex flex-col gap-2.5 mt-3">
          {foldersMap.length === 0 ? (
            <div className="py-16 text-center text-on-surface-variant flex flex-col items-center">
              <span className="material-symbols-outlined text-[48px] text-surface-variant mb-2">folder</span>
              <p className="text-sm font-semibold text-on-surface">No folders matching "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-surface-container text-on-surface text-xs font-semibold rounded-full"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            foldersMap.map((item, idx) => (
              <div
                key={`${item.path}-${idx}`}
                onClick={() => playTrack(item.tracks[0], item.tracks)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer border border-white/[0.04] group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary-container shrink-0">
                    <span className="material-symbols-outlined text-[22px]">folder</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                      {item.path}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {item.tracks.length} audio {item.tracks.length === 1 ? 'file' : 'files'}
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                  chevron_right
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
