export interface Track {
  id: string;
  name: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  size: number; // bytes
  type: string; // mime type e.g. audio/mpeg
  extension: string; // mp3, flac, wav, etc.
  path: string; // directory / storage path
  addedAt: number;
  lastPlayedAt: number | null;
  playCount: number;
  isFavorite: boolean;
  hasEmbeddedCover: boolean;
  coverArtUrl?: string; // object URL or data URL
  coverBlob?: Blob; // stored in IndexedDB
  bitrate?: number; // kbps
  sampleRate?: number; // Hz e.g. 44100, 48000, 96000
  bitDepth?: number; // 16, 24, 32
  lossless?: boolean;
  formatLabel?: string;
  file?: File | Blob; // the actual audio blob/file for playback
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  isSystem?: boolean; // e.g. "Liked Songs"
  customCover?: string;
}

export interface PlaybackState {
  currentTrackId: string | null;
  currentTime: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  queueIds: string[];
}

export type NavTab = 'home' | 'library' | 'rotation' | 'playlists';
export type LibraryTab = 'songs' | 'albums' | 'artists' | 'folders';
export type RotationFilter = 'all' | 'month' | 'week';
export type SortOption = 'Recently Played' | 'Most Played' | 'Alphabetical' | 'Artist' | 'Date Added';

export interface OnlineMusicResult {
  title: string;
  artist: string;
  album?: string;
  source: string;
  url: string;
  previewUrl?: string;
  artworkUrl?: string;
  playableStatus: string;
}

export interface TrackSummary {
  id: string;
  title: string;
  artist: string;
  album: string;
  filename: string;
  playCount: number;
  isFavorite: boolean;
  lastPlayedAt: number | null;
  addedAt: number;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  description: string;
  trackCount: number;
}

export type MistralToolName =
  | 'search_local_music'
  | 'play_local_track'
  | 'get_rotation'
  | 'get_favorites'
  | 'get_recently_added'
  | 'get_recently_played'
  | 'create_playlist'
  | 'add_tracks_to_playlist'
  | 'search_online_music';

export interface MistralToolCall {
  name: MistralToolName;
  args: Record<string, any>;
}

export interface SirenAiResponse {
  toolCall?: MistralToolCall;
  message?: string;
  onlineResults?: OnlineMusicResult[];
  error?: string;
  code?: 'MISSING_API_KEY' | 'API_ERROR' | 'UNKNOWN';
}

