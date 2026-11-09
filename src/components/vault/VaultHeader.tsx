import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  HelpCircle,
  Loader2,
  Moon,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { StagingPromoBanner } from '../StagingPromoBanner';
import { IconButton } from './IconButton';
import { logoSrc } from './utils';

export interface VaultHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onReplayTutorial: () => void;
  onOpenSettings: () => void;
  onImportClick: () => void;
  onBackupClick: () => void;
  onCreateClick: () => void;
  isImporting: boolean;
  isExportingVault: boolean;
  canBackup: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchPlaceholder?: string;
  importAccept?: string;
  importTitle?: string;
  createLabel?: string;
}

interface VaultSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  className: string;
}

function VaultSearchInput({
  value,
  onChange,
  placeholder,
  inputRef,
  className,
}: VaultSearchInputProps): React.ReactElement {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    if (value) onChange('');
    else event.currentTarget.blur();
  };

  return (
    <div className="relative group">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle group-focus-within:text-accent transition-colors" />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`w-full bg-muted border border-transparent focus:bg-surface focus:border-border-strong focus:ring-2 focus:ring-accent/20 rounded-full pl-9 pr-9 text-sm transition-all outline-none ${className}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          title="Clear search (Esc)"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-fg-subtle hover:text-fg hover:bg-accent-soft transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function VaultHeader({
  searchQuery,
  onSearchChange,
  isDark,
  onToggleTheme,
  onReplayTutorial,
  onOpenSettings,
  onImportClick,
  onBackupClick,
  onCreateClick,
  isImporting,
  isExportingVault,
  canBackup,
  fileInputRef,
  onImportChange,
  searchPlaceholder = 'Search name or tags...',
  importAccept = '.png,.json,image/png,application/json',
  importTitle = 'Import',
  createLabel = 'Create',
}: VaultHeaderProps): React.ReactElement {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleSlash = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target) || document.querySelector('[aria-modal="true"]')) return;
      const input = [desktopSearchRef.current, mobileSearchRef.current].find(
        (el) => el && el.offsetParent !== null
      );
      if (!input) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    document.addEventListener('keydown', handleSlash);
    return () => document.removeEventListener('keydown', handleSlash);
  }, []);

  useEffect(() => {
    if (!isMoreOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        moreButtonRef.current?.contains(target) ||
        moreMenuRef.current?.contains(target)
      ) {
        return;
      }
      setIsMoreOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isMoreOpen]);

  const closeMore = () => setIsMoreOpen(false);

  return (
    <>
      <div className="sticky top-0 z-30 w-full">
        <StagingPromoBanner />
        <header className="w-full backdrop-blur-xl bg-surface/85 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <img
                src={logoSrc}
                alt="Character Vault Logo"
                className="shrink-0 h-8 w-auto sm:h-9 lg:h-10 transition-[filter] dark:grayscale"
              />
            </div>

            <div className="flex-1 min-w-0 max-w-md hidden sm:block">
              <VaultSearchInput
                value={searchQuery}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                inputRef={desktopSearchRef}
                className="py-2"
              />
            </div>

            <div className="flex-1 sm:hidden" />

            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept={importAccept}
                multiple
                onChange={onImportChange}
                className="hidden"
              />

              <div className="hidden sm:flex items-center gap-0.5 sm:gap-1">
                <button
                  type="button"
                  onClick={onImportClick}
                  disabled={isImporting}
                  className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import
                </button>

                <button
                  type="button"
                  onClick={onImportClick}
                  disabled={isImporting}
                  className="lg:hidden p-2 text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
                  title={importTitle}
                  aria-label={importTitle}
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={onBackupClick}
                  disabled={!canBackup || isExportingVault}
                  className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
                  title="Download a full backup of cards, lorebooks, and settings"
                >
                  {isExportingVault ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Backup
                </button>

                <button
                  type="button"
                  onClick={onBackupClick}
                  disabled={!canBackup || isExportingVault}
                  className="lg:hidden p-2 text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
                  title="Backup vault"
                  aria-label="Backup vault"
                >
                  {isExportingVault ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>

                <div className="h-6 w-px bg-border mx-0.5 hidden lg:block" />

                <a
                  href="#/ai-create"
                  className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-accent bg-accent-soft border border-accent/30 hover:bg-accent hover:text-accent-fg rounded-xl transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  AI Create
                </a>

                <a
                  href="#/ai-create"
                  className="lg:hidden p-2 text-accent hover:bg-accent-soft rounded-lg transition-colors"
                  title="AI Create"
                  aria-label="AI Create"
                >
                  <Sparkles className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={onCreateClick}
                  className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-accent text-accent-fg hover:opacity-90 rounded-xl transition-opacity shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  {createLabel}
                </button>

                <button
                  type="button"
                  onClick={onCreateClick}
                  className="lg:hidden p-2 text-accent-fg bg-accent hover:opacity-90 rounded-lg transition-opacity"
                  title={createLabel}
                  aria-label={createLabel}
                >
                  <Plus className="w-4 h-4" />
                </button>

                <div className="h-6 w-px bg-border mx-0.5 hidden lg:block" />

                <div className="hidden sm:contents">
                  <IconButton
                    icon={Settings}
                    onClick={onOpenSettings}
                    title="Settings"
                  />
                </div>

                <IconButton
                  icon={isDark ? Sun : Moon}
                  onClick={onToggleTheme}
                  title="Toggle Theme"
                />

                <span className="hidden md:contents">
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
                    aria-label="Documentation"
                  >
                    <BookOpen className="w-4 h-4" />
                  </a>
                </span>
              </div>

              <div className="sm:hidden flex items-center gap-0.5">
                <a
                  href="#/ai-create"
                  className="p-2 text-accent hover:bg-accent-soft rounded-lg transition-colors"
                  title="AI Create"
                  aria-label="AI Create"
                >
                  <Sparkles className="w-5 h-5" />
                </a>

                <button
                  type="button"
                  onClick={onCreateClick}
                  className="p-2 text-accent-fg bg-accent hover:opacity-90 rounded-lg transition-opacity"
                  title={createLabel}
                  aria-label={createLabel}
                >
                  <Plus className="w-5 h-5" />
                </button>

                <div className="relative">
                  <button
                    ref={moreButtonRef}
                    type="button"
                    onClick={() => setIsMoreOpen((open) => !open)}
                    className="p-2 rounded-lg transition-colors text-fg-muted hover:text-accent hover:bg-accent-soft"
                    title="More actions"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={isMoreOpen}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {isMoreOpen && (
                    <div
                      ref={moreMenuRef}
                      role="menu"
                      className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { closeMore(); onImportClick(); }}
                        disabled={isImporting}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-fg hover:bg-accent-soft hover:text-accent disabled:opacity-50"
                      >
                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-fg-subtle" />}
                        {importTitle}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { closeMore(); onBackupClick(); }}
                        disabled={!canBackup || isExportingVault}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-fg hover:bg-accent-soft hover:text-accent disabled:opacity-50"
                      >
                        {isExportingVault ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-fg-subtle" />}
                        Backup vault
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { closeMore(); onOpenSettings(); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-fg hover:bg-accent-soft hover:text-accent"
                      >
                        <Settings className="w-4 h-4 text-fg-subtle" />
                        Settings
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { closeMore(); onToggleTheme(); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-fg hover:bg-accent-soft hover:text-accent"
                      >
                        {isDark ? <Sun className="w-4 h-4 text-fg-subtle" /> : <Moon className="w-4 h-4 text-fg-subtle" />}
                        {isDark ? 'Light mode' : 'Dark mode'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { closeMore(); onReplayTutorial(); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-fg hover:bg-accent-soft hover:text-accent"
                      >
                        <HelpCircle className="w-4 h-4 text-fg-subtle" />
                        Replay tutorial
                      </button>
                      <a
                        href={`${import.meta.env.BASE_URL}docs/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        role="menuitem"
                        onClick={closeMore}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-fg hover:bg-accent-soft hover:text-accent"
                      >
                        <BookOpen className="w-4 h-4 text-fg-subtle" />
                        Documentation
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      <div className="sm:hidden px-4 pt-3">
        <VaultSearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          inputRef={mobileSearchRef}
          className="py-2.5"
        />
      </div>
    </>
  );
}
