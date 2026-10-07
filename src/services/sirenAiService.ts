import { Track, Playlist, OnlineMusicResult, SirenAiResponse, TrackSummary, PlaylistSummary } from '../types';

/**
 * Checks if a search query is a natural language command or online search
 * rather than a basic local keyword search.
 */
export function isNaturalLanguageCommand(query: string, localMatchCount: number): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return false;

  // Explicit online search triggers
  if (
    trimmed.includes(' online') ||
    trimmed.startsWith('online ') ||
    trimmed.includes('on the web') ||
    trimmed.includes('on the internet') ||
    trimmed.startsWith('find online')
  ) {
    return true;
  }

  // Explicit playback commands
  if (
    trimmed.startsWith('play ') ||
    trimmed.startsWith('listen to ') ||
    trimmed.startsWith('queue ') ||
    trimmed.startsWith('shuffle ')
  ) {
    return true;
  }

  // Explicit playlist commands
  if (
    trimmed.startsWith('create playlist') ||
    trimmed.startsWith('make a playlist') ||
    trimmed.startsWith('make playlist') ||
    trimmed.startsWith('new playlist') ||
    trimmed.startsWith('add ') && trimmed.includes(' to ')
  ) {
    return true;
  }

  // Smart rotation / favorites / recent queries
  if (
    trimmed.includes('most played') ||
    trimmed.includes('my rotation') ||
    trimmed.includes('top songs') ||
    trimmed.includes('favorite') ||
    trimmed.includes('recently added') ||
    trimmed.includes('recently played') ||
    trimmed.startsWith('show my ') ||
    trimmed.startsWith('get my ') ||
    trimmed.startsWith('what are my ')
  ) {
    return true;
  }

  // Conversational sentence with question or multi-word request
  if (
    (trimmed.startsWith('can you ') ||
     trimmed.startsWith('please ') ||
     trimmed.startsWith('find songs by ') ||
     trimmed.startsWith('find music by ') ||
     trimmed.startsWith('what songs '))
  ) {
    return true;
  }

  // If simple keyword and local matches exist, do NOT call AI
  if (localMatchCount > 0) {
    return false;
  }

  return false;
}

/**
 * Calls the backend /api/siren-ai endpoint with local library context.
 */
export async function sendSirenAiMessage(
  message: string,
  tracks: Track[],
  playlists: Playlist[]
): Promise<SirenAiResponse> {
  try {
    const trackSummaries: TrackSummary[] = tracks.slice(0, 150).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      filename: t.name,
      playCount: t.playCount || 0,
      isFavorite: t.isFavorite,
      lastPlayedAt: t.lastPlayedAt,
      addedAt: t.addedAt,
    }));

    const playlistSummaries: PlaylistSummary[] = playlists.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      trackCount: p.trackIds.length,
    }));

    const customApiKey = localStorage.getItem('siren_ai_api_key') || undefined;

    const response = await fetch('/api/siren-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        customApiKey,
        libraryContext: {
          tracks: trackSummaries,
          playlists: playlistSummaries,
        },
      }),
    });

    if (response.ok) {
      const data: SirenAiResponse = await response.json();
      if (!data.error) {
        return data;
      }
    }

    // Client-side smart fallback
    return fallbackClientAi(message, tracks, playlists);
  } catch (err) {
    console.warn('Siren AI fetch fallback:', err);
    return fallbackClientAi(message, tracks, playlists);
  }
}

