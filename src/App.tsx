import React, { useState, useEffect, useCallback } from 'react';
import { Track, Playlist, NavTab } from './types';
import {
  getAllTracks,
  getPlaylists,
  getUserProfile,
  saveUserProfile,
  deleteTrack as removeTrackFromDb,
  addTracksToPlaylist,
  savePlaylist,
  deletePlaylist as removePlaylistFromDb,
  UserProfile,
} from './utils/storage';
import { PlayerProvider } from './context/PlayerContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { MiniPlayer } from './components/MiniPlayer';
import { TrackDetailsModal } from './components/TrackDetailsModal';
import { QueueDrawer } from './components/QueueDrawer';
import { ActionSheet } from './components/ActionSheet';
import { CreatePlaylistModal } from './components/PlaylistModal';
import { ScanDeviceModal } from './components/ScanDeviceModal';
import { HomeScreen } from './screens/HomeScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { RotationScreen } from './screens/RotationScreen';
import { PlaylistsScreen } from './screens/PlaylistsScreen';
import { EmptyStateScreen } from './screens/EmptyStateScreen';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Kumar',
    hasCompletedOnboarding: false,
  });
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isLoading, setIsLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [actionSheetTrack, setActionSheetTrack] = useState<Track | null>(null);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);

  // Load initial data from local IndexedDB
  const refreshData = useCallback(async () => {
    try {
      const [storedTracks, storedPlaylists, storedProfile] = await Promise.all([
        getAllTracks(),
        getPlaylists(),
        getUserProfile(),
      ]);
      setTracks(storedTracks);
      setPlaylists(storedPlaylists);
      setUserProfile(storedProfile);
    } catch (err) {
      console.error('Error loading local storage data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle scanned audio files
  const handleScanComplete = async (newTracks: Track[]) => {
    const updatedTracks = await getAllTracks();
    setTracks(updatedTracks);
    const updatedPlaylists = await getPlaylists();
    setPlaylists(updatedPlaylists);

    if (!userProfile.hasCompletedOnboarding) {
      const updatedProfile = { ...userProfile, hasCompletedOnboarding: true };
      setUserProfile(updatedProfile);
      await saveUserProfile(updatedProfile);
    }
  };

  // Update listener profile name
  const handleUpdateProfile = async (name: string) => {
    const updated = { ...userProfile, name };
    setUserProfile(updated);
    await saveUserProfile(updated);
  };

  // Delete track from library
  const handleDeleteTrack = async (trackId: string) => {
    await removeTrackFromDb(trackId);
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    const updatedPlaylists = await getPlaylists();
    setPlaylists(updatedPlaylists);
  };

  // Add track to playlist
  const handleAddToPlaylist = async (playlistId: string, trackId: string) => {
    await addTracksToPlaylist(playlistId, [trackId]);
    const updatedPlaylists = await getPlaylists();
    setPlaylists(updatedPlaylists);
  };

  // Create new playlist
  const handleCreatePlaylist = async (name: string, description: string) => {
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      description,
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await savePlaylist(newPlaylist);
    setPlaylists((prev) => [...prev, newPlaylist]);
    return newPlaylist;
  };

  // Delete playlist
  const handleDeletePlaylist = async (playlistId: string) => {
    await removePlaylistFromDb(playlistId);
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#131315] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 shadow-xl border border-white/[0.06]">
          <img
            alt="SIREN Logo"
            className="w-10 h-10 object-contain animate-pulse"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJF8zDOCGg-nk6TTb4sRFVpfHPEcF_s66kwybFzHJxbAMYIo7V3_5RxrLSuhKdME1iSlux-nsJUVktJxDANDZRTeic85OKXJsSFX7yPOV7hNUVfJXKN7J9nAmX4mGRi8cOIygV4bp4a6OJGFCG_NVfFksjovov1A0ego6SVz7D-6w-YQuLSvX1_C-RXRyX6oT1hKWEooVDEpAJzuJMrgGtncDrDPFh-X2sFNuvYMWCPpZBRLPaauVt"
          />
        </div>
        <span className="text-xs uppercase tracking-widest text-primary-container font-mono font-bold">
          INITIALIZING SIREN
        </span>
      </div>
    );
  }

  const isEmptyLibrary = tracks.length === 0;

  return (
    <PlayerProvider tracks={tracks}>
      <div className="min-h-screen bg-[#131315] text-[#e5e1e4] flex flex-col relative select-none">
        {/* Main Header */}
        <Header
          userProfile={userProfile}
          onUpdateProfile={handleUpdateProfile}
          onOpenScanner={() => setIsScannerOpen(true)}
          title={
            currentTab === 'library'
              ? 'Library'
              : currentTab === 'rotation'
              ? 'Rotation'
              : currentTab === 'playlists'
              ? 'Playlists'
              : 'SIREN'
          }
        />

        {/* Viewport Content */}
        <main className="flex-1 flex flex-col relative">
          {isEmptyLibrary && currentTab === 'home' ? (
            <EmptyStateScreen onOpenScanner={() => setIsScannerOpen(true)} />
          ) : currentTab === 'home' ? (
            <HomeScreen
              tracks={tracks}
              userProfile={userProfile}
              onOpenScanner={() => setIsScannerOpen(true)}
              onSelectTab={setCurrentTab}
              onOpenActionSheet={setActionSheetTrack}
            />
          ) : currentTab === 'library' ? (
            <LibraryScreen
              tracks={tracks}
              playlists={playlists}
              onOpenActionSheet={setActionSheetTrack}
              onOpenScanner={() => setIsScannerOpen(true)}
              onCreatePlaylist={handleCreatePlaylist}
              onAddToPlaylist={handleAddToPlaylist}
              onSelectTab={setCurrentTab}
            />
          ) : currentTab === 'rotation' ? (
            <RotationScreen
              tracks={tracks}
              onOpenActionSheet={setActionSheetTrack}
              onOpenScanner={() => setIsScannerOpen(true)}
            />
          ) : currentTab === 'playlists' ? (
            <PlaylistsScreen
              playlists={playlists}
              tracks={tracks}
              onOpenCreateModal={() => setIsCreatePlaylistOpen(true)}
              onOpenActionSheet={setActionSheetTrack}
              onDeletePlaylist={handleDeletePlaylist}
              onOpenScanner={() => setIsScannerOpen(true)}
            />
          ) : null}
        </main>

        {/* Mini Player */}
        <MiniPlayer />

        {/* Bottom Navigation */}
        <BottomNav currentTab={currentTab} onSelectTab={setCurrentTab} />

        {/* Full Screen Player */}
        <TrackDetailsModal />

        {/* Queue Drawer */}
        <QueueDrawer />

        {/* Track Context Action Sheet */}
        <ActionSheet
          track={actionSheetTrack}
          isOpen={actionSheetTrack !== null}
          onClose={() => setActionSheetTrack(null)}
          playlists={playlists}
          onAddToPlaylist={handleAddToPlaylist}
          onDeleteTrack={handleDeleteTrack}
          onOpenCreatePlaylist={() => {
            setActionSheetTrack(null);
            setIsCreatePlaylistOpen(true);
          }}
        />

        {/* Create Playlist Modal */}
        <CreatePlaylistModal
          isOpen={isCreatePlaylistOpen}
          onClose={() => setIsCreatePlaylistOpen(false)}
          onCreate={handleCreatePlaylist}
        />

        {/* Storage / Device Scanner Modal */}
        <ScanDeviceModal
          isOpen={isScannerOpen}
          isOnboarding={isEmptyLibrary}
          onClose={() => setIsScannerOpen(false)}
          onScanComplete={handleScanComplete}
        />
      </div>
    </PlayerProvider>
  );
}
