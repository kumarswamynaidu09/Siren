import React from 'react';
import { NavTab } from '../types';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const tabs: { id: NavTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'library', label: 'Library', icon: 'library_music' },
    { id: 'rotation', label: 'Rotation', icon: 'autorenew' },
    { id: 'playlists', label: 'Playlists', icon: 'queue_music' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#131315]/95 backdrop-blur-2xl border-t border-white/[0.04] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex justify-around items-center h-16 max-w-xl mx-auto px-4">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-primary-container font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className="material-symbols-outlined text-[24px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </span>
              <span className="text-[11px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
