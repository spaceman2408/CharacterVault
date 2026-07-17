/**
 * @fileoverview Import page for SillyTavern clipboard integration
 * @module @pages/ImportPage
 */

import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClipboardImport } from '../hooks/useClipboardImport';
import type { CharacterCardV2 } from '../db/characterTypes';
import {
  ClipboardPaste,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Upload,
  User,
  BookOpen,
  Tags,
  MessageSquare,
  Loader2,
  X,
  ExternalLink,
  Library,
} from 'lucide-react';

// --- Utility Components ---

interface IconButtonProps {
  icon: React.ElementType;
  onClick?: () => void;
  title?: string;
  variant?: 'ghost' | 'primary' | 'danger';
  className?: string;
  disabled?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  onClick,
  title,
  variant = 'ghost',
  className = '',
  disabled = false,
}) => {
  const baseStyle = 'p-2 rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    ghost:
      'text-fg-muted hover:text-accent hover:bg-accent-soft',
    primary:
      'bg-accent text-accent-fg hover:opacity-90 shadow-sm',
    danger:
      'text-fg-subtle hover:text-danger hover:bg-danger-soft',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};

// --- Character Preview Card ---

interface CharacterPreviewCardProps {
  data: CharacterCardV2;
  avatarData: string | null;
}

