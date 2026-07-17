/**
 * @fileoverview Lorebook Editor component for managing character lore entries.
 * Uses a two-panel layout: entry list sidebar on left, detail editor on right.
 * @module components/editor/LorebookEditor
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  ChevronUp,
  Book,
  Sparkles,
  Square,
  Settings,
  ChevronDown,
  ChevronLeft,
  Search,
  X,
  Eye,
  EyeOff,
  Upload,
  Download,
} from 'lucide-react';
import { AIService } from '../../services/AIService';
import { importLorebook, convertToSTLorebook } from '../../services/LorebookConverter';
import type {
  SamplerSettings,
  AIConfig,
  PromptSettings,
  PromptModelMap,
} from '../../db/characterTypes';
import type { CharacterSection, LorebookEntry, CharacterBook } from '../../db/characterTypes';
import { useAIEditor } from '../../hooks';
import { estimateTokens } from '../../services/AIService';
import { resolveConfigForOperation } from '../../services/resolveOperationConfig';

/**
 * Check if a lorebook entry is enabled for context (AI usage)
 * @param entry - The lorebook entry to check
 * @returns true if the entry should be included in AI context
 */
function isEntryContextEnabled(entry: LorebookEntry): boolean {
  return entry.extensions?.context_enabled !== false;
}

interface LorebookEditorProps {
  lorebook: CharacterBook | undefined;
  onChange: (lorebook: CharacterBook) => void;
  onDelete?: () => void;
  setSelectedText: (text: string) => void;
  contextSectionIds: CharacterSection[];
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  promptModels?: PromptModelMap;
  getContextContent: (sectionIds: CharacterSection[]) => string[];
  activeSection: string;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  characterName?: string;
  spellcheck?: import('../../db/characterTypes').SpellcheckSettings;
}

interface LorebookEntryListItemProps {
  entry: LorebookEntry;
  index: number;
  tokenCount: number | null;
  isSelected: boolean;
  isContextEnabled: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onToggleContext: () => void;
}

interface LorebookEntryDetailProps {
  entry: LorebookEntry;
  onPersistUpdate: (entry: LorebookEntry) => void;
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  promptModels?: PromptModelMap;
  getContextContent: (sectionIds: CharacterSection[]) => string[];
  contextSectionIds: CharacterSection[];
  setSelectedText: (text: string) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  spellcheck?: import('../../db/characterTypes').SpellcheckSettings;
}

const POSITION_OPTIONS: { value: LorebookEntry['position']; label: string }[] = [
  { value: 'before_char', label: 'Before Character' },
  { value: 'after_char', label: 'After Character' },
  { value: 'before_example', label: 'Before Example' },
  { value: 'after_example', label: 'After Example' },
];

/**
 * Compact entry card for the sidebar list
 */
