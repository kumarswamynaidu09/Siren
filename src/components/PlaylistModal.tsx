import React, { useState } from 'react';
import { Playlist, Track } from '../types';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), description.trim() || 'Custom curated rotation');
      setName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-surface-container-high border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-on-surface mb-1">Create New Playlist</h3>
        <p className="text-xs text-on-surface-variant mb-4">
          Organize your local tracks into a tailored acoustic session
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1">
              Playlist Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container px-3.5 py-2.5 rounded-xl text-on-surface text-sm border border-white/5 focus:border-primary-container focus:outline-none"
              placeholder="e.g. Night Drive, Workout Beats"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface-container px-3.5 py-2.5 rounded-xl text-on-surface text-sm border border-white/5 focus:border-primary-container focus:outline-none"
              placeholder="e.g. High BPM energy boosters"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary-container text-white font-semibold text-xs rounded-full shadow-lg shadow-primary-container/20 active:scale-95 transition-all"
            >
              Create Playlist
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
