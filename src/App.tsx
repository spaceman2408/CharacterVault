/**
 * @fileoverview Root component with character selection and workspace.
 * @module App
 */

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route } from 'react-router-dom';
import { CharacterProvider, useCharacterContext } from './context';
import { CharacterWorkspace } from './components/workspace';
import { WelcomeTutorial } from './components/WelcomeTutorial';
import { ImportPage } from './pages/ImportPage';
import { AICreationStudio } from './pages/ai-creation-studio/AICreationStudio';
import { characterImportService } from './services/CharacterImportService';
import { characterExportService } from './services/CharacterExportService';
import { formatTokenEstimate } from './services/AIService';
import { characterDb } from './db/CharacterDatabase';
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
  Download,
  Search,
  Play,
  X,
  HelpCircle,
  BookOpen,
  Sparkles,
  ArrowUpDown,
  Loader2,
  FileJson,
  Image as ImageIcon,
} from 'lucide-react';
import { PromoBanner } from './components/PromoBanner';
import type { CharacterListItem } from './db';

type VaultSortMode = 'name' | 'recent';
type CardExportFormat = 'png' | 'json';
const VAULT_SORT_STORAGE_KEY = 'characterVaultSort';

// --- Utility Components ---

import type { LucideIcon } from 'lucide-react';

const logoSrc = `${import.meta.env.BASE_URL}CharacterVaultLogo.svg`;

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
    ghost: "text-fg-muted hover:text-accent hover:bg-accent-soft",
    primary: "bg-accent text-accent-fg hover:opacity-90 shadow-sm",
    danger: "text-fg-subtle hover:text-danger hover:bg-danger-soft"
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
 * Uses CharacterListItem for lightweight rendering
 */
interface CharacterCardProps {
  character: CharacterListItem;
  onOpen: (id: string) => void;
  onDuplicate: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onExport: (id: string, format: CardExportFormat) => Promise<void>;
  isExporting?: boolean;
}

function CharacterCardSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <div className="aspect-3/4 w-full skeleton" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-4 w-3/4 rounded-md skeleton" />
        <div className="h-3 w-1/2 rounded-md skeleton" />
      </div>
    </div>
  );
}

const cardActionBtnBase =
  'inline-flex items-center justify-center min-h-9 min-w-9 sm:min-h-8 sm:min-w-8 p-2 sm:p-1.5 ' +
  'bg-surface/95 backdrop-blur-sm rounded-lg shadow-sm ' +
  'active:scale-95 transition-colors disabled:opacity-50 touch-manipulation';

const cardActionBtnClass =
  `${cardActionBtnBase} text-fg-muted hover:bg-accent-soft hover:text-accent`;

const cardActionBtnDangerClass =
  `${cardActionBtnBase} text-fg-muted hover:bg-danger-soft hover:text-danger`;