const CharacterPreviewCard: React.FC<CharacterPreviewCardProps> = ({
  data,
  avatarData,
}) => {
  const imageSrc = avatarData || data.avatar || null;
  const lorebookCount = data.character_book?.entries?.length || 0;
  const greetingCount = (data.alternate_greetings?.length || 0) + 1; // +1 for first_mes
  const tagCount = data.tags?.length || 0;

  // Truncate description for preview
  const previewDescription =
    data.description?.length > 200
      ? data.description.slice(0, 200) + '...'
      : data.description || 'No description';

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-lg overflow-hidden">
      {/* Header with image */}
      <div className="relative">
        <div className="aspect-3/4 w-full bg-muted flex items-center justify-center overflow-hidden">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={data.name}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-fg-subtle">
              <User className="w-16 h-16 mb-2" />
              <span className="text-sm">No avatar</span>
            </div>
          )}
        </div>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-vault-950/65 via-transparent to-transparent" />
        {/* Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h2 className="text-2xl font-bold text-white drop-shadow-md">
            {data.name || 'Unnamed Character'}
          </h2>
          {data.creator && (
            <p className="text-white/80 text-sm mt-1">by {data.creator}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Stats row */}
        <div className="flex flex-wrap gap-4 text-sm text-fg-muted">
          {lorebookCount > 0 && (
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              <span>{lorebookCount} lorebook entries</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" />
            <span>{greetingCount} greeting(s)</span>
          </div>
          {tagCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Tags className="w-4 h-4" />
              <span>{tagCount} tags</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-fg mb-2">
            Description
          </h3>
          <p className="text-sm text-fg-muted whitespace-pre-wrap line-clamp-6">
            {previewDescription}
          </p>
        </div>

        {/* Additional info */}
        {(data.personality || data.scenario) && (
          <div className="border-t border-border pt-4 space-y-3">
            {data.personality && (
              <div>
                <h3 className="text-sm font-semibold text-fg mb-1">
                  Personality
                </h3>
                <p className="text-sm text-fg-muted line-clamp-3">
                  {data.personality}
                </p>
              </div>
            )}
            {data.scenario && (
              <div>
                <h3 className="text-sm font-semibold text-fg mb-1">
                  Scenario
                </h3>
                <p className="text-sm text-fg-muted line-clamp-3">
                  {data.scenario}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Version info */}
        {data.character_version && (
          <div className="border-t border-border pt-4">
            <span className="text-xs text-fg-muted">
              Version: {data.character_version}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Manual Paste Section ---

interface ManualPasteSectionProps {
  onPaste: (text: string) => void;
  errorMessage: string | null;
}

const ManualPasteSection: React.FC<ManualPasteSectionProps> = ({
  onPaste,
  errorMessage,
}) => {
  const [text, setText] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (text.trim()) {
        onPaste(text.trim());
      }
    },
    [text, onPaste]
  );

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste character JSON here..."
          className="w-full h-48 p-4 bg-surface border border-border rounded-xl text-sm font-mono resize-none focus:outline-hidden focus:ring-2 focus:ring-accent"
          spellCheck={false}
        />
        {errorMessage && (
          <div className="flex items-center gap-2 text-danger text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={async () => {
              try {
                const clipboardText = await navigator.clipboard.readText();
                if (clipboardText.trim()) {
                  onPaste(clipboardText.trim());
                }
              } catch {
                // If clipboard read fails, focus the textarea for manual paste
                // This can happen if permission is denied
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors"
          >
            <ClipboardPaste className="w-4 h-4" />
            Paste from Clipboard
          </button>
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Load Preview
          </button>
        </div>
      </form>
    </div>
  );
};

// --- Main Import Page Component ---

export const ImportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');
  const {
    importState,
    errorMessage,
    previewData,
    avatarData,
    importedCharacter,
    parseManualInput,
    importCharacter,
    goToLibrary,
    openImportedCharacter,
  } = useClipboardImport();

  const isSillyTavernSource = source === 'st';

  return (
    <div className="h-dvh flex flex-col bg-bg text-fg overflow-hidden">
      {/* Header */}
      <header className="shrink-0 w-full backdrop-blur-xl bg-surface/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconButton icon={ArrowLeft} onClick={goToLibrary} title="Back to Library" />
            <h1 className="text-lg font-semibold">Import Character</h1>
            {isSillyTavernSource && (
              <span className="px-2 py-0.5 text-xs bg-info-soft text-info-soft-fg rounded-full">
                SillyTavern
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        {/* Idle / Reading State */}
        {(importState === 'idle' || importState === 'reading') && (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
              <Loader2 className="w-8 h-8 text-fg-muted animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Reading clipboard...</h2>
            <p className="text-fg-muted max-w-sm">
              Attempting to read character data from your clipboard automatically.
            </p>
          </div>
        )}

        {/* Clipboard Unavailable / Manual Paste State */}
        {importState === 'clipboard-unavailable' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-start gap-3 p-4 bg-warning-soft border border-warning/30 rounded-xl">
              <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-warning-soft-fg">
                  Could not read clipboard automatically
                </h3>
                <p className="text-sm text-warning-soft-fg mt-1 whitespace-pre-line">
                  {errorMessage || 'Please paste the character data manually below.'}
                </p>
              </div>
            </div>
            <ManualPasteSection onPaste={parseManualInput} errorMessage={null} />
          </div>
        )}

        {/* Preview State */}
        {importState === 'preview' && previewData && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Character Preview</h2>
              <button
                onClick={goToLibrary}
                className="flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>

            <CharacterPreviewCard data={previewData} avatarData={avatarData} />

            <div className="flex gap-3">
              <button
                onClick={importCharacter}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-accent text-accent-fg font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                <Upload className="w-4 h-4" />
                Import Character
              </button>
              <button
                onClick={goToLibrary}
                className="flex items-center gap-2 px-6 py-3 border border-border-strong text-fg-muted font-medium rounded-xl hover:bg-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Importing State */}
        {importState === 'importing' && (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
              <Loader2 className="w-8 h-8 text-fg-muted animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Importing character...</h2>
            <p className="text-fg-muted">
              Saving to your CharacterVault library.
            </p>
          </div>
        )}

        {/* Success State */}
        {importState === 'success' && importedCharacter && (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
            <div className="w-20 h-20 bg-success-soft rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Character Imported!</h2>
            <p className="text-fg-muted mb-8 max-w-sm">
              <span className="font-medium text-fg">
                {importedCharacter.name}
              </span>{' '}
              has been added to your library.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
              <button
                onClick={openImportedCharacter}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-accent text-accent-fg font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                <ExternalLink className="w-4 h-4" />
                Open Character
              </button>
              <button
                onClick={goToLibrary}
                className="flex items-center justify-center gap-2 px-6 py-3 border border-border-strong text-fg-muted font-medium rounded-xl hover:bg-hover transition-colors"
              >
                <Library className="w-4 h-4" />
                Back to Library
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {importState === 'error' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 bg-danger-soft rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-danger" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Import Failed</h2>
              <p className="text-fg-muted mb-8 max-w-sm">
                {errorMessage || 'Something went wrong while importing the character.'}
              </p>
            </div>
            <ManualPasteSection onPaste={parseManualInput} errorMessage={null} />
            <div className="flex justify-center">
              <button
                onClick={goToLibrary}
                className="flex items-center gap-2 px-6 py-3 text-fg-muted hover:text-fg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Library
              </button>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
};

export default ImportPage;
