/**
 * @fileoverview Root component with character selection and workspace.
 * @module App
 */

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { CharacterProvider, useCharacterContext } from './context';
import { CharacterWorkspace } from './components/workspace';
import { WelcomeTutorial } from './components/WelcomeTutorial';
import { characterImportService } from './services/CharacterImportService';
import type { Character } from './db';
import {
  Users,
  Plus,
  Trash2,
  Copy,
  Moon,
  Sun,
  Clock,
  User,
  Upload,
  Search,
  Play,
  X,
  HelpCircle
} from 'lucide-react';

// --- Utility Components ---

import type { LucideIcon } from 'lucide-react';

const IconButton = ({ 
  icon: Icon, 
  onClick, 
  title, 
  variant = 'ghost',
  className = "",
  type = 'button'
}: { 
  icon: LucideIcon, 
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void, 
  title?: string, 
  variant?: 'ghost' | 'primary' | 'danger',
  className?: string,
  type?: 'button' | 'submit' | 'reset'
}) => {
  const baseStyle = "p-2 rounded-lg transition-all duration-200 active:scale-95";
  const variants = {
    ghost: "text-vault-500 hover:text-vault-900 dark:text-vault-400 dark:hover:text-vault-100 hover:bg-vault-100 dark:hover:bg-vault-800",
    primary: "bg-vault-900 dark:bg-vault-50 text-white dark:text-vault-900 hover:opacity-90 shadow-sm",
    danger: "text-vault-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
  };

  return (
    <button 
      type={type}
      onClick={onClick} 
      title={title} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};

// --- Main Components ---

/**
 * Modern Character Card - Portrait Style
 */
interface CharacterCardProps {
  character: Character;
  onOpen: (id: string) => void;
  onDuplicate: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
}

function CharacterCard({ character, onOpen, onDuplicate, onDelete }: CharacterCardProps): React.ReactElement {
  const formatRelativeTime = (timestamp?: string) => {
    if (!timestamp) return 'New';
    const diff = new Date().getTime() - new Date(timestamp).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;
  };

  return (
    <div 
      className="group relative flex flex-col bg-white dark:bg-vault-900 rounded-xl border border-vault-200 dark:border-vault-800 
      hover:border-vault-300 dark:hover:border-vault-700 shadow-xs hover:shadow-lg
      transition-all duration-300 overflow-hidden cursor-pointer"
      onClick={() => onOpen(character.id)}
    >
      {/* Image Area - Aspect Ratio for Character Cards */}
      <div className="relative aspect-3/4 w-full overflow-hidden bg-vault-100 dark:bg-vault-800">
        {character.imageData ? (
          <img
            src={character.imageData}
            alt={character.name}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 will-change-transform"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-vault-300 dark:text-vault-700">
            <User className="w-16 h-16" />
          </div>
        )}
        
        {/* Hover Overlay Gradient */}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Quick Actions Overlay */}
        <div className="absolute top-2 right-2 flex gap-1 transition-all duration-200 
          opacity-100 translate-y-0 
          sm:opacity-0 sm:-translate-y-2 
          sm:group-hover:opacity-100 sm:group-hover:translate-y-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(character.id, character.name); }}
            className="p-1.5 bg-white/90 dark:bg-vault-900/90 backdrop-blur-sm rounded-md text-vault-600 dark:text-vault-300 hover:text-vault-900 hover:bg-white shadow-sm"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(character.id, character.name); }}
            className="p-1.5 bg-white/90 dark:bg-vault-900/90 backdrop-blur-sm rounded-md text-red-500 hover:text-red-600 hover:bg-white shadow-sm"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-vault-900 dark:text-vault-50 truncate text-sm leading-tight">
            {character.name}
          </h3>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5 text-xs text-vault-500 dark:text-vault-400">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(character.lastOpenedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Character Selection View
 */