function CharacterCard({
  character,
  onOpen,
  onDuplicate,
  onDelete,
  onExport,
  isExporting = false,
}: CharacterCardProps): React.ReactElement {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const formatRelativeTime = (timestamp?: string) => {
    if (!timestamp) return 'New';
    const diff = new Date().getTime() - new Date(timestamp).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;
  };

  const openExportMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExporting) return;
    if (!exportBtnRef.current) return;

    const rect = exportBtnRef.current.getBoundingClientRect();
    const menuWidth = 168;
    const menuHeight = 96;
    const pad = 8;

    // Prefer below the button; flip above if near bottom. Prefer right-aligned to button.
    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - menuHeight - 6);
    }
    let left = rect.right - menuWidth;
    if (left < pad) left = pad;
    if (left + menuWidth > window.innerWidth - pad) {
      left = window.innerWidth - menuWidth - pad;
    }

    setMenuPosition({ top, left });
    setExportMenuOpen(true);
  };

  useEffect(() => {
    if (!exportMenuOpen) return;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        exportBtnRef.current?.contains(target) ||
        exportMenuRef.current?.contains(target)
      ) {
        return;
      }
      setExportMenuOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExportMenuOpen(false);
    };

    const handleViewportChange = () => setExportMenuOpen(false);

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [exportMenuOpen]);

  const handleExport = async (format: CardExportFormat) => {
    setExportMenuOpen(false);
    await onExport(character.id, format);
  };

  return (
    <div 
      className="group relative flex flex-col bg-surface rounded-xl border border-border hover:border-border-strong shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
      onClick={() => onOpen(character.id)}
    >
      {/* Image Area - Aspect Ratio for Character Cards */}
      <div className="relative aspect-3/4 w-full overflow-hidden bg-muted">
        {character.thumbnailData ? (
          <img
            src={character.thumbnailData}
            alt={character.name}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 will-change-transform"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-fg-subtle">
            <User className="w-16 h-16" />
          </div>
        )}
        
        {/* Hover Overlay Gradient — keep a light always-on scrim on mobile so actions stay readable */}
        <div className="absolute inset-0 bg-linear-to-t from-vault-950/55 via-transparent to-vault-950/20 sm:from-vault-950/65 sm:to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Quick Actions — always visible on mobile, hover-reveal on desktop */}
        <div
          className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex flex-row gap-1 transition-all duration-200 opacity-100 translate-y-0 sm:opacity-0 sm:-translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 sm:group-focus-within:opacity-100 sm:group-focus-within:translate-y-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            ref={exportBtnRef}
            type="button"
            onClick={openExportMenu}
            disabled={isExporting}
            className={cardActionBtnClass}
            title="Export"
            aria-label={`Export ${character.name}`}
            aria-expanded={exportMenuOpen}
            aria-haspopup="menu"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(character.id, character.name); }}
            className={cardActionBtnClass}
            title="Duplicate"
            aria-label={`Duplicate ${character.name}`}
          >
            <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(character.id, character.name); }}
            className={cardActionBtnDangerClass}
            title="Delete"
            aria-label={`Delete ${character.name}`}
          >
            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-3 sm:p-4 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-fg truncate text-sm leading-tight">
            {character.name}
          </h3>
        </div>
        
        <div className="flex items-center justify-between gap-2 mt-1.5 sm:mt-2">
          <div className="flex items-center gap-1.5 text-xs text-fg-muted min-w-0">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate">{formatRelativeTime(character.lastOpenedAt)}</span>
          </div>
          <span
            className="sm:text-[11px] tabular-nums text-fg-subtle shrink-0"
            title={
              `Active (RP always-on): ${character.activeTokens.toLocaleString()} tokens\n` +
              `Total (incl. greetings & lorebook): ${character.totalTokens.toLocaleString()} tokens`
            }
          >
            {formatTokenEstimate(character.activeTokens)}
            <span className="text-fg-subtle"> / </span>
            {formatTokenEstimate(character.totalTokens)}
          </span>
        </div>
      </div>

      {/* Export format menu (portaled so card overflow doesn't clip it) */}
      {exportMenuOpen && menuPosition && createPortal(
        <div
          ref={exportMenuRef}
          role="menu"
          aria-label={`Export ${character.name}`}
          className="fixed z-9999 w-44 rounded-xl border border-border bg-surface shadow-xl py-1 animate-in fade-in zoom-in-95"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 sm:py-2 text-sm text-fg hover:bg-accent-soft hover:text-accent active:bg-hover touch-manipulation"
            onClick={() => void handleExport('png')}
          >
            <ImageIcon className="w-4 h-4 shrink-0 text-fg-muted" />
            <span>Export PNG</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 sm:py-2 text-sm text-fg hover:bg-accent-soft hover:text-accent active:bg-hover touch-manipulation"
            onClick={() => void handleExport('json')}
          >
            <FileJson className="w-4 h-4 shrink-0 text-fg-muted" />
            <span>Export JSON</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * Character Selection View
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function CharacterSelectionView({ onReplayTutorial }: { onReplayTutorial: () => void }): React.ReactElement {
  const {
    characterListItems,
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
  const [sortMode, setSortMode] = useState<VaultSortMode>(() => {
    const stored = localStorage.getItem(VAULT_SORT_STORAGE_KEY);
    return stored === 'recent' || stored === 'name' ? stored : 'name';
  });
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingVault, setIsExportingVault] = useState(false);
  const [backupConfirmOpen, setBackupConfirmOpen] = useState(false);
  const [exportingCardId, setExportingCardId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Promo banner dismissal state
  const [isPromoDismissed, setIsPromoDismissed] = useState(() => {
    return localStorage.getItem('characterVaultPromoDismissed') === 'true';
  });

  const handlePromoDismiss = () => {
    localStorage.setItem('characterVaultPromoDismissed', 'true');
    setIsPromoDismissed(true);
  };

  const showStatus = useCallback((message: string, durationMs = 5000) => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    setStatusMessage(message);
    statusTimeoutRef.current = setTimeout(() => setStatusMessage(null), durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  // Pagination
  const getPageSize = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 12 : 18);
  const [pageSize, setPageSize] = useState(getPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination when search or sort changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, sortMode]);

  useEffect(() => {
    const handleResize = () => {
      setPageSize(getPageSize());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const handleSortChange = (mode: VaultSortMode) => {
    setSortMode(mode);
    localStorage.setItem(VAULT_SORT_STORAGE_KEY, mode);
  };

  // Logic - work with characterListItems for vault view
  // Search matches name or tags (tag matches are silent — no tag chips in the UI)
  const filteredCharacters = useMemo(() => {
    let result = [...characterListItems];
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c => {
        if (c.name.toLowerCase().includes(q)) return true;
        return (c.tags ?? []).some(tag => tag.toLowerCase().includes(q));
      });
    }
    return result;
  }, [characterListItems, searchQuery]);

  const sortedCharacters = useMemo(() => {
    const list = [...filteredCharacters];
    if (sortMode === 'recent') {
      return list.sort((a, b) => {
        const dateA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
        const dateB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    }
    return list.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    );
  }, [filteredCharacters, sortMode]);

  const lastActive = useMemo(() => {
    return [...characterListItems].sort((a, b) => {
      const dateA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
      const dateB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;

      if (dateB !== dateA) {
        return dateB - dateA;
      }

      return b.updatedAt.localeCompare(a.updatedAt);
    })[0];
  }, [characterListItems]);
  const totalPages = Math.max(1, Math.ceil(sortedCharacters.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const visibleCharacters = useMemo(
    () => sortedCharacters.slice(pageStart, pageStart + pageSize),
    [sortedCharacters, pageStart, pageSize]
  );
  const [areVisibleCardsReady, setAreVisibleCardsReady] = useState(false);
  // Track preloaded thumbs by character id only — never hold base64 strings in the Set
  const preloadedThumbIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isCancelled = false;

    const preloadVisibleCards = async () => {
      const visibleIds = new Set(visibleCharacters.map((c) => c.id));
      // Drop ids that left the current page so the set cannot grow without bound
      for (const id of preloadedThumbIdsRef.current) {
        if (!visibleIds.has(id)) {
          preloadedThumbIdsRef.current.delete(id);
        }
      }

      const imagesToPreload = visibleCharacters
        .filter((character) => {
          if (!character.thumbnailData) return false;
          return !preloadedThumbIdsRef.current.has(character.id);
        })
        .map(
          (character) =>
            new Promise<void>((resolve) => {
              const image = new Image();
              const imageSource = character.thumbnailData;
              let settled = false;

              const finalize = () => {
                if (settled) return;
                settled = true;
                preloadedThumbIdsRef.current.add(character.id);
                // Drop decoded bitmap reference promptly (browser cache still helps)
                image.onload = null;
                image.onerror = null;
                image.src = '';
                resolve();
              };

              image.onload = finalize;
              image.onerror = finalize;
              image.src = imageSource;

              if (image.complete) {
                finalize();
                return;
              }

              if (typeof image.decode === 'function') {
                image.decode().then(finalize).catch(finalize);
              }
            })
        );

      if (imagesToPreload.length === 0) {
        if (!isCancelled) {
          setAreVisibleCardsReady(true);
        }
        return;
      }

      setAreVisibleCardsReady(false);
      await Promise.all(imagesToPreload);

      if (!isCancelled) {
        requestAnimationFrame(() => {
          if (!isCancelled) {
            setAreVisibleCardsReady(true);
          }
        });
      }
    };

    void preloadVisibleCards();

    return () => {
      isCancelled = true;
    };
  }, [visibleCharacters]);

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

  const importFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) =>
        f.type === 'application/json' ||
        f.name.toLowerCase().endsWith('.json') ||
        f.type === 'image/png' ||
        f.name.toLowerCase().endsWith('.png')
    );

    if (fileArray.length === 0) {
      showStatus('No PNG or JSON character files found.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await characterImportService.importFromFiles(fileArray);
      await refreshCharacters();

      if (result.successCount === 0) {
        const firstError = result.errors[0];
        showStatus(
          firstError
            ? `Import failed: ${firstError.filename} — ${firstError.error}`
            : 'Import failed.',
          7000
        );
      } else if (result.failCount > 0) {
        showStatus(
          `Imported ${result.successCount} of ${fileArray.length}. ${result.failCount} failed.`,
          7000
        );
      } else {
        showStatus(
          result.successCount === 1
            ? `Imported “${result.characters[0]?.name ?? 'character'}”.`
            : `Imported ${result.successCount} characters.`
        );
      }
    } catch {
      showStatus('Import failed.');
    } finally {
      setIsImporting(false);
    }
  }, [refreshCharacters, showStatus]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await importFiles(files);
    e.target.value = '';
  };

  const handleBackupClick = () => {
    if (characterListItems.length === 0 || isExportingVault) return;
    setBackupConfirmOpen(true);
  };

  const handleBackupCancel = () => {
    if (isExportingVault) return;
    setBackupConfirmOpen(false);
  };

  const handleExportVault = async () => {
    if (characterListItems.length === 0 || isExportingVault) return;
    setIsExportingVault(true);
    try {
      const characters = await characterDb.getAllCharacters();
      const result = await characterExportService.exportVaultAsZip(characters);
      if (result.success && result.blob && result.filename) {
        downloadBlob(result.blob, result.filename);
        showStatus(
          result.error
            ? `Backup downloaded. ${result.error}`
            : `Vault backup downloaded (${characters.length} cards).`,
          6000
        );
        setBackupConfirmOpen(false);
      } else {
        showStatus(result.error || 'Failed to export vault backup.', 7000);
      }
    } catch {
      showStatus('Failed to export vault backup.');
    } finally {
      setIsExportingVault(false);
    }
  };

  const handleCardExport = useCallback(async (id: string, format: CardExportFormat) => {
    if (exportingCardId) return;
    setExportingCardId(id);
    try {
      const character = await characterDb.getCharacter(id);
      if (!character) {
        showStatus('Character not found.');
        return;
      }

      const result =
        format === 'png'
          ? await characterExportService.exportAsPNG(character)
          : await characterExportService.exportAsJSON(character);

      if (result.success && result.blob && result.filename) {
        downloadBlob(result.blob, result.filename);
        showStatus(
          format === 'png'
            ? `Exported “${character.name}” as PNG.`
            : `Exported “${character.name}” as JSON.`
        );
      } else {
        showStatus(
          result.error ||
            (format === 'png'
              ? 'PNG export failed. Add an image or export as JSON.'
              : 'Export failed.'),
          7000
        );
      }
    } catch {
      showStatus('Export failed.');
    } finally {
      setExportingCardId(null);
    }
  }, [exportingCardId, showStatus]);

  const isImportableDrag = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return false;
    // When available, prefer checking item types; otherwise allow drop and filter later
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return true;
    return Array.from(items).some(
      (item) =>
        item.kind === 'file' &&
        (item.type === 'application/json' ||
          item.type === 'image/png' ||
          item.type === '' ||
          item.type.startsWith('image/'))
    );
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isImportableDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isImportableDrag(e) && dragDepthRef.current === 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isImportableDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    if (isImporting) return;
    const files = e.dataTransfer.files;
    if (files?.length) {
      await importFiles(files);
    }
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
    <div
      className="h-dvh overflow-y-auto bg-bg text-fg transition-colors duration-500 animate-fade-in-slow relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag-and-drop import overlay */}
      {isDragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-white/50 bg-white/10 px-10 py-8 text-center text-white shadow-2xl">
            <Upload className="mx-auto mb-3 h-10 w-10 opacity-90" />
            <p className="text-lg font-semibold">Drop character cards to import</p>
            <p className="mt-1 text-sm text-white/70">PNG or JSON — multiple files supported</p>
          </div>
        </div>
      )}

      {/* Status toast */}
      {statusMessage && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-2 rounded-xl border border-border bg-surface/95 px-4 py-3 text-sm shadow-xl">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-fg">{statusMessage}</p>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="rounded p-0.5 text-fg-subtle hover:bg-accent-soft hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      
      {/* --- Sticky Header --- */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-xl bg-surface/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-2">
            <img
              src={logoSrc}
              alt="Character Vault Logo"
              className="shrink-0 h-8 w-auto sm:h-10 md:h-12 lg:h-14 transition-[filter] dark:grayscale"
            />
          </div>

          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle group-focus-within:text-fg-muted transition-colors" />
              <input 
                type="text" 
                placeholder="Search name or tags..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted border border-transparent focus:bg-surface focus:border-border-strong rounded-full py-1.5 pl-9 pr-4 text-sm transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.json,image/png,application/json"
              multiple
              onChange={handleImport}
              className="hidden"
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="sm:hidden p-2 text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
              title="Import"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </button>

            <button
              onClick={handleBackupClick}
              disabled={characterListItems.length === 0 || isExportingVault}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
              title="Download a ZIP backup of every character"
            >
              {isExportingVault ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Backup
            </button>

            <button
              onClick={handleBackupClick}
              disabled={characterListItems.length === 0 || isExportingVault}
              className="sm:hidden p-2 text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
              title="Backup vault"
            >
              {isExportingVault ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsCreating(true)}
              className="sm:hidden p-2 text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors"
              title="Create New"
            >
              <Plus className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-hover mx-1 hidden sm:block" />

            <a
              href="#/ai-create"
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-xl transition-colors duration-200"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">AI Create</span>
            </a>

            <a
              href="#/ai-create"
              className="sm:hidden p-2 text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors"
              title="AI Create"
            >
              <Sparkles className="w-4 h-4" />
            </a>

            <button
              onClick={() => setIsCreating(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-xl transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create New</span>
            </button>

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

            <a
              href={`${import.meta.env.BASE_URL}docs/`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg transition-all duration-200 active:scale-95 text-fg-muted hover:text-accent hover:bg-accent-soft"
              title="Documentation"
            >
              <BookOpen className="w-4 h-4" />
            </a>

          </div>
        </div>
      </header>

      {/* Mobile Search Bar */}
      <div className="sm:hidden px-4 pt-3">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle group-focus-within:text-fg-muted transition-colors" />
          <input 
            type="text" 
            placeholder="Search name or tags..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted border border-transparent focus:bg-surface focus:border-border-strong rounded-full py-2 pl-9 pr-4 text-sm transition-all outline-none"
          />
        </div>
      </div>

      {/* --- Main Content --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Create Modal/Inline Area */}
        {isCreating && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-2">
            <form onSubmit={handleCreate} className="bg-surface p-4 rounded-2xl border border-border shadow-lg max-w-lg mx-auto flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-center">
              <input
                autoFocus
                type="text"
                placeholder="Character Name..."
                value={newCharacterName}
                onChange={(e) => setNewCharacterName(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 text-base sm:text-lg font-medium placeholder:text-fg-subtle min-w-0"
              />
              <div className="flex gap-2 shrink-0">
                <IconButton icon={X} onClick={() => setIsCreating(false)} title="Cancel" />
                <button
                  type="submit"
                  disabled={!newCharacterName.trim()}
                  className="px-4 py-2 bg-accent text-accent-fg rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Quick Resume & Stats Bar */}
        {characterListItems.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Library</h2>
              <p className="text-fg-muted text-sm mt-1">
                {searchQuery
                  ? `${sortedCharacters.length} of ${characterListItems.length} ${characterListItems.length === 1 ? 'character' : 'characters'}`
                  : `${characterListItems.length} ${characterListItems.length === 1 ? 'character' : 'characters'} stored locally`}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-fg-subtle ml-2" />
                <button
                  type="button"
                  onClick={() => handleSortChange('name')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    sortMode === 'name'
                      ? 'bg-accent text-accent-fg'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  Name
                </button>
                <button
                  type="button"
                  onClick={() => handleSortChange('recent')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    sortMode === 'recent'
                      ? 'bg-accent text-accent-fg'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  Recent
                </button>
              </div>

              {!searchQuery && lastActive && (
                <button
                  onClick={() => openCharacter(lastActive.id)}
                  className="group flex items-center gap-3 pl-4 pr-3 py-2 bg-surface border border-border rounded-full hover:border-border-strong hover:shadow-md transition-all"
                >
                  <div className="text-right">
                    <p className="font-bold text-fg-subtle uppercase tracking-wider">Continue</p>
                    <p className="text-sm font-semibold max-w-37.5 truncate">{lastActive.name}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-accent group-hover:text-accent-fg transition-colors">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Promo Banner - Shows on desktop (fixed left) and mobile (inline below header) */}
        {!isPromoDismissed && !isLoading && (
          <>
            {/* Desktop: Fixed left sidebar */}
            <div className="hidden lg:block fixed left-4 xl:left-6 top-24 z-40 w-56 xl:w-64">
              <div className="sticky top-24">
                <PromoBanner onDismiss={handlePromoDismiss} />
              </div>
            </div>
            {/* Mobile: Inline banner above grid */}
            <div className="lg:hidden mb-6 px-4 sm:px-6">
              <PromoBanner onDismiss={handlePromoDismiss} />
            </div>
          </>
        )}

        {/* Character Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
             {[...Array(pageSize)].map((_, i) => (
                <CharacterCardSkeleton key={i} />
             ))}
          </div>
        ) : sortedCharacters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-fg-subtle" />
            </div>
            <h3 className="text-lg font-medium">No characters found</h3>
            <p className="text-fg-muted mt-2 mb-8 max-w-sm">
              {searchQuery ? `No results for "${searchQuery}"` : "Get started by creating a new character or importing a card."}
            </p>
            {!searchQuery && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 border border-border-strong rounded-xl hover:bg-accent-soft hover:text-accent transition-colors font-medium"
              >
                Import Card
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 ${areVisibleCardsReady ? 'animate-fade-in' : ''}`}>
              {areVisibleCardsReady
                ? visibleCharacters.map((char) => (
                    <CharacterCard
                      key={char.id}
                      character={char}
                      onOpen={openCharacter}
                      onDuplicate={handleCopyClick}
                      onDelete={handleDeleteClick}
                      onExport={handleCardExport}
                      isExporting={exportingCardId === char.id}
                    />
                  ))
                : visibleCharacters.map((char) => <CharacterCardSkeleton key={char.id} />)}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 pb-20">
              <p className="text-sm text-fg-muted">
                Page {safeCurrentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage === 1}
                  className="px-4 py-2 bg-surface border border-border rounded-full hover:border-border-strong hover:shadow-md transition-all text-sm font-medium text-fg-muted disabled:opacity-50 disabled:hover:border-border disabled:hover:shadow-none"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="px-4 py-2 bg-surface border border-border rounded-full hover:border-border-strong hover:shadow-md transition-all text-sm font-medium text-fg-muted disabled:opacity-50 disabled:hover:border-border disabled:hover:shadow-none"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer Note */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex items-center justify-center gap-2 text-xs text-fg-subtle">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span>Thumbnails appear blurry to save memory. Your full images are preserved in the card when you export.</span>
        </div>
      </footer>

      {/* Delete Confirmation Modal */}
      {deleteConfirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-danger-soft rounded-full">
                <Trash2 className="w-6 h-6 text-danger" />
              </div>
              <h3 className="text-lg font-semibold text-fg">Delete Character?</h3>
            </div>
            <p className="text-fg-muted mb-6">
              Are you sure you want to delete <span className="font-medium text-fg">{deleteConfirmState.name}</span>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-danger hover:opacity-90 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Confirmation Modal */}
      {copyConfirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-info-soft rounded-full">
                <Copy className="w-6 h-6 text-info" />
              </div>
              <h3 className="text-lg font-semibold text-fg">Copy Character?</h3>
            </div>
            <p className="text-fg-muted mb-6">
              Are you sure you want to create a copy of <span className="font-medium text-fg">{copyConfirmState.name}</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCopyCancel}
                className="px-4 py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-info hover:opacity-90 rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vault Backup Confirmation Modal */}
      {backupConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-backup-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleBackupCancel();
          }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-success-soft rounded-full">
                <Download className="w-6 h-6 text-success" />
              </div>
              <h3 id="vault-backup-title" className="text-lg font-semibold text-fg">
                Backup vault?
              </h3>
            </div>
            <p className="text-fg-muted mb-2">
              Download a ZIP of{' '}
              <span className="font-medium text-fg">
                {characterListItems.length} {characterListItems.length === 1 ? 'character' : 'characters'}
              </span>
              ?
            </p>
            <p className="text-sm text-fg-muted mb-6">
              Cards with images export as PNG; cards without export as JSON. This may take a moment for large vaults.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleBackupCancel}
                disabled={isExportingVault}
                className="px-4 py-2.5 sm:py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50 touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleExportVault()}
                disabled={isExportingVault}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 touch-manipulation"
              >
                {isExportingVault ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  'Download backup'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main app content component (home route)
 */
function AppContent(): React.ReactNode {
  const { isCharacterOpen, openCharacter } = useCharacterContext();
  const [isReady, setIsReady] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isInitialTutorial, setIsInitialTutorial] = useState(false);

  // Check tutorial state on mount to prevent app from showing first
  useEffect(() => {
    const completed = WelcomeTutorial.isCompleted?.() ?? false;
    const shouldShow = !completed;
    // Use requestAnimationFrame to avoid cascading renders warning
    requestAnimationFrame(() => {
      setShowTutorial(shouldShow);
      setIsInitialTutorial(shouldShow); // Only true for the initial check
      setIsReady(true);
    });
  }, []);

  // Handle opening character when redirected from import page via query param
  // Note: With HashRouter, query params are in window.location.hash (after #/)
  useEffect(() => {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return;

    const queryString = hash.slice(queryIndex + 1);
    const params = new URLSearchParams(queryString);
    const charId = params.get('char');
    if (charId) {
      openCharacter(charId);
      // Remove the query param from URL without reloading
      const newHash = hash.slice(0, queryIndex);
      window.history.replaceState({}, document.title, window.location.pathname + newHash);
    }
  }, [openCharacter]);

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const handleReplayTutorial = useCallback(() => {
    WelcomeTutorial.reset?.();
    setIsInitialTutorial(false); // Replays should show entrance animation
    setShowTutorial(true);
  }, []);

  // Don't render anything until we've checked tutorial state
  if (!isReady) {
    return null;
  }

  return (
    <>
      {showTutorial && (
        <WelcomeTutorial 
          onComplete={handleTutorialComplete} 
          skipEntranceAnimation={isInitialTutorial}
        />
      )}
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
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/ai-create" element={<AICreationStudio />} />
      </Routes>
    </CharacterProvider>
  );
}

export default App;
