import { get, set, del, keys } from 'idb-keyval';
import { Track, Playlist, PlaybackState } from '../types';

const TRACKS_PREFIX = 'siren_track_';
const PLAYLISTS_KEY = 'siren_playlists';
const PLAYBACK_STATE_KEY = 'siren_playback_state';
const USER_PROFILE_KEY = 'siren_user_profile';

export interface UserProfile {
  name: string;
  avatarUrl?: string;
  hasCompletedOnboarding: boolean;
}

// Default system playlist
const DEFAULT_LIKED_PLAYLIST: Playlist = {
  id: 'liked_songs',
  name: 'Liked Songs',
  description: 'Your personal sanctuary of favorites',
  trackIds: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isSystem: true,
};

/**
 * Loads all tracks from IndexedDB, generating fresh object URLs for audio and cover art
 */
export async function getAllTracks(): Promise<Track[]> {
  const allKeys = await keys();
  const trackKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(TRACKS_PREFIX));
  const tracks: Track[] = [];

  for (const key of trackKeys) {
    const raw = await get<any>(key);
    if (raw) {
      // Re-hydrate cover art object URL if coverBlob exists
      let coverArtUrl: string | undefined = undefined;
      if (raw.coverBlob) {
        try {
          coverArtUrl = URL.createObjectURL(raw.coverBlob);
        } catch {
          // fallback
        }
      }

      tracks.push({
        ...raw,
        coverArtUrl,
      });
    }
  }

  // Sort by addedAt descending
  return tracks.sort((a, b) => b.addedAt - a.addedAt);
}

/**
 * Save a single track to IndexedDB
 */
export async function saveTrack(track: Track): Promise<void> {
  // Store track with its File/Blob and coverBlob in IndexedDB
  const recordToStore = {
    id: track.id,
    name: track.name,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    size: track.size,
    type: track.type,
    extension: track.extension,
    path: track.path,
    addedAt: track.addedAt,
    lastPlayedAt: track.lastPlayedAt,
    playCount: track.playCount,
    isFavorite: track.isFavorite,
    hasEmbeddedCover: track.hasEmbeddedCover,
    coverBlob: track.coverBlob,
    bitrate: track.bitrate,
    sampleRate: track.sampleRate,
    bitDepth: track.bitDepth,
    lossless: track.lossless,
    formatLabel: track.formatLabel,
    file: track.file, // Blob or File
  };

  await set(`${TRACKS_PREFIX}${track.id}`, recordToStore);
}

/**
 * Save multiple tracks in batch
 */
export async function saveTracksBatch(tracks: Track[]): Promise<void> {
  for (const track of tracks) {
    await saveTrack(track);
  }
}

/**
 * Remove a track from IndexedDB
 */
export async function deleteTrack(trackId: string): Promise<void> {
  await del(`${TRACKS_PREFIX}${trackId}`);
  // Also remove from playlists
  const playlists = await getPlaylists();
  let modified = false;
  const updatedPlaylists = playlists.map((p) => {
    if (p.trackIds.includes(trackId)) {
      modified = true;
      return {
        ...p,
        trackIds: p.trackIds.filter((id) => id !== trackId),
        updatedAt: Date.now(),
      };
    }
    return p;
  });
  if (modified) {
    await set(PLAYLISTS_KEY, updatedPlaylists);
  }
}

/**
 * Increments play count and updates lastPlayedAt timestamp
 */
export async function recordTrackPlayed(trackId: string): Promise<Track | null> {
  const key = `${TRACKS_PREFIX}${trackId}`;
  const track = await get<Track>(key);
  if (!track) return null;

  const updated: Track = {
    ...track,
    playCount: (track.playCount || 0) + 1,
    lastPlayedAt: Date.now(),
  };

  await set(key, updated);
  return updated;
}

/**
 * Toggle favorite status
 */
export async function toggleTrackFavorite(trackId: string): Promise<boolean> {
  const key = `${TRACKS_PREFIX}${trackId}`;
  const track = await get<Track>(key);
  if (!track) return false;

  const newStatus = !track.isFavorite;
  track.isFavorite = newStatus;
  await set(key, track);

  // Update Liked Songs playlist
  const playlists = await getPlaylists();
  let liked = playlists.find((p) => p.id === 'liked_songs');
  if (!liked) {
    liked = { ...DEFAULT_LIKED_PLAYLIST };
    playlists.push(liked);
  }

  if (newStatus) {
    if (!liked.trackIds.includes(trackId)) {
      liked.trackIds.unshift(trackId);
    }
  } else {
    liked.trackIds = liked.trackIds.filter((id) => id !== trackId);
  }
  liked.updatedAt = Date.now();
  await set(PLAYLISTS_KEY, playlists);

  return newStatus;
}

/**
 * Load all playlists
 */
export async function getPlaylists(): Promise<Playlist[]> {
  const playlists = await get<Playlist[]>(PLAYLISTS_KEY);
  if (!playlists || playlists.length === 0) {
    const initial = [DEFAULT_LIKED_PLAYLIST];
    await set(PLAYLISTS_KEY, initial);
    return initial;
  }
  return playlists;
}

/**
 * Create or update a playlist
 */
export async function savePlaylist(playlist: Playlist): Promise<void> {
  const playlists = await getPlaylists();
  const existingIdx = playlists.findIndex((p) => p.id === playlist.id);
  if (existingIdx >= 0) {
    playlists[existingIdx] = {
      ...playlist,
      updatedAt: Date.now(),
    };
  } else {
    playlists.push({
      ...playlist,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  await set(PLAYLISTS_KEY, playlists);
}

/**
 * Delete a playlist
 */
export async function deletePlaylist(playlistId: string): Promise<void> {
  if (playlistId === 'liked_songs') return; // Cannot delete system Liked Songs
  const playlists = await getPlaylists();
  const filtered = playlists.filter((p) => p.id !== playlistId);
  await set(PLAYLISTS_KEY, filtered);
}

/**
 * Add tracks to a playlist
 */
export async function addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
  const playlists = await getPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (!playlist) return;

  for (const id of trackIds) {
    if (!playlist.trackIds.includes(id)) {
      playlist.trackIds.push(id);
    }
  }
  playlist.updatedAt = Date.now();
  await set(PLAYLISTS_KEY, playlists);
}

/**
 * Remove track from playlist
 */
export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  const playlists = await getPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (!playlist) return;

  playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
  playlist.updatedAt = Date.now();
  await set(PLAYLISTS_KEY, playlists);
}

/**
 * Playback state persistence
 */
export async function getPlaybackState(): Promise<PlaybackState | null> {
  return (await get<PlaybackState>(PLAYBACK_STATE_KEY)) || null;
}

export async function savePlaybackState(state: PlaybackState): Promise<void> {
  await set(PLAYBACK_STATE_KEY, state);
}

/**
 * User Profile persistence
 */
export async function getUserProfile(): Promise<UserProfile> {
  const profile = await get<UserProfile>(USER_PROFILE_KEY);
  if (profile) return profile;
  const defaultProfile: UserProfile = {
    name: 'Kumar',
    hasCompletedOnboarding: false,
  };
  await set(USER_PROFILE_KEY, defaultProfile);
  return defaultProfile;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await set(USER_PROFILE_KEY, profile);
}

/**
 * Format helpers
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const dayMs = 24 * 60 * 60 * 1000;
  if (diff < dayMs) {
    return 'Today';
  } else if (diff < 2 * dayMs) {
    return 'Yesterday';
  } else {
    const days = Math.floor(diff / dayMs);
    if (days < 30) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
