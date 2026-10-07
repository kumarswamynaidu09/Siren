import React, { useState, useRef } from 'react';
import { Track } from '../types';
import { parseAudioMetadata } from '../utils/id3Parser';
import { saveTracksBatch } from '../utils/storage';

interface ScanDeviceModalProps {
  isOpen: boolean;
  isOnboarding?: boolean;
  onClose: () => void;
  onScanComplete: (newTracks: Track[]) => void;
}

export const ScanDeviceModal: React.FC<ScanDeviceModalProps> = ({
  isOpen,
  isOnboarding = false,
  onClose,
  onScanComplete,
}) => {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Searching local storage & directories');
  const [discoveredTracks, setDiscoveredTracks] = useState<Track[]>([]);
  const [scannedStats, setScannedStats] = useState({ songs: 0, artists: 0, albums: 0 });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Process selected File objects
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      return (
        f.type.startsWith('audio/') ||
        ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'wma', 'aiff', 'alac'].includes(ext)
      );
    });

    if (fileArray.length === 0) {
      alert('No audio files detected in selection. Please select audio files (.mp3, .flac, .wav, .m4a, etc.)');
      return;
    }

    setScanState('scanning');
    setProgress(5);
    setStatusText('Indexing audio metadata...');

    const statuses = [
      'Searching local storage & directories',
      'Indexing audio metadata...',
      'Discovering album art...',
      'Organizing artist rotations...',
      'Optimizing lossless stream...',
    ];

    const parsedTracks: Track[] = [];
    const total = fileArray.length;

    for (let i = 0; i < total; i++) {
      const file = fileArray[i];
      try {
        const metadata = await parseAudioMetadata(file);
        const track: Track = {
          ...metadata,
          id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          addedAt: Date.now() - (total - i) * 1000,
          lastPlayedAt: null,
          playCount: 0,
          isFavorite: false,
        };
        parsedTracks.push(track);
      } catch (err) {
        console.warn('Error reading track:', file.name, err);
      }

      const percent = Math.min(98, Math.round(((i + 1) / total) * 100));
      setProgress(percent);

      if (percent > 75) {
        setStatusText(statuses[4]);
      } else if (percent > 50) {
        setStatusText(statuses[3]);
      } else if (percent > 25) {
        setStatusText(statuses[2]);
      } else {
        setStatusText(statuses[1]);
      }
    }

    // Persist to local IndexedDB
    await saveTracksBatch(parsedTracks);

    // Calculate unique artists & albums
    const uniqueArtists = new Set(parsedTracks.map((t) => t.artist)).size;
    const uniqueAlbums = new Set(parsedTracks.map((t) => t.album)).size;

    setProgress(100);
    setScannedStats({
      songs: parsedTracks.length,
      artists: uniqueArtists,
      albums: uniqueAlbums,
    });
    setDiscoveredTracks(parsedTracks);

    setTimeout(() => {
      setScanState('complete');
    }, 400);
  };

  // Trigger native directory picker (File System Access API) if available
  const handleScanDirectory = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const files: File[] = [];
        await scanDirectoryHandle(dirHandle, files, '');
        if (files.length > 0) {
          processFiles(files);
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('DirectoryPicker not supported or aborted, falling back to input:', err);
      }
    }

    // Fallback: trigger hidden input
    if (folderInputRef.current) {
      folderInputRef.current.click();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Recursively read directory handle
  const scanDirectoryHandle = async (handle: any, fileList: File[], path: string) => {
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus'].includes(ext)) {
          // preserve virtual relative path
          (file as any).webkitRelativePath = path ? `${path}/${file.name}` : file.name;
          fileList.push(file);
        }
      } else if (entry.kind === 'directory') {
        await scanDirectoryHandle(entry, fileList, path ? `${path}/${entry.name}` : entry.name);
      }
    }
  };

  const handleFinish = () => {
    onScanComplete(discoveredTracks);
    setScanState('idle');
    setProgress(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#131315]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
      {/* Hidden file inputs for cross-platform / Android MediaStore compatibility */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.wma"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
          }
        }}
      />
      <input
        type="file"
        ref={folderInputRef}
        multiple
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
          }
        }}
      />

      {/* Ambient background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-80 h-80 rounded-full bg-primary-container blur-[110px]" />
      </div>

      {/* Close button if not onboarding */}
      {!isOnboarding && scanState !== 'scanning' && (
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer z-20"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      )}

      {/* STATE 1: IDLE / INITIAL */}
      {scanState === 'idle' && (
        <div className="flex flex-col items-center w-full max-w-sm transition-all duration-300 relative z-10">
          <div className="w-24 h-24 rounded-2xl bg-surface-container-high/60 backdrop-blur-xl p-4 flex items-center justify-center shadow-2xl mb-6 border border-white/[0.06]">
            <img
              alt="SIREN Logo"
              className="w-full h-full object-contain"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJF8zDOCGg-nk6TTb4sRFVpfHPEcF_s66kwybFzHJxbAMYIo7V3_5RxrLSuhKdME1iSlux-nsJUVktJxDANDZRTeic85OKXJsSFX7yPOV7hNUVfJXKN7J9nAmX4mGRi8cOIygV4bp4a6OJGFCG_NVfFksjovov1A0ego6SVz7D-6w-YQuLSvX1_C-RXRyX6oT1hKWEooVDEpAJzuJMrgGtncDrDPFh-X2sFNuvYMWCPpZBRLPaauVt"
            />
          </div>

          <h1 className="text-3xl font-extrabold text-on-surface mb-2 tracking-tight">SIREN</h1>
          <p className="text-sm font-medium text-primary mb-6">
            Your music. Your rotation. Nothing else.
          </p>

          <div className="bg-surface-container/60 backdrop-blur-xl rounded-xl p-5 mb-8 w-full shadow-lg border border-white/[0.04]">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Let Siren find the music already on your device and curate your private listening space instantly.
            </p>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              className="w-full h-14 bg-primary-container hover:bg-primary-container/90 text-white font-semibold text-sm rounded-full flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(255,86,37,0.4)] transition-transform active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">radar</span>
              <span>SCAN MY MUSIC</span>
            </button>

            <button
              onClick={handleScanDirectory}
              className="w-full h-11 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium rounded-full flex items-center justify-center gap-2 transition-colors cursor-pointer border border-white/[0.05]"
            >
              <span className="material-symbols-outlined text-[18px]">folder_open</span>
              <span>Scan Entire Music Folder</span>
            </button>
          </div>
        </div>
      )}

      {/* STATE 2: SCANNING PROGRESS */}
      {scanState === 'scanning' && (
        <div className="flex flex-col items-center w-full max-w-sm transition-all duration-300 relative z-10">
          <div className="relative w-32 h-32 flex items-center justify-center mb-8">
            <div className="absolute inset-0 rounded-full border-2 border-primary-container/20 animate-ping" />
            <div className="absolute inset-4 rounded-full border-2 border-primary-container/40 animate-pulse" />
            <div className="w-20 h-20 rounded-full bg-primary-container/10 backdrop-blur-xl flex items-center justify-center shadow-2xl">
              <span className="material-symbols-outlined text-primary-container text-[36px] animate-spin">
                autorenew
              </span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-on-surface mb-2">Scanning your music...</h2>
          <p className="text-xs text-on-surface-variant mb-6">{statusText}</p>

          <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden mb-3">
            <div
              className="bg-primary-container h-full transition-all duration-200 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className="text-xs text-primary font-bold font-mono">{progress}%</span>
        </div>
      )}

      {/* STATE 3: COMPLETE / SUMMARY */}
      {scanState === 'complete' && (
        <div className="flex flex-col items-center w-full max-w-sm transition-all duration-300 relative z-10">
          <div className="w-20 h-20 rounded-full bg-primary-container/20 backdrop-blur-xl flex items-center justify-center shadow-2xl mb-5 border border-primary-container/30">
            <span className="material-symbols-outlined text-primary-container text-[40px]">
              check_circle
            </span>
          </div>

          <h2 className="text-xl font-bold text-on-surface mb-1">Rotation Ready</h2>
          <p className="text-xs text-on-surface-variant mb-6">
            Your device acoustic profile is built.
          </p>

          <div className="bg-surface-container/80 backdrop-blur-xl rounded-xl p-4 mb-8 w-full shadow-lg grid grid-cols-3 gap-2 text-center border border-white/[0.04]">
            <div className="flex flex-col p-2.5 bg-surface-container-high/50 rounded-lg">
              <span className="text-xl font-bold text-primary font-mono">{scannedStats.songs}</span>
              <span className="text-[10px] text-on-surface-variant uppercase mt-1 tracking-wider">
                Songs
              </span>
            </div>
            <div className="flex flex-col p-2.5 bg-surface-container-high/50 rounded-lg">
              <span className="text-xl font-bold text-primary font-mono">{scannedStats.artists}</span>
              <span className="text-[10px] text-on-surface-variant uppercase mt-1 tracking-wider">
                Artists
              </span>
            </div>
            <div className="flex flex-col p-2.5 bg-surface-container-high/50 rounded-lg">
              <span className="text-xl font-bold text-primary font-mono">{scannedStats.albums}</span>
              <span className="text-[10px] text-on-surface-variant uppercase mt-1 tracking-wider">
                Albums
              </span>
            </div>
          </div>

          <button
            onClick={handleFinish}
            className="w-full h-14 bg-primary-container hover:bg-primary-container/90 text-white font-semibold text-sm rounded-full flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(255,86,37,0.4)] transition-transform active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">headphones</span>
            <span>ENTER SIREN</span>
          </button>
        </div>
      )}
    </div>
  );
};
