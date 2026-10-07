import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Track, PlaybackState } from '../types';
import { recordTrackPlayed, toggleTrackFavorite, savePlaybackState, getPlaybackState } from '../utils/storage';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  queue: Track[];
  currentIndex: number;
  audioWaveData: number[]; // real-time visualizer bars
  outputDeviceName: string;
  isFullScreenPlayerOpen: boolean;
  isQueueDrawerOpen: boolean;

  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleFavorite: (trackId: string) => Promise<void>;
  addToQueue: (track: Track) => void;
  playNextInQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setFullScreenPlayerOpen: (open: boolean) => void;
  setQueueDrawerOpen: (open: boolean) => void;
  refreshTrackInState: (trackId: string, updates: Partial<Track>) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode; tracks: Track[] }> = ({ children, tracks }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [audioWaveData, setAudioWaveData] = useState<number[]>([15, 30, 45, 60, 40, 25, 55, 35, 20]);
  const [outputDeviceName, setOutputDeviceName] = useState('Acoustic Studio Pods');
  const [isFullScreenPlayerOpen, setFullScreenPlayerOpen] = useState(false);
  const [isQueueDrawerOpen, setQueueDrawerOpen] = useState(false);

  // Play count tracking throttle
  const hasCountedPlayRef = useRef(false);

  // Initialize Audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Increment play count if listened for at least 25 seconds or 40% of duration
      if (!hasCountedPlayRef.current && currentTrack && (audio.currentTime > 25 || (audio.duration > 0 && audio.currentTime / audio.duration > 0.4))) {
        hasCountedPlayRef.current = true;
        recordTrackPlayed(currentTrack.id).then((updated) => {
          if (updated) {
            setCurrentTrack((prev) => (prev && prev.id === updated.id ? { ...prev, playCount: updated.playCount, lastPlayedAt: updated.lastPlayedAt } : prev));
          }
        });
      }
    };

    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Web Audio visualizer setup
  const initWebAudio = () => {
    if (audioCtxRef.current || !audioRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWave = () => {
        if (analyserRef.current && isPlaying) {
          analyserRef.current.getByteFrequencyData(dataArray);
          // Pick 12 representative frequency bands
          const bands: number[] = [];
          const step = Math.max(1, Math.floor(bufferLength / 12));
          for (let i = 0; i < 12; i++) {
            const val = dataArray[i * step] || 0;
            bands.push(Math.max(10, Math.round((val / 255) * 100)));
          }
          setAudioWaveData(bands);
        } else if (!isPlaying) {
          // Idle ambient level
          setAudioWaveData([15, 25, 40, 50, 30, 20, 35, 45, 30, 20, 15, 10]);
        }
        animFrameRef.current = requestAnimationFrame(updateWave);
      };
      updateWave();
    } catch (err) {
      console.warn('Web Audio Context not initialized yet (requires user gesture):', err);
    }
  };

  // Detect output devices if available
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const audioOut = devices.find((d) => d.kind === 'audiooutput' && d.label);
        if (audioOut && audioOut.label) {
          setOutputDeviceName(audioOut.label);
        }
      }).catch(() => {});
    }
  }, []);

  // Restore playback state on boot
  useEffect(() => {
    getPlaybackState().then((state) => {
      if (state) {
        setIsShuffle(state.isShuffle);
        setRepeatMode(state.repeatMode);
        setVolumeState(state.volume);
        if (audioRef.current) {
          audioRef.current.volume = state.volume;
        }
      }
    });
  }, []);

  // Save playback state updates
  useEffect(() => {
    const state: PlaybackState = {
      currentTrackId: currentTrack?.id || null,
      currentTime,
      volume,
      isShuffle,
      repeatMode,
      queueIds: queue.map((t) => t.id),
    };
    savePlaybackState(state);
  }, [currentTrack, isShuffle, repeatMode, volume, queue]);

  // Sync MediaSession with Android native lockscreen / notification shade
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork: currentTrack.coverArtUrl
          ? [
              { src: currentTrack.coverArtUrl, sizes: '96x96', type: 'image/jpeg' },
              { src: currentTrack.coverArtUrl, sizes: '128x128', type: 'image/jpeg' },
              { src: currentTrack.coverArtUrl, sizes: '256x256', type: 'image/jpeg' },
              { src: currentTrack.coverArtUrl, sizes: '512x512', type: 'image/jpeg' },
            ]
          : [
              {
                src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJF8zDOCGg-nk6TTb4sRFVpfHPEcF_s66kwybFzHJxbAMYIo7V3_5RxrLSuhKdME1iSlux-nsJUVktJxDANDZRTeic85OKXJsSFX7yPOV7hNUVfJXKN7J9nAmX4mGRi8cOIygV4bp4a6OJGFCG_NVfFksjovov1A0ego6SVz7D-6w-YQuLSvX1_C-RXRyX6oT1hKWEooVDEpAJzuJMrgGtncDrDPFh-X2sFNuvYMWCPpZBRLPaauVt',
                sizes: '512x512',
                type: 'image/jpeg',
              },
            ],
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current?.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        prevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextTrack();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
        }
      });
    }
  }, [currentTrack, isPlaying]);

  // Load and play a track
  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    initWebAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    let audioSrc = '';
    if (track.file) {
      audioSrc = URL.createObjectURL(track.file);
      objectUrlRef.current = audioSrc;
    }

    hasCountedPlayRef.current = false;
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);

    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex((t) => t.id === track.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else {
      // If not provided, ensure track is in current queue
      setQueue((prev) => {
        const existingIdx = prev.findIndex((t) => t.id === track.id);
        if (existingIdx >= 0) {
          setCurrentIndex(existingIdx);
          return prev;
        } else {
          setCurrentIndex(prev.length);
          return [...prev, track];
        }
      });
    }

    if (audioSrc) {
      audio.src = audioSrc;
      audio.load();
      audio.play().catch((err) => {
        console.warn('Playback initiation note:', err);
      });
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack && queue.length > 0) {
      playTrack(queue[0]);
      return;
    }

    initWebAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [currentTrack, queue, playTrack]);

  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;

    let nextIdx = currentIndex + 1;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else if (nextIdx >= queue.length) {
      if (repeatMode === 'all') {
        nextIdx = 0;
      } else {
        // Stop at end
        setIsPlaying(false);
        return;
      }
    }

    const next = queue[nextIdx];
    if (next) {
      setCurrentIndex(nextIdx);
      playTrack(next);
    }
  }, [queue, currentIndex, isShuffle, repeatMode, playTrack]);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    // If played more than 3 seconds, restart current track
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (queue.length === 0) return;
    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) {
      prevIdx = repeatMode === 'all' ? queue.length - 1 : 0;
    }

    const prev = queue[prevIdx];
    if (prev) {
      setCurrentIndex(prevIdx);
      playTrack(prev);
    }
  }, [queue, currentIndex, repeatMode, playTrack]);

  // Handle track ended
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        nextTrack();
      }
    };

    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [repeatMode, nextTrack]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }, []);

  const setVolume = useCallback((val: number) => {
    const audio = audioRef.current;
    const clamped = Math.max(0, Math.min(1, val));
    if (audio) {
      audio.volume = clamped;
    }
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const toggleFavorite = useCallback(async (trackId: string) => {
    const newStatus = await toggleTrackFavorite(trackId);
    if (currentTrack && currentTrack.id === trackId) {
      setCurrentTrack((prev) => (prev ? { ...prev, isFavorite: newStatus } : null));
    }
    setQueue((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isFavorite: newStatus } : t))
    );
  }, [currentTrack]);

  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const playNextInQueue = useCallback((track: Track) => {
    setQueue((prev) => {
      const copy = [...prev];
      copy.splice(currentIndex + 1, 0, track);
      return copy;
    });
  }, [currentIndex]);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
    if (index < currentIndex) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const clearQueue = useCallback(() => {
    if (currentTrack) {
      setQueue([currentTrack]);
      setCurrentIndex(0);
    } else {
      setQueue([]);
      setCurrentIndex(-1);
    }
  }, [currentTrack]);

  const refreshTrackInState = useCallback((trackId: string, updates: Partial<Track>) => {
    if (currentTrack && currentTrack.id === trackId) {
      setCurrentTrack((prev) => (prev ? { ...prev, ...updates } : null));
    }
    setQueue((prev) => prev.map((t) => (t.id === trackId ? { ...t, ...updates } : t)));
  }, [currentTrack]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffle,
        repeatMode,
        queue,
        currentIndex,
        audioWaveData,
        outputDeviceName,
        isFullScreenPlayerOpen,
        isQueueDrawerOpen,
        playTrack,
        togglePlayPause,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        toggleFavorite,
        addToQueue,
        playNextInQueue,
        removeFromQueue,
        clearQueue,
        setFullScreenPlayerOpen,
        setQueueDrawerOpen,
        refreshTrackInState,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
