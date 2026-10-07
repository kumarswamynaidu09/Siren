import React, { useState } from 'react';
import { UserProfile } from '../utils/storage';

interface HeaderProps {
  userProfile: UserProfile;
  onUpdateProfile: (name: string) => void;
  onOpenScanner: () => void;
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  userProfile,
  onUpdateProfile,
  onOpenScanner,
  title = 'SIREN',
  onBack,
  showBack = false,
}) => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(userProfile.name || 'Kumar');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('siren_ai_api_key') || '');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim()) {
      onUpdateProfile(editName.trim());
    }
    if (apiKey.trim()) {
      localStorage.setItem('siren_ai_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('siren_ai_api_key');
    }
    setIsProfileModalOpen(false);
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-[#131315]/90 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="h-16 max-w-xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && onBack ? (
              <button
                onClick={onBack}
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-all"
                aria-label="Go back"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
              </button>
            ) : null}

            {/* Siren Logo & Brand */}
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => !showBack && onOpenScanner()}>
              <img
                alt="SIREN Logo"
                className="h-8 w-auto object-contain"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJF8zDOCGg-nk6TTb4sRFVpfHPEcF_s66kwybFzHJxbAMYIo7V3_5RxrLSuhKdME1iSlux-nsJUVktJxDANDZRTeic85OKXJsSFX7yPOV7hNUVfJXKN7J9nAmX4mGRi8cOIygV4bp4a6OJGFCG_NVfFksjovov1A0ego6SVz7D-6w-YQuLSvX1_C-RXRyX6oT1hKWEooVDEpAJzuJMrgGtncDrDPFh-X2sFNuvYMWCPpZBRLPaauVt"
              />
              <span className="font-bold tracking-tight text-lg uppercase text-on-surface">
                {title}
              </span>
            </div>
          </div>

          {/* Right Action Icons: Scan device & User avatar */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenScanner}
              title="Scan Android device for music"
              className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">radar</span>
            </button>

            <button
              onClick={() => setIsProfileModalOpen(true)}
              title="User Profile"
              className="w-8 h-8 rounded-full bg-primary hover:brightness-110 flex items-center justify-center active:scale-95 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </button>
          </div>
        </div>
      </header>

      {/* Profile Dialog */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-high border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center font-bold">
                  {editName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">Listener Profile</h3>
                  <p className="text-xs text-on-surface-variant">Local device profile</p>
                </div>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs text-on-surface-variant block mb-1.5 font-medium">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-surface-container px-3.5 py-2.5 rounded-xl text-on-surface text-sm border border-white/5 focus:border-primary-container focus:outline-none transition-colors"
                  placeholder="e.g. Kumar"
                  maxLength={30}
                />
              </div>

              <div>
                <label className="text-xs text-on-surface-variant block mb-1.5 font-medium">
                  Siren AI API Key (Mistral or Gemini)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-surface-container px-3.5 py-2.5 rounded-xl text-on-surface text-sm border border-white/5 focus:border-primary-container focus:outline-none transition-colors"
                  placeholder="Optional: Enter API key or leave blank for offline AI"
                />
                <p className="text-[11px] text-on-surface-variant/70 mt-1">
                  Built-in Smart Offline Assistant works without an API key.
                </p>
              </div>

              <div className="bg-surface-container/70 rounded-xl p-3 text-xs text-on-surface-variant space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Siren AI Assistant:</span>
                  <span className="text-primary-container font-medium">Active (Local + Cloud)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Audio Engine:</span>
                  <span className="text-on-surface font-mono">Web Media / ExoPlayer</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Local Database:</span>
                  <span className="text-on-surface font-mono">Persistent IndexedDB</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-primary-container text-white text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary-container/20"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