// Client-side fallback handler
async function fallbackClientAi(
  message: string,
  tracks: Track[],
  playlists: Playlist[]
): Promise<SirenAiResponse> {
  const q = message.trim().toLowerCase();

  // 1. Online search
  if (
    q.startsWith('search online') ||
    q.startsWith('find online') ||
    q.includes('online') ||
    q.includes('on the web') ||
    q.includes('preview')
  ) {
    const cleanQuery = message
      .replace(/^(search|find|look up)\s+(online|on the web|on internet)\s+(for\s+)?/i, '')
      .replace(/\s+(online|on the web|on internet)$/i, '')
      .replace(/^(search|find)\s+/i, '')
      .trim();
    const results = await fetchClientOnlineCatalog(cleanQuery || message);
    return {
      toolCall: { name: 'search_online_music', args: { query: cleanQuery || message } },
      onlineResults: results,
      message:
        results.length > 0
          ? `Found ${results.length} online results for "${cleanQuery || message}".`
          : `No online results found for "${cleanQuery || message}".`,
    };
  }

  // 2. Playback command
  if (
    q.startsWith('play ') ||
    q.startsWith('start ') ||
    q.startsWith('put on ') ||
    q.startsWith('listen to ') ||
    q.startsWith('queue ')
  ) {
    const songQuery = message
      .replace(/^(play|start|put on|listen to|queue)\s+/i, '')
      .replace(/^(song|track)\s+/i, '')
      .trim();

    if (!songQuery || songQuery === 'something' || songQuery === 'random' || songQuery === 'music') {
      const random = tracks[Math.floor(Math.random() * tracks.length)];
      if (random) {
        return {
          toolCall: { name: 'play_local_track', args: { trackId: random.id } },
          message: `Shuffling library: Playing "${random.title}" by ${random.artist}.`,
        };
      }
    }

    const match = tracks.find(
      (t) =>
        t.title.toLowerCase().includes(songQuery.toLowerCase()) ||
        t.artist.toLowerCase().includes(songQuery.toLowerCase()) ||
        t.name?.toLowerCase().includes(songQuery.toLowerCase())
    );

    if (match) {
      return {
        toolCall: { name: 'play_local_track', args: { trackId: match.id } },
        message: `Playing "${match.title}" by ${match.artist}.`,
      };
    } else {
      const onlineResults = await fetchClientOnlineCatalog(songQuery);
      return {
        toolCall: { name: 'search_online_music', args: { query: songQuery } },
        onlineResults,
        message:
          onlineResults.length > 0
            ? `Song not found locally. Found ${onlineResults.length} online matches:`
            : `Could not find "${songQuery}" in your local library.`,
      };
    }
  }

  // 3. Shuffle
  if (q.includes('shuffle') || q.includes('random') || q === 'play something') {
    const random = tracks[Math.floor(Math.random() * tracks.length)];
    if (random) {
      return {
        toolCall: { name: 'play_local_track', args: { trackId: random.id } },
        message: `Shuffling library: Playing "${random.title}" by ${random.artist}.`,
      };
    }
  }

  // 4. Rotation
  if (
    q.includes('rotation') ||
    q.includes('top track') ||
    q.includes('top song') ||
    q.includes('most played')
  ) {
    const period = q.includes('week') ? 'week' : q.includes('month') ? 'month' : 'all';
    return {
      toolCall: { name: 'get_rotation', args: { period, limit: 10 } },
      message: 'Here are your top acoustic rotation tracks.',
    };
  }

  // 5. Favorites
  if (q.includes('favorite') || q.includes('liked') || q.includes('starred')) {
    return {
      toolCall: { name: 'get_favorites', args: { limit: 20 } },
      message: 'Showing your favorite tracks.',
    };
  }

  // 6. Recently added
  if (q.includes('recently added') || q.includes('newest') || q.includes('latest songs')) {
    return {
      toolCall: { name: 'get_recently_added', args: { limit: 10 } },
      message: 'Showing recently added tracks.',
    };
  }

  // 7. Recently played
  if (q.includes('recently played') || q.includes('history') || q.includes('last played')) {
    return {
      toolCall: { name: 'get_recently_played', args: { limit: 10 } },
      message: 'Showing recently played tracks.',
    };
  }

  // 8. Create playlist
  if (q.startsWith('create playlist') || q.startsWith('make playlist') || q.startsWith('new playlist')) {
    const name =
      message
        .replace(/^(create|make|new)\s+playlist\s+(called\s+|named\s+)?/i, '')
        .trim() || 'New Playlist';
    return {
      toolCall: { name: 'create_playlist', args: { name, description: 'Created with Siren AI' } },
      message: `Created playlist "${name}".`,
    };
  }

  // 9. Local search by keyword
  const cleanSearch = message
    .replace(/^(search|find|show|lookup|look up)\s+(songs|tracks|music)?\s*(by|from|for)?\s*/i, '')
    .trim();

  const matched = tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(cleanSearch.toLowerCase()) ||
      t.artist.toLowerCase().includes(cleanSearch.toLowerCase()) ||
      t.album?.toLowerCase().includes(cleanSearch.toLowerCase())
  );

  if (matched.length > 0) {
    return {
      toolCall: { name: 'search_local_music', args: { query: cleanSearch } },
      message: `Found ${matched.length} song${matched.length > 1 ? 's' : ''} matching "${cleanSearch}".`,
    };
  }

  // 10. Fallback online search
  const onlineResults = await fetchClientOnlineCatalog(cleanSearch || message);
  return {
    toolCall: { name: 'search_online_music', args: { query: cleanSearch || message } },
    onlineResults,
    message:
      onlineResults.length > 0
        ? `Found ${onlineResults.length} online results for "${cleanSearch || message}".`
        : `No local or online tracks found for "${cleanSearch || message}".`,
  };
}