function CharacterSelectionView({ onReplayTutorial }: { onReplayTutorial: () => void }): React.ReactElement {
  const {
    characters,
    isLoading,
    createCharacter,
    openCharacter,
    deleteCharacter,
    duplicateCharacter,
    refreshCharacters,
  } = useCharacterContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [deleteConfirmState, setDeleteConfirmState] = useState<{ id: string; name: string } | null>(null);
  const [copyConfirmState, setCopyConfirmState] = useState<{ id: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination
  const getPageSize = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 12 : 18);
  const [visibleCount, setVisibleCount] = useState(getPageSize);

  // Reset pagination when search changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setVisibleCount(getPageSize());
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Theme Management
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof document === 'undefined') return true;
    return document.documentElement.classList.contains('dark');
  });

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  // Logic
  const sortedCharacters = useMemo(() => {
    let result = [...characters];
    if (searchQuery) {
      result = result.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return result.sort((a, b) => {
      const dateA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
      const dateB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [characters, searchQuery]);

  const lastActive = sortedCharacters[0];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharacterName.trim()) return;
    try {
      await createCharacter({ name: newCharacterName.trim() });
      setNewCharacterName('');
      setIsCreating(false);
    } catch {
      alert('Failed to create character');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await characterImportService.importFromFile(file);
      if (result.success && result.character) {
        await refreshCharacters();
        // Optional: Open immediately
        // openCharacter(result.character.id);
      } else {
        alert(result.error);
      }
    } catch {
      alert('Import failed');
    }
    e.target.value = '';
  };

  // Delete confirmation handlers
  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirmState({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmState) {
      await deleteCharacter(deleteConfirmState.id);
      setDeleteConfirmState(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmState(null);
  };

  // Copy confirmation handlers
  const handleCopyClick = (id: string, name: string) => {
    setCopyConfirmState({ id, name });
  };

  const handleCopyConfirm = async () => {
    if (copyConfirmState) {
      await duplicateCharacter(copyConfirmState.id, `${copyConfirmState.name} (Copy)`);
      setCopyConfirmState(null);
    }
  };

  const handleCopyCancel = () => {
    setCopyConfirmState(null);
  };

  return (
    <div className="h-screen overflow-y-auto bg-vault-50 dark:bg-vault-950 text-vault-900 dark:text-vault-100 transition-colors duration-500 animate-fade-in-slow">
      
      {/* --- Sticky Header --- */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-xl bg-white/80 dark:bg-vault-950/80 border-b border-vault-200 dark:border-vault-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-2">
            <div className="p-2 bg-vault-900 dark:bg-vault-700 rounded-lg">
              <Users className="w-5 h-5 text-white dark:text-vault-100" />
            </div>
            <h1 className="font-bold text-lg tracking-tight hidden sm:block text-vault-900 dark:text-vault-100">Character Vault</h1>
          </div>

          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vault-400 group-focus-within:text-vault-600 dark:group-focus-within:text-vault-300 transition-colors" />
              <input 
                type="text" 
                placeholder="Search characters..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-vault-100 dark:bg-vault-900 border border-transparent focus:bg-white dark:focus:bg-vault-800 focus:border-vault-300 dark:focus:border-vault-700 rounded-full py-1.5 pl-9 pr-4 text-sm transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <input ref={fileInputRef} type="file" accept=".png,.json,image/png,application/json" onChange={handleImport} className="hidden" />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-vault-600 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="sm:hidden p-2 text-vault-600 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg transition-colors"
              title="Import"
            >
              <Upload className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-vault-200 dark:bg-vault-800 mx-1 hidden sm:block" />
            
            <IconButton 
              icon={isDark ? Sun : Moon} 
              onClick={toggleTheme} 
              title="Toggle Theme" 
            />

            <IconButton 
              icon={HelpCircle} 
              onClick={onReplayTutorial} 
              title="Replay Tutorial" 
            />
            
            <button 
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-vault-900 dark:bg-vault-700 text-white dark:text-vault-100 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity ml-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Search Bar */}
      <div className="sm:hidden px-4 pt-3">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vault-400 group-focus-within:text-vault-600 dark:group-focus-within:text-vault-300 transition-colors" />
          <input 
            type="text" 
            placeholder="Search characters..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-vault-100 dark:bg-vault-900 border border-transparent focus:bg-white dark:focus:bg-vault-800 focus:border-vault-300 dark:focus:border-vault-700 rounded-full py-2 pl-9 pr-4 text-sm transition-all outline-none"
          />
        </div>
      </div>

      {/* --- Main Content --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Create Modal/Inline Area */}
        {isCreating && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-2">
            <form onSubmit={handleCreate} className="bg-white dark:bg-vault-900 p-4 rounded-2xl border border-vault-200 dark:border-vault-800 shadow-lg max-w-lg mx-auto flex gap-2 items-center">
              <input
                autoFocus
                type="text"
                placeholder="Character Name..."
                value={newCharacterName}
                onChange={(e) => setNewCharacterName(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 text-lg font-medium placeholder:text-vault-300 dark:placeholder:text-vault-700"
              />
              <div className="flex gap-2">
                <IconButton icon={X} onClick={() => setIsCreating(false)} title="Cancel" />
                <button 
                  type="submit" 
                  disabled={!newCharacterName.trim()}
                  className="px-4 py-2 bg-vault-900 dark:bg-vault-50 text-white dark:text-vault-900 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Quick Resume & Stats Bar */}
        {characters.length > 0 && !searchQuery && (
          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Library</h2>
              <p className="text-vault-500 dark:text-vault-400 text-sm mt-1">
                {characters.length} {characters.length === 1 ? 'character' : 'characters'} stored locally
              </p>
            </div>
            
            {lastActive && (
              <button
                onClick={() => openCharacter(lastActive.id)}
                className="group flex items-center gap-3 pl-4 pr-3 py-2 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-full hover:border-vault-300 dark:hover:border-vault-700 hover:shadow-md transition-all"
              >
                <div className="text-right">
                  <p className="text-[10px] font-bold text-vault-400 uppercase tracking-wider">Continue</p>
                  <p className="text-sm font-semibold max-w-37.5 truncate">{lastActive.name}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-vault-100 dark:bg-vault-800 flex items-center justify-center group-hover:bg-vault-900 group-hover:text-white dark:group-hover:bg-vault-50 dark:group-hover:text-vault-900 transition-colors">
                  <Play className="w-4 h-4 fill-current" />
                </div>
              </button>
            )}
          </div>
        )}

        {/* Character Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
             {[...Array(5)].map((_, i) => (
                <div key={i} className="aspect-3/4 rounded-xl bg-vault-100 dark:bg-vault-800/50 animate-pulse" />
             ))}
          </div>
        ) : sortedCharacters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-vault-100 dark:bg-vault-900 rounded-full flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-vault-300 dark:text-vault-700" />
            </div>
            <h3 className="text-lg font-medium">No characters found</h3>
            <p className="text-vault-500 dark:text-vault-400 mt-2 mb-8 max-w-sm">
              {searchQuery ? `No results for "${searchQuery}"` : "Get started by creating a new character or importing a card."}
            </p>
            {!searchQuery && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 border border-vault-300 dark:border-vault-700 rounded-xl hover:bg-vault-50 dark:hover:bg-vault-900 transition-colors font-medium"
              >
                Import Card
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {sortedCharacters.slice(0, visibleCount).map((char) => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  onOpen={openCharacter}
                  onDuplicate={handleCopyClick}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
            {visibleCount < sortedCharacters.length && (
              <div className="flex justify-center pt-8 pb-20">
                <button
                  onClick={() => setVisibleCount(prev => prev + getPageSize())}
                  className="group flex items-center gap-2 px-8 py-3 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-full hover:border-vault-400 dark:hover:border-vault-600 hover:shadow-md transition-all text-sm font-medium text-vault-600 dark:text-vault-300"
                >
                  Load More
                  <span className="text-xs text-vault-400 dark:text-vault-500">
                    ({sortedCharacters.length - visibleCount} remaining)
                  </span>
                </button>
              </div>
            )}
            {visibleCount >= sortedCharacters.length && <div className="pb-20" />}
          </>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-vault-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-vault-900 dark:text-vault-100">Delete Character?</h3>
            </div>
            <p className="text-vault-600 dark:text-vault-400 mb-6">
              Are you sure you want to delete <span className="font-medium text-vault-900 dark:text-vault-100">{deleteConfirmState.name}</span>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-sm font-medium text-vault-600 dark:text-vault-400 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Confirmation Modal */}
      {copyConfirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-vault-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Copy className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-vault-900 dark:text-vault-100">Copy Character?</h3>
            </div>
            <p className="text-vault-600 dark:text-vault-400 mb-6">
              Are you sure you want to create a copy of <span className="font-medium text-vault-900 dark:text-vault-100">{copyConfirmState.name}</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCopyCancel}
                className="px-4 py-2 text-sm font-medium text-vault-600 dark:text-vault-400 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main app content component
 */
function AppContent(): React.ReactElement {
  const { isCharacterOpen } = useCharacterContext();
  const [showTutorial, setShowTutorial] = useState(() => !(WelcomeTutorial.isCompleted?.() ?? false));

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const handleReplayTutorial = useCallback(() => {
    WelcomeTutorial.reset?.();
    setShowTutorial(true);
  }, []);

  return (
    <>
      {showTutorial && <WelcomeTutorial onComplete={handleTutorialComplete} />}
      {isCharacterOpen ? <CharacterWorkspace /> : <CharacterSelectionView onReplayTutorial={handleReplayTutorial} />}
    </>
  );
}

/**
 * Root app component
 */
function App(): React.ReactElement {
  return (
    <CharacterProvider>
      <AppContent />
    </CharacterProvider>
  );
}

export default App;