import {
  BookOpen,
  Download,
  HelpCircle,
  Loader2,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Upload,
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

export function VaultHeader({
  searchQuery,
  onSearchChange,
  isDark,
  onToggleTheme,
  onReplayTutorial,
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
  return (
    <>
      <div className="sticky top-0 z-30 w-full">
        <StagingPromoBanner />
        <header className="w-full backdrop-blur-xl bg-surface/85 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <img
              src={logoSrc}
              alt="Character Vault Logo"
              className="shrink-0 h-8 w-auto sm:h-10 md:h-12 transition-[filter] dark:grayscale"
            />
          </div>

          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle group-focus-within:text-accent transition-colors" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-muted border border-transparent focus:bg-surface focus:border-border-strong focus:ring-2 focus:ring-accent/20 rounded-full py-2 pl-9 pr-4 text-sm transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept={importAccept}
              multiple
              onChange={onImportChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={onImportClick}
              disabled={isImporting}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import
            </button>

            <button
              type="button"
              onClick={onImportClick}
              disabled={isImporting}
              className="sm:hidden p-2 text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
              title={importTitle}
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onBackupClick}
              disabled={!canBackup || isExportingVault}
              className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
              title="Download a ZIP backup of characters and lorebooks"
            >
              {isExportingVault ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Backup
            </button>

            <button
              type="button"
              onClick={onBackupClick}
              disabled={!canBackup || isExportingVault}
              className="md:hidden p-2 text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50"
              title="Backup vault"
            >
              {isExportingVault ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </button>

            <div className="h-6 w-px bg-border mx-0.5 hidden sm:block" />

            <a
              href="#/ai-create"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-accent bg-accent-soft border border-accent/30 hover:bg-accent hover:text-accent-fg rounded-xl transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              AI Create
            </a>

            <a
              href="#/ai-create"
              className="sm:hidden p-2 text-accent hover:bg-accent-soft rounded-lg transition-colors"
              title="AI Create"
            >
              <Sparkles className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={onCreateClick}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-accent text-accent-fg hover:opacity-90 rounded-xl transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {createLabel}
            </button>

            <button
              type="button"
              onClick={onCreateClick}
              className="sm:hidden p-2 text-accent-fg bg-accent hover:opacity-90 rounded-lg transition-opacity"
              title={createLabel}
            >
              <Plus className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-border mx-0.5 hidden sm:block" />

            <IconButton
              icon={isDark ? Sun : Moon}
              onClick={onToggleTheme}
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
      </div>

      <div className="sm:hidden px-4 pt-3">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle group-focus-within:text-accent transition-colors" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-muted border border-transparent focus:bg-surface focus:border-border-strong focus:ring-2 focus:ring-accent/20 rounded-full py-2.5 pl-9 pr-4 text-sm transition-all outline-none"
          />
        </div>
      </div>
    </>
  );
}