function LorebookEntryListItem({
  entry,
  index,
  tokenCount,
  isSelected,
  isContextEnabled,
  onSelect,
  onDelete,
  onToggleContext,
}: LorebookEntryListItemProps): React.ReactElement {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };
  const handleToggleContext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleContext();
  };
  return (
    <div
      onClick={onSelect}
      className={`
        relative cursor-pointer rounded-xl border p-3 transition-colors touch-manipulation
        ${isSelected
          ? 'border-accent bg-accent-soft ring-1 ring-accent'
          : 'border-border bg-surface hover:border-accent/40 hover:bg-accent-soft/60'
        }
      `}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-fg">
            {entry.comment || entry.name || `Entry ${index}`}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
            <span>{entry.keys.length} key{entry.keys.length !== 1 ? 's' : ''}</span>
            {tokenCount !== null ? (
              <span>{tokenCount.toLocaleString()} tokens</span>
            ) : null}
            {!isContextEnabled ? (
              <span className="text-fg-subtle">Hidden from context</span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={handleToggleContext}
            className={`
              rounded-lg p-2 transition-colors touch-manipulation
              ${isContextEnabled
                ? 'text-success hover:bg-success-soft'
                : 'text-fg-muted hover:bg-hover hover:text-fg'
              }
            `}
            title={isContextEnabled ? 'In context (click to exclude)' : 'Not in context (click to include)'}
            aria-label={isContextEnabled ? 'Exclude from context' : 'Include in context'}
          >
            {isContextEnabled ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger touch-manipulation"
            title="Delete entry"
            aria-label="Delete entry"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

const MemoizedLorebookEntryListItem = React.memo(LorebookEntryListItem);

/**
 * Full detail editor for an entry (right panel)
 */
function LorebookEntryDetail({
  entry,
  onPersistUpdate,
  aiConfig,
  samplerSettings,
  promptSettings,
  promptModels,
  getContextContent,
  contextSectionIds,
  setSelectedText,
  fontSize,
  onFontSizeChange,
  spellcheck,
}: LorebookEntryDetailProps): React.ReactElement {
  const [draftEntry, setDraftEntry] = useState(entry);
  const { editorRef, payloadPreviewModal } = useAIEditor({
    key: String(entry.id),
    value: draftEntry.content,
    onImmediateChange: (value) => {
      setDraftEntry(prev => ({ ...prev, content: value }));
    },
    onPersistChange: (value) => {
      const updatedEntry = { ...draftEntry, content: value };
      setDraftEntry(updatedEntry);
      onPersistUpdate(updatedEntry);
    },
    saveMode: 'debounced',
    saveDebounceMs: 250,
    setSelectedText,
    aiConfig,
    samplerSettings,
    promptSettings,
    promptModels,
    getContextContent,
    contextSectionIds,
    minHeight: '200px',
    maxHeight: 'none',
    isActive: true,
    fontSize,
    onFontSizeChange,
    spellcheck,
  });

  // Local state for keys input to allow typing commas/spaces without immediate parsing
  const [keysInput, setKeysInput] = React.useState(entry.keys.join(', '));
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const aiServiceRef = useRef<AIService | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setDraftEntry(entry);
    setKeysInput(entry.keys.join(', '));
  }, [entry]);

  // Sync keysInput when entry.keys changes from outside
  React.useEffect(() => {
    const newKeysString = draftEntry.keys.join(', ');
    setKeysInput(prev => prev !== newKeysString ? newKeysString : prev);
  }, [draftEntry.keys]);

  // Cleanup timeout and abort on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      aiServiceRef.current?.abort();
    };
  }, []);

  // Abort ongoing generation
  const handleAbortGeneration = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    aiServiceRef.current?.abort();
    aiServiceRef.current = null;
    setGeneratingKeys(false);
  };

  // Generate trigger keys using AI
  const handleGenerateKeys = async () => {
    if (generatingKeys) {
      handleAbortGeneration();
      return;
    }
    if (!draftEntry.content.trim()) return;

    setGeneratingKeys(true);
    const effectiveConfig = resolveConfigForOperation(aiConfig, 'instruct', promptModels);
    aiServiceRef.current = new AIService(effectiveConfig, samplerSettings, promptSettings);

    // 15-second timeout
    timeoutRef.current = setTimeout(() => {
      handleAbortGeneration();
    }, 15000);

    try {
      const result = await aiServiceRef.current.instructText(
        draftEntry.content,
        'Generate 2-5 comma-separated trigger keywords/keys that would cause this lorebook entry to activate. Output ONLY the comma-separated keywords, nothing else.',
        getContextContent(contextSectionIds)
      );

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const parsedKeys = result.content.split(',').map(k => k.trim()).filter(k => k);
      if (parsedKeys.length > 0) {
        const mergedKeys = [...draftEntry.keys];
        for (const key of parsedKeys) {
          if (!mergedKeys.some(k => k.toLowerCase() === key.toLowerCase())) {
            mergedKeys.push(key);
          }
        }
        const newKeysString = mergedKeys.join(', ');
        setKeysInput(newKeysString);
        const updatedEntry = { ...draftEntry, keys: mergedKeys };
        setDraftEntry(updatedEntry);
        onPersistUpdate(updatedEntry);
      }
    } catch {
      // Silent fail or aborted
    } finally {
      aiServiceRef.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setGeneratingKeys(false);
    }
  };

  // Form handlers
  const handleNameChange = (value: string) => {
    const updatedEntry = { ...draftEntry, name: value };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handleKeysChange = (value: string) => setKeysInput(value);
  const handleKeysBlur = () => {
    const parsedKeys = keysInput.split(',').map(k => k.trim()).filter(k => k);
    const updatedEntry = { ...draftEntry, keys: parsedKeys };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handleCommentChange = (value: string) => {
    const updatedEntry = { ...draftEntry, comment: value };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handlePriorityChange = (value: string) => {
    const num = parseInt(value, 10);
    const updatedEntry = { ...draftEntry, priority: isNaN(num) ? 0 : num };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handlePositionChange = (value: LorebookEntry['position']) => {
    const updatedEntry = { ...draftEntry, position: value };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handleEnabledChange = (checked: boolean) => {
    const updatedEntry = { ...draftEntry, enabled: checked };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handleCaseSensitiveChange = (checked: boolean) => {
    const updatedEntry = { ...draftEntry, case_sensitive: checked };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handleConstantChange = (checked: boolean) => {
    const updatedEntry = { ...draftEntry, constant: checked };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };

  const fieldClass =
    'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-border-strong focus:ring-2 focus:ring-accent/20';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto md:overflow-hidden">
      <div className="shrink-0 space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            Entry Name
          </label>
          <input
            type="text"
            value={draftEntry.comment || ''}
            onChange={(e) => handleCommentChange(e.target.value)}
            placeholder="Entry display name (optional)"
            className={fieldClass}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Trigger Keys
            </label>
            <span className="text-[11px] text-fg-subtle">comma separated</span>
            <button
              type="button"
              onClick={handleGenerateKeys}
              disabled={!generatingKeys && !draftEntry.content.trim()}
              title={generatingKeys ? 'Stop generation' : 'Generate trigger keys with AI'}
              className={`ml-auto rounded-lg p-1.5 transition-colors touch-manipulation ${
                generatingKeys
                  ? 'animate-pulse text-danger hover:bg-danger-soft'
                  : 'text-fg-subtle hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40'
              }`}
            >
              {generatingKeys ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <input
            type="text"
            value={keysInput}
            onChange={(e) => handleKeysChange(e.target.value)}
            onBlur={handleKeysBlur}
            placeholder="castle, fortress, stronghold"
            className={fieldClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Priority
            </label>
            <input
              type="number"
              value={draftEntry.priority ?? 0}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Position
            </label>
            <select
              value={entry.position || 'before_char'}
              onChange={(e) => handlePositionChange(e.target.value as LorebookEntry['position'])}
              className={fieldClass}
            >
              {POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={entry.enabled}
              onChange={(e) => handleEnabledChange(e.target.checked)}
              className="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
            />
            Enabled
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={entry.case_sensitive ?? false}
              onChange={(e) => handleCaseSensitiveChange(e.target.checked)}
              className="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
            />
            Case Sensitive
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={entry.constant ?? false}
              onChange={(e) => handleConstantChange(e.target.checked)}
              className="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
            />
            Constant
          </label>
        </div>
      </div>

      <div className="flex min-h-[40dvh] flex-1 flex-col md:min-h-48">
        <div
          ref={editorRef}
          className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-bg shadow-inner"
        />
      </div>

      <div className="shrink-0">
        <input
          type="text"
          value={draftEntry.name || ''}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Internal notes (optional, not used in output)"
          className={fieldClass}
        />
      </div>

      {payloadPreviewModal}
    </div>
  );
}

/**
 * Lorebook Editor for managing character lore entries
 * Uses a two-panel layout: sidebar list on left, detail editor on right
 */
export function LorebookEditor({
  lorebook,
  onChange,
  onDelete,
  setSelectedText,
  contextSectionIds,
  aiConfig,
  samplerSettings,
  promptSettings,
  promptModels,
  getContextContent,
  activeSection,
  fontSize,
  onFontSizeChange,
  characterName,
  spellcheck,
}: LorebookEditorProps): React.ReactElement {
  return (
    <LorebookEditorInner
      lorebook={lorebook}
      onChange={onChange}
      onDelete={onDelete}
      setSelectedText={setSelectedText}
      contextSectionIds={contextSectionIds}
      aiConfig={aiConfig}
      samplerSettings={samplerSettings}
      promptSettings={promptSettings}
      promptModels={promptModels}
      getContextContent={getContextContent}
      activeSection={activeSection}
      fontSize={fontSize}
      onFontSizeChange={onFontSizeChange}
      characterName={characterName}
      spellcheck={spellcheck}
    />
  );
}

/**
 * Inner component with two-panel layout
 */
type LorebookEditorInnerProps = LorebookEditorProps;

function LorebookEditorInner({
  lorebook,
  onChange,
  onDelete,
  setSelectedText,
  contextSectionIds,
  aiConfig,
  samplerSettings,
  promptSettings,
  promptModels,
  getContextContent,
  fontSize,
  onFontSizeChange,
  characterName,
  spellcheck,
}: LorebookEditorInnerProps): React.ReactElement {
  const normalizedPropLorebook = useMemo<CharacterBook>(() => ({
    name: lorebook?.name || '',
    description: lorebook?.description || '',
    entries: lorebook?.entries || [],
    extensions: lorebook?.extensions || {},
  }), [lorebook]);

  const [draftLorebook, setDraftLorebook] = useState<CharacterBook>(normalizedPropLorebook);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number>(0);
  const [isBookSettingsOpen, setIsBookSettingsOpen] = useState(false);
  const [isMobileViewOpen, setIsMobileViewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync local draft from persisted state
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDraftLorebook(normalizedPropLorebook);
      // Reset selection if current index is out of bounds
      setSelectedEntryIndex(prev =>
        prev >= (normalizedPropLorebook.entries.length || 0) ? 0 : prev
      );
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [normalizedPropLorebook]);

  const entries = draftLorebook.entries;
  const bookName = draftLorebook.name ?? '';
  const bookDescription = draftLorebook.description ?? '';

  // Ensure selected index is valid
  const safeSelectedIndex = selectedEntryIndex < entries.length ? selectedEntryIndex : 0;
  const selectedEntry = entries[safeSelectedIndex];

  const buildUpdatedLorebook = useCallback((
    newEntries: LorebookEntry[],
    newName: string,
    newDesc: string
  ): CharacterBook => ({
      name: newName,
      description: newDesc,
      entries: newEntries,
      extensions: draftLorebook.extensions || {},
    }), [draftLorebook.extensions]);

  const persistLorebook = useCallback((updatedLorebook: CharacterBook) => {
    setDraftLorebook(updatedLorebook);
    onChange(updatedLorebook);
  }, [onChange]);

  const handleEntryPersistUpdate = useCallback((updatedEntry: LorebookEntry) => {
    const newEntries = [...entries];
    newEntries[safeSelectedIndex] = updatedEntry;
    persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
  }, [entries, safeSelectedIndex, bookName, bookDescription, buildUpdatedLorebook, persistLorebook]);

  // Find the lowest available ID
  const getNextAvailableId = useCallback((): number => {
    const usedIds = new Set(entries.map(e => e.id));
    let id = 0;
    while (usedIds.has(id)) {
      id++;
    }
    return id;
  }, [entries]);

  // Handle add entry
  const handleAddEntry = useCallback(() => {
    const newId = getNextAvailableId();
    const newEntry: LorebookEntry = {
      id: newId,
      keys: [],
      content: '',
      extensions: {},
      enabled: true,
      case_sensitive: false,
      name: '',
      priority: 0,
      position: 'before_char',
    };
    const newEntries = [...entries, newEntry];
    const newIndex = newEntries.length - 1;

    persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
    setSelectedEntryIndex(newIndex);
    setIsMobileViewOpen(true);
  }, [entries, bookName, bookDescription, buildUpdatedLorebook, getNextAvailableId, persistLorebook]);

  // Handle delete entry
  const handleDeleteEntry = useCallback((index: number) => {
    const entry = entries[index];
    const shouldDelete = window.confirm(`Delete lorebook entry "${entry.name || `Entry ${index}`}"?`);
    if (!shouldDelete) return;

    const newEntries = entries.filter((_, i) => i !== index);
    persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));

    // Adjust selected index if needed
    if (selectedEntryIndex >= newEntries.length) {
      setSelectedEntryIndex(Math.max(0, newEntries.length - 1));
    } else if (selectedEntryIndex > index) {
      setSelectedEntryIndex(selectedEntryIndex - 1);
    }
  }, [entries, selectedEntryIndex, bookName, bookDescription, buildUpdatedLorebook, persistLorebook]);

  // Filter entries based on search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(entry =>
      (entry.name?.toLowerCase() || '').includes(query) ||
      (entry.content?.toLowerCase() || '').includes(query) ||
      entry.keys.some(key => key.toLowerCase().includes(query))
    );
  }, [entries, searchQuery]);

  const entryIndexById = useMemo(() => {
    const indexById = new Map<number, number>();
    entries.forEach((entry, index) => {
      indexById.set(entry.id, index);
    });
    return indexById;
  }, [entries]);

  const selectedEntryTokenCount = useMemo(
    () => (selectedEntry ? estimateTokens(selectedEntry.content) : null),
    [selectedEntry],
  );

  // Handle select entry with mobile view
  const handleSelectEntry = useCallback((index: number) => {
    setSelectedEntryIndex(index);
    setIsMobileViewOpen(true);
  }, []);

  // Handle back to list on mobile
  const handleBackToList = useCallback(() => {
    setIsMobileViewOpen(false);
  }, []);

  // Handle book name/description changes
  const handleBookNameChange = (value: string) => {
    persistLorebook(buildUpdatedLorebook(entries, value, bookDescription));
  };

  const handleBookDescriptionChange = (value: string) => {
    persistLorebook(buildUpdatedLorebook(entries, bookName, value));
  };

  // Handle enable all entries in context
  const handleEnableAllContext = useCallback(() => {
    const newEntries = entries.map(entry => ({
      ...entry,
      extensions: { ...entry.extensions, context_enabled: true },
    }));
    persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
  }, [entries, bookName, bookDescription, buildUpdatedLorebook, persistLorebook]);

  // Handle disable all entries from context
  const handleDisableAllContext = useCallback(() => {
    const newEntries = entries.map(entry => ({
      ...entry,
      extensions: { ...entry.extensions, context_enabled: false },
    }));
    persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
  }, [entries, bookName, bookDescription, buildUpdatedLorebook, persistLorebook]);

  // Handle deleting the entire lorebook
  const handleDeleteLorebook = useCallback(() => {
    if (!onDelete) return;
    const entryCount = entries.length;
    const message = entryCount > 0
      ? `Delete this lorebook and all ${entryCount} entries? This cannot be undone.`
      : 'Delete this lorebook? This cannot be undone.';
    if (!window.confirm(message)) return;
    onDelete();
  }, [onDelete, entries.length]);

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle import lorebook from file
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      const importedBook = importLorebook(data);

      if (!importedBook) {
        alert('Could not recognize the lorebook format. Please ensure it is a valid SillyTavern or CharacterVault export.');
        return;
      }

      // Check if we have existing entries
      if (entries.length > 0) {
        const confirmed = window.confirm(
          `This will replace all ${entries.length} existing entries with ${importedBook.entries.length} imported entries. Continue?`
        );
        if (!confirmed) return;
      }

      // Replace all entries with imported ones
      persistLorebook({
        name: importedBook.name || bookName,
        description: importedBook.description || bookDescription,
        entries: importedBook.entries,
        extensions: importedBook.extensions || {},
      });

      // Reset selection
      setSelectedEntryIndex(0);

      // Show success feedback
      alert(`Successfully imported ${importedBook.entries.length} entries.`);
    } catch (err) {
      console.error('Import error:', err);
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      // Reset file input
      e.target.value = '';
    }
  }, [entries.length, bookName, bookDescription, persistLorebook]);

  /**
   * Sanitize a string for use as a Windows filename
   * - Removes reserved characters: < > : " / \ | ? *
   * - Removes control characters (0x00-0x1F)
   * - Trims trailing spaces and periods
   * - Avoids reserved names by appending underscore
   * - Limits to 200 chars (leaving room for extension)
   */
  const sanitizeFilename = useCallback((name: string, suffix: string): string => {
    // Windows reserved characters + control characters (use unicode escape to avoid linter issues)
    // eslint-disable-next-line no-control-regex
    let sanitized = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');

    // Trim trailing spaces and periods (Windows doesn't allow these)
    sanitized = sanitized.replace(/[.\s]+$/, '');

    // Windows reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reservedNames.test(sanitized)) {
      sanitized += '_';
    }

    // Limit length (leave room for suffix)
    const maxLength = 200 - suffix.length;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength);
      // Re-trim trailing spaces/periods after truncation
      sanitized = sanitized.replace(/[.\s]+$/, '');
    }

    return (sanitized || 'lorebook') + suffix;
  }, []);

  // Handle export lorebook to file
  const handleExport = useCallback(() => {
    if (entries.length === 0) return;

    const exportData = convertToSTLorebook(draftLorebook);
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    let url: string | null = null;

    try {
      url = URL.createObjectURL(blob);

      // Use bookName if set, otherwise fall back to "{characterName}'s Lorebook.json"
      const name = bookName.trim() || `${characterName || 'character'}'s Lorebook`;
      const filename = sanitizeFilename(name, '.json');

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  }, [draftLorebook, bookName, characterName, sanitizeFilename, entries.length]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
      {/* List panel: full height on mobile; fixed-width sidebar on desktop */}
      <div
        className={`
          flex min-h-0 w-full flex-col overflow-hidden border-border bg-muted/40
          md:w-72 md:shrink-0 md:border-r
          ${isMobileViewOpen ? 'hidden md:flex' : 'flex flex-1 md:flex-none'}
        `}
      >
        {/* Book Settings Toggle */}
        <div className="shrink-0 border-b border-border">
          <button
            type="button"
            onClick={() => setIsBookSettingsOpen(!isBookSettingsOpen)}
            className="flex w-full items-center justify-between px-3 py-3 text-sm font-medium text-fg-muted transition-colors hover:bg-hover/50 touch-manipulation"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface">
                <Settings className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-fg">Lorebook</p>
                <p className="text-xs font-normal text-fg-muted">
                  {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
                  {isBookSettingsOpen ? '' : ' · Settings'}
                </p>
              </div>
            </div>
            {isBookSettingsOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isBookSettingsOpen && (
            <div className="space-y-3 px-3 pb-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">
                  Book Name
                </label>
                <input
                  type="text"
                  value={bookName}
                  onChange={(e) => handleBookNameChange(e.target.value)}
                  placeholder="Character Lorebook"
                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">
                  Description
                </label>
                <input
                  type="text"
                  value={bookDescription}
                  onChange={(e) => handleBookDescriptionChange(e.target.value)}
                  placeholder="Brief description"
                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              {entries.length > 0 && (
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-xs font-medium text-fg-muted">Context</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleEnableAllContext}
                      className="text-xs text-fg-muted transition-colors hover:text-fg"
                      title="Enable all entries in context"
                    >
                      Enable All
                    </button>
                    <span className="text-fg-subtle">|</span>
                    <button
                      type="button"
                      onClick={handleDisableAllContext}
                      className="text-xs text-fg-muted transition-colors hover:text-fg"
                      title="Disable all entries in context"
                    >
                      Disable All
                    </button>
                  </div>
                </div>
              )}
              {onDelete && (
                <div className="border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={handleDeleteLorebook}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-danger/30 px-2.5 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger-soft touch-manipulation"
                    title="Delete the entire lorebook"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Lorebook
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <div className="shrink-0 border-b border-border px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${entries.length} entries...`}
                className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-7 text-xs text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mt-1.5 text-[11px] text-fg-muted">
                {filteredEntries.length} of {entries.length} entries
              </p>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {entries.length === 0 ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 py-10 text-center text-fg-subtle">
              <Book className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm font-medium text-fg-muted">No entries yet</p>
              <p className="mt-1 text-xs">Add lore entries your character can pull into context.</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex h-full min-h-32 flex-col items-center justify-center px-4 py-10 text-center text-fg-subtle">
              <Search className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm font-medium text-fg-muted">No entries match</p>
              <p className="mt-1 text-xs">Try a different search term.</p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const originalIndex = entryIndexById.get(entry.id) ?? 0;
              return (
                <MemoizedLorebookEntryListItem
                  key={entry.id}
                  entry={entry}
                  index={originalIndex}
                  tokenCount={originalIndex === safeSelectedIndex ? selectedEntryTokenCount : null}
                  isSelected={originalIndex === safeSelectedIndex}
                  isContextEnabled={isEntryContextEnabled(entry)}
                  onSelect={() => handleSelectEntry(originalIndex)}
                  onDelete={() => handleDeleteEntry(originalIndex)}
                  onToggleContext={() => {
                    const updatedEntry = {
                      ...entry,
                      extensions: {
                        ...entry.extensions,
                        context_enabled: !isEntryContextEnabled(entry),
                      },
                    };
                    const newEntries = [...entries];
                    newEntries[originalIndex] = updatedEntry;
                    persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
                  }}
                />
              );
            })
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleImportClick}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg touch-manipulation"
              title="Import lorebook from JSON file"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={entries.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
              title="Export lorebook to JSON file"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddEntry}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-3 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:border-accent/50 hover:bg-accent-soft hover:text-accent touch-manipulation"
          >
            <Plus className="h-4 w-4" />
            New Entry
          </button>
        </div>
      </div>

      {/* Detail panel */}
      <div
        className={`
          min-h-0 flex-1 overflow-hidden bg-surface
          ${!isMobileViewOpen ? 'hidden md:flex md:flex-col' : 'flex flex-col'}
        `}
      >
        {selectedEntry ? (
          <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2 md:mb-4">
              <button
                type="button"
                onClick={handleBackToList}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg md:hidden touch-manipulation"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-sm font-semibold text-fg">
                  {selectedEntry.comment || selectedEntry.name || `Entry ${safeSelectedIndex}`}
                </p>
                {selectedEntryTokenCount !== null && (
                  <p className="text-xs text-fg-muted">
                    {selectedEntryTokenCount.toLocaleString()} tokens
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteEntry(safeSelectedIndex)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger touch-manipulation"
                title="Delete entry"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
            <LorebookEntryDetail
              entry={selectedEntry}
              onPersistUpdate={handleEntryPersistUpdate}
              aiConfig={aiConfig}
              samplerSettings={samplerSettings}
              promptSettings={promptSettings}
              promptModels={promptModels}
              getContextContent={getContextContent}
              contextSectionIds={contextSectionIds}
              setSelectedText={setSelectedText}
              fontSize={fontSize}
              onFontSizeChange={onFontSizeChange}
              spellcheck={spellcheck}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-fg-subtle">
            <div className="px-6 text-center">
              <Book className="mx-auto mb-3 h-12 w-12 opacity-40" />
              <p className="text-sm font-medium text-fg-muted">Select an entry to edit</p>
              <p className="mt-1 text-xs">Or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LorebookEditor;
