import React from 'react';

interface EmptyStateScreenProps {
  onOpenScanner: () => void;
}

export const EmptyStateScreen: React.FC<EmptyStateScreenProps> = ({ onOpenScanner }) => {
  return (
    <div className="flex flex-col w-full max-w-sm mx-auto items-center justify-center px-6 pt-28 pb-48 text-center relative overflow-hidden min-h-[75vh]">
      {/* Ambient background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-72 h-72 rounded-full bg-primary-container blur-[100px]" />
      </div>

      {/* Center Card Container */}
      <div className="flex flex-col items-center w-full transition-all duration-300 relative z-10">
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

        <div className="bg-surface-container/60 backdrop-blur-xl rounded-xl p-6 mb-8 w-full shadow-lg border border-white/[0.04]">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Let Siren find the music already on your device and curate your private listening space instantly.
          </p>
        </div>

        <button
          onClick={onOpenScanner}
          className="w-full h-14 bg-primary-container hover:bg-primary-container/90 text-white font-semibold text-sm rounded-full flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(255,86,37,0.4)] transition-transform active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">radar</span>
          <span>SCAN MY MUSIC</span>
        </button>
      </div>
    </div>
  );
};
