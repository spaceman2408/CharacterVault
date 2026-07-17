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
        relative group cursor-pointer p-3 rounded-lg border transition-all duration-150
        ${isSelected
          ? 'bg-accent-soft border-accent ring-1 ring-accent'
          : 'bg-surface border-border hover:border-accent/40 hover:bg-accent-soft'
        }
      `}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-fg truncate">
            {entry.comment || entry.name || `Entry ${index}`}
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs text-fg-muted">
            <span>{entry.keys.length} key{entry.keys.length !== 1 ? 's' : ''}</span>
            {tokenCount !== null ? (
              <>
                <span>·</span>
                <span>{tokenCount} tokens</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Context toggle button (eye icon) */}
          <button
            onClick={handleToggleContext}
            className={`
              p-1.5 rounded transition-all
              ${isContextEnabled
                ? 'text-success hover:opacity-90 hover:bg-success-soft'
                : 'text-fg-subtle hover:text-fg hover:bg-hover text-fg0 hover:text-fg hover:bg-hover'
              }
            `}
            title={isContextEnabled ? 'In context (click to exclude)' : 'Not in context (click to include)'}
          >
            {isContextEnabled ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleDelete}
            className="
              p-1.5 text-fg-subtle hover:text-danger text-fg0 hover:text-danger
              hover:bg-danger-soft rounded transition-all
            "
            title="Delete entry"
          >
            <Trash2 className="w-3.5 h-3.5" />
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
  const { editorRef } = useAIEditor({
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

  return (
    <div className="flex flex-col gap-2 md:flex-1 md:min-h-0">
      {/* Comment Field (Entry Name in SillyTavern) */}
      <div className="shrink-0">
        <label className="block text-sm font-medium text-fg-muted mb-2">
          Entry Name
        </label>
        <input
          type="text"
          value={draftEntry.comment || ''}
          onChange={(e) => handleCommentChange(e.target.value)}
          placeholder="Entry display name (optional)"
          className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg
            text-fg placeholder:text-fg-subtle
            focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
      </div>

      {/* Keys Field */}
      <div className="shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-fg-muted">
            Trigger Keys
          </label>
          <span className="text-xs text-fg-subtle">(comma, separated)</span>
          <button
            onClick={handleGenerateKeys}
            disabled={!generatingKeys && !draftEntry.content.trim()}
            title={generatingKeys ? 'Stop generation' : 'Generate trigger keys with AI'}
            className={`p-1.5 rounded transition-colors ${
              generatingKeys
                ? 'text-red-400 animate-pulse cursor-pointer hover:text-danger hover:bg-danger-soft'
                : 'text-fg-subtle hover:text-fg hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {generatingKeys ? (
              <Square className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <input
          type="text"
          value={keysInput}
          onChange={(e) => handleKeysChange(e.target.value)}
          onBlur={handleKeysBlur}
          placeholder="castle, fortress, stronghold"
          className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg
            text-fg placeholder:text-fg-subtle
            focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
      </div>

      {/* Settings Grid */}
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-fg-muted mb-2">
            Priority
          </label>
          <input
            type="number"
            value={draftEntry.priority ?? 0}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg
              text-fg
              focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>

        {/* Position */}
        <div>
          <label className="block text-sm font-medium text-fg-muted mb-2">
            Position
          </label>
          <select
            value={entry.position || 'before_char'}
            onChange={(e) => handlePositionChange(e.target.value as LorebookEntry['position'])}
            className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg
              text-fg
              focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            {POSITION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toggles */}
      <div className="shrink-0 flex flex-wrap gap-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={entry.enabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
            className="w-4 h-4 rounded border-border-strong text-fg-muted focus:ring-accent"
          />
          <span className="text-sm text-fg-muted">Enabled</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={entry.case_sensitive ?? false}
            onChange={(e) => handleCaseSensitiveChange(e.target.checked)}
            className="w-4 h-4 rounded border-border-strong text-fg-muted focus:ring-accent"
          />
          <span className="text-sm text-fg-muted">Case Sensitive</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={entry.constant ?? false}
            onChange={(e) => handleConstantChange(e.target.checked)}
            className="w-4 h-4 rounded border-border-strong text-fg-muted focus:ring-accent"
          />
          <span className="text-sm text-fg-muted">Constant</span>
        </label>
      </div>

      {/* Content Editor (with AI toolbar) */}
      <div className="h-[50vh] min-h-[200px] md:h-auto md:flex-1 md:min-h-0 md:flex md:flex-col">
        <div
          ref={editorRef}
          className="h-full md:flex-1 md:min-h-0 border border-border rounded-xl overflow-hidden"
          style={{ minHeight: '200px' }}
        />
      </div>

      {/* Name Field (internal, moved to bottom) */}
      <div className="shrink-0">
        <input
          type="text"
          value={draftEntry.name || ''}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Internal notes about this entry, not used in output (optional)"
          className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg
            text-fg placeholder:text-fg-subtle
            focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
      </div>
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
    <div className="h-full flex flex-col md:flex-row overflow-hidden min-h-0">
      {/* Left Sidebar - Hidden on mobile when viewing detail */}
      <div className={`
        w-full md:w-64 shrink-0 min-h-0 max-h-[50dvh] md:max-h-none overflow-hidden border-r border-border 
        bg-muted/30 bg-muted/50 flex flex-col
        ${isMobileViewOpen ? 'hidden md:flex' : 'flex'}
      `}>
        {/* Book Settings Toggle */}
        <div className="shrink-0 border-b border-border">
          <button
            onClick={() => setIsBookSettingsOpen(!isBookSettingsOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-fg-muted hover:bg-hover/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span>Book Settings</span>
            </div>
            {isBookSettingsOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isBookSettingsOpen && (
            <div className="px-3 pb-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Book Name
                </label>
                <input
                  type="text"
                  value={bookName}
                  onChange={(e) => handleBookNameChange(e.target.value)}
                  placeholder="Character Lorebook"
                  className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded
                    text-fg placeholder:text-fg-subtle
                    focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={bookDescription}
                  onChange={(e) => handleBookDescriptionChange(e.target.value)}
                  placeholder="Brief description"
                  className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded
                    text-fg placeholder:text-fg-subtle
                    focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              {/* Context Visibility Controls */}
              {entries.length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <label className="text-xs font-medium text-fg-muted">
                    Context Visibility
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleEnableAllContext}
                      className="text-xs text-fg-muted hover:text-fg transition-colors"
                      title="Enable all entries in context"
                    >
                      Enable All
                    </button>
                    <span className="text-fg-subtle">|</span>
                    <button
                      onClick={handleDisableAllContext}
                      className="text-xs text-fg-muted hover:text-fg transition-colors"
                      title="Disable all entries in context"
                    >
                      Disable All
                    </button>
                  </div>
                </div>
              )}

              {/* Delete Lorebook */}
              {onDelete && (
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={handleDeleteLorebook}
                    className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 text-xs
                      text-danger hover:text-danger
                      hover:bg-danger-soft border border-danger/30
                      rounded transition-colors"
                    title="Delete the entire lorebook"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Lorebook
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search Bar */}
        {entries.length > 0 && (
          <div className="shrink-0 px-3 py-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${entries.length} entries...`}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-surface border border-border rounded
                  text-fg placeholder:text-fg-subtle
                  focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="text-[10px] text-fg-muted mt-1">
                {filteredEntries.length} of {entries.length} entries
              </div>
            )}
          </div>
        )}

        {/* Entry List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-fg-subtle">
              <Book className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No entries yet</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-fg-subtle">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No entries match</p>
              <p className="text-[10px] mt-0.5">Try a different search term</p>
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
                      extensions: { ...entry.extensions, context_enabled: !isEntryContextEnabled(entry) },
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

        {/* Import/Export/Add Buttons at Bottom */}
        <div className="shrink-0 p-3 border-t border-border space-y-2">
          {/* Import/Export Row */}
          <div className="flex gap-2">
            {/* Hidden file input for import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-border
                text-fg-muted hover:text-fg
                hover:bg-hover/30
                rounded-lg text-sm transition-colors"
              title="Import lorebook from JSON file"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={handleExport}
              disabled={entries.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-border
                text-fg-muted hover:text-fg
                hover:bg-hover/30
                disabled:opacity-40 disabled:cursor-not-allowed
                rounded-lg text-sm transition-colors"
              title="Export lorebook to JSON file"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>

          {/* New Entry Button */}
          <button
            onClick={handleAddEntry}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-border-strong
              text-fg-muted hover:text-fg
              hover:border-border-strong hover:bg-hover/30
              rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </button>
        </div>
      </div>

      {/* Right Detail Panel */}
      <div className={`
        flex-1 min-h-0 bg-surface
        ${!isMobileViewOpen ? 'hidden md:flex md:flex-col md:overflow-hidden' : 'block overflow-y-auto md:flex md:flex-col md:overflow-hidden'}
      `}>
        {selectedEntry ? (
          <div className="p-4 md:p-6 md:flex-1 md:min-h-0 md:flex md:flex-col pb-[max(env(safe-area-inset-bottom),0px)]">
            {/* Mobile Back Button */}
            <button
              onClick={handleBackToList}
              className="md:hidden mb-4 shrink-0 flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to entries
            </button>
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
          <div className="h-full flex items-center justify-center text-fg-subtle">
            <div className="text-center">
              <Book className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select an entry to edit</p>
              <p className="text-xs mt-1">Or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LorebookEditor;