// Client helper for iTunes Search
async function fetchClientOnlineCatalog(query: string): Promise<OnlineMusicResult[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=6`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];
    return data.results.map((item: any) => ({
      title: item.trackName || 'Unknown Title',
      artist: item.artistName || 'Unknown Artist',
      album: item.collectionName || undefined,
      source: 'Apple Music / iTunes Store',
      url: item.trackViewUrl || '',
      previewUrl: item.previewUrl || undefined,
      artworkUrl: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '300x300bb') : undefined,
      playableStatus: item.previewUrl ? '30s official sample available' : 'Metadata catalog entry',
    }));
  } catch {
    return [];
  }
}

export interface ExecutedAiActionResult {
  type:
    | 'play_track'
    | 'filter_tracks'
    | 'created_playlist'
    | 'added_to_playlist'
    | 'online_search'
    | 'message';
  track?: Track;
  tracks?: Track[];
  playlist?: Playlist;
  onlineResults?: OnlineMusicResult[];
  message: string;
  success: boolean;
}

/**
 * Validates and safely executes an AI tool call strictly against actual local data.
 * Adheres strictly to security rule: Never trust track IDs supplied directly by the model.
 */
export async function executeAiToolCall(
  response: SirenAiResponse,
  tracks: Track[],
  playlists: Playlist[],
  operations: {
    playTrack: (track: Track, queue?: Track[]) => void;
    createPlaylist: (name: string, description: string) => Promise<Playlist>;
    addTracksToPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  }
): Promise<ExecutedAiActionResult> {
  if (response.error) {
    return {
      type: 'message',
      message: response.error,
      success: false,
    };
  }

  const toolCall = response.toolCall;
  if (!toolCall) {
    return {
      type: 'message',
      message: response.message || 'No action required.',
      success: true,
    };
  }

  const { name, args } = toolCall;

  switch (name) {
    case 'play_local_track': {
      const trackId = args.trackId;
      // Validate that track exists in local library
      let targetTrack = tracks.find((t) => t.id === trackId);

      // Safe fallback: if model supplied title instead of exact ID, search real tracks
      if (!targetTrack && typeof trackId === 'string') {
        const queryLower = trackId.toLowerCase();
        targetTrack = tracks.find(
          (t) =>
            t.title.toLowerCase().includes(queryLower) ||
            t.name.toLowerCase().includes(queryLower)
        );
      }

      if (!targetTrack) {
        return {
          type: 'message',
          message: "That song isn't in your Siren library.",
          success: false,
        };
      }

      operations.playTrack(targetTrack, tracks);
      return {
        type: 'play_track',
        track: targetTrack,
        message: response.message || `Playing "${targetTrack.title}" by ${targetTrack.artist}.`,
        success: true,
      };
    }

    case 'search_local_music': {
      const query = (args.query || '').toLowerCase().trim();
      const matched = tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.artist.toLowerCase().includes(query) ||
          t.album.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query)
      );

      if (matched.length === 0) {
        return {
          type: 'message',
          message: `No local songs matching "${args.query}" found.`,
          tracks: [],
          success: false,
        };
      }

      return {
        type: 'filter_tracks',
        tracks: matched,
        message: response.message || `Found ${matched.length} matching songs in your library.`,
        success: true,
      };
    }

    case 'get_rotation': {
      const period = args.period || 'all';
      const limit = Number(args.limit) || 10;
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const monthMs = 30 * 24 * 60 * 60 * 1000;

      let filtered = [...tracks];
      if (period === 'week') {
        filtered = filtered.filter((t) => t.lastPlayedAt && now - t.lastPlayedAt <= weekMs);
      } else if (period === 'month') {
        filtered = filtered.filter((t) => t.lastPlayedAt && now - t.lastPlayedAt <= monthMs);
      }

      filtered.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
      const resultTracks = filtered.slice(0, limit);

      if (resultTracks.length === 0) {
        return {
          type: 'message',
          message: 'No songs in your rotation yet. Start listening to build your ranking.',
          tracks: [],
          success: false,
        };
      }

      return {
        type: 'filter_tracks',
        tracks: resultTracks,
        message: response.message || `Here are your top ${resultTracks.length} rotation tracks.`,
        success: true,
      };
    }

    case 'get_favorites': {
      const limit = Number(args.limit) || 20;
      const favs = tracks.filter((t) => t.isFavorite).slice(0, limit);
      if (favs.length === 0) {
        return {
          type: 'message',
          message: 'You have not favorited any songs yet.',
          tracks: [],
          success: false,
        };
      }
      return {
        type: 'filter_tracks',
        tracks: favs,
        message: response.message || `Here are your ${favs.length} favorite songs.`,
        success: true,
      };
    }

    case 'get_recently_added': {
      const limit = Number(args.limit) || 10;
      const recent = [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, limit);
      return {
        type: 'filter_tracks',
        tracks: recent,
        message: response.message || `Here are your ${recent.length} recently added tracks.`,
        success: true,
      };
    }

    case 'get_recently_played': {
      const limit = Number(args.limit) || 10;
      const recent = [...tracks]
        .filter((t) => t.lastPlayedAt !== null)
        .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
        .slice(0, limit);

      if (recent.length === 0) {
        return {
          type: 'message',
          message: 'No recently played songs yet.',
          tracks: [],
          success: false,
        };
      }
      return {
        type: 'filter_tracks',
        tracks: recent,
        message: response.message || `Here are your ${recent.length} recently played tracks.`,
        success: true,
      };
    }

    case 'create_playlist': {
      const name = (args.name || '').trim();
      const description = (args.description || 'Custom playlist created with Siren AI').trim();
      if (!name) {
        return {
          type: 'message',
          message: 'Please provide a name for the new playlist.',
          success: false,
        };
      }

      const created = await operations.createPlaylist(name, description);
      return {
        type: 'created_playlist',
        playlist: created,
        message: response.message || `Created playlist "${name}".`,
        success: true,
      };
    }

    case 'add_tracks_to_playlist': {
      const playlistIdOrName = args.playlistId;
      const targetPlaylist = playlists.find(
        (p) =>
          p.id === playlistIdOrName ||
          p.name.toLowerCase() === String(playlistIdOrName).toLowerCase()
      );

      if (!targetPlaylist) {
        return {
          type: 'message',
          message: `Playlist "${playlistIdOrName}" could not be found.`,
          success: false,
        };
      }

      // Validate track IDs strictly against actual local library
      const rawTrackIds: string[] = Array.isArray(args.trackIds) ? args.trackIds : [args.trackIds];
      const validTrackIds = rawTrackIds.filter((id) => tracks.some((t) => t.id === id));

      // Fallback matching if model supplied track titles instead of IDs
      if (validTrackIds.length === 0 && rawTrackIds.length > 0) {
        for (const item of rawTrackIds) {
          const match = tracks.find((t) => t.title.toLowerCase().includes(String(item).toLowerCase()));
          if (match && !validTrackIds.includes(match.id)) {
            validTrackIds.push(match.id);
          }
        }
      }

      if (validTrackIds.length === 0) {
        return {
          type: 'message',
          message: "The requested track isn't in your Siren library.",
          success: false,
        };
      }

      await operations.addTracksToPlaylist(targetPlaylist.id, validTrackIds);
      return {
        type: 'added_to_playlist',
        playlist: targetPlaylist,
        message: response.message || `Added ${validTrackIds.length} track(s) to "${targetPlaylist.name}".`,
        success: true,
      };
    }

    case 'search_online_music': {
      const results = response.onlineResults || [];
      if (results.length === 0) {
        return {
          type: 'online_search',
          onlineResults: [],
          message: "I couldn't find a usable online result.",
          success: false,
        };
      }
      return {
        type: 'online_search',
        onlineResults: results,
        message: response.message || `Found ${results.length} online results for "${args.query}".`,
        success: true,
      };
    }

    default:
      return {
        type: 'message',
        message: response.message || 'Operation processed.',
        success: true,
      };
  }
}
