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
} from 'lucide-react';
import { AIService } from '../../services/AIService';
import type { SamplerSettings, AIConfig, PromptSettings } from '../../db/types';
import type { CharacterSection, LorebookEntry, CharacterBook } from '../../db/characterTypes';
import { useAIEditor } from '../../hooks';
import { estimateTokens } from '../../services/AIService';

interface LorebookEditorProps {
  lorebook: CharacterBook | undefined;
  onChange: (lorebook: CharacterBook) => void;
  setSelectedText: (text: string) => void;
  contextSectionIds: CharacterSection[];
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getContextContent: (sectionIds: CharacterSection[]) => string[];
  activeSection: string;
}

interface LorebookEntryListItemProps {
  entry: LorebookEntry;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

interface LorebookEntryDetailProps {
  entry: LorebookEntry;
  onUpdate: (entry: LorebookEntry) => void;
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getContextContent: (sectionIds: CharacterSection[]) => string[];
  contextSectionIds: CharacterSection[];
  setSelectedText: (text: string) => void;
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
  isSelected,
  onSelect,
  onDelete,
}: LorebookEntryListItemProps): React.ReactElement {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const tokenCount = estimateTokens(entry.content);

  return (
    <div
      onClick={onSelect}
      className={`
        relative group cursor-pointer p-3 rounded-lg border transition-all duration-150
        ${isSelected
          ? 'bg-vault-200 dark:bg-vault-700 border-vault-500 dark:border-vault-400 ring-1 ring-vault-500 dark:ring-vault-400'
          : 'bg-white dark:bg-vault-800 border-vault-200 dark:border-vault-700 hover:border-vault-300 dark:hover:border-vault-600 hover:bg-vault-50 dark:hover:bg-vault-700'
        }
      `}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {entry.enabled ? (
            <div className="w-2 h-2 rounded-full bg-green-500" title="Enabled" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-vault-300 dark:bg-vault-600" title="Disabled" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-vault-900 dark:text-vault-100 truncate">
            {entry.name || `Entry ${index + 1}`}
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs text-vault-500 dark:text-vault-400">
            <span>{entry.keys.length} key{entry.keys.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{tokenCount} tokens</span>
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="
            opacity-0 group-hover:opacity-100 focus:opacity-100
            p-1.5 text-vault-400 hover:text-red-500 dark:text-vault-500 dark:hover:text-red-400
            hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all
          "
          title="Delete entry"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Full detail editor for an entry (right panel)
 */
function LorebookEntryDetail({
  entry,
  onUpdate,
  aiConfig,
  samplerSettings,
  promptSettings,
  getContextContent,
  contextSectionIds,
  setSelectedText,
}: LorebookEntryDetailProps): React.ReactElement {
  const { editorRef } = useAIEditor({
    value: entry.content,
    onChange: (value) => onUpdate({ ...entry, content: value }),
    setSelectedText,
    aiConfig,
    samplerSettings,
    promptSettings,
    getContextContent,
    contextSectionIds,
    minHeight: '200px',
    maxHeight: 'none',
    isActive: true,
  });

  // Local state for keys input to allow typing commas/spaces without immediate parsing
  const [keysInput, setKeysInput] = React.useState(entry.keys.join(', '));
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const aiServiceRef = useRef<AIService | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync keysInput when entry.keys changes from outside
  React.useEffect(() => {
    const newKeysString = entry.keys.join(', ');
    setKeysInput(prev => prev !== newKeysString ? newKeysString : prev);
  }, [entry.keys]);

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
    if (!entry.content.trim()) return;

    setGeneratingKeys(true);
    aiServiceRef.current = new AIService(aiConfig, samplerSettings, promptSettings);

    // 15-second timeout
    timeoutRef.current = setTimeout(() => {
      handleAbortGeneration();
    }, 15000);

    try {
      const result = await aiServiceRef.current.instructText(
        entry.content,
        'Generate 2-5 comma-separated trigger keywords/keys that would cause this lorebook entry to activate. Output ONLY the comma-separated keywords, nothing else.',
        getContextContent(contextSectionIds)
      );

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const parsedKeys = result.content.split(',').map(k => k.trim()).filter(k => k);
      if (parsedKeys.length > 0) {
        const mergedKeys = [...entry.keys];
        for (const key of parsedKeys) {
          if (!mergedKeys.some(k => k.toLowerCase() === key.toLowerCase())) {
            mergedKeys.push(key);
          }
        }
        const newKeysString = mergedKeys.join(', ');
        setKeysInput(newKeysString);
        onUpdate({ ...entry, keys: mergedKeys });
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
  const handleNameChange = (value: string) => onUpdate({ ...entry, name: value });
  const handleKeysChange = (value: string) => setKeysInput(value);
  const handleKeysBlur = () => {
    const parsedKeys = keysInput.split(',').map(k => k.trim()).filter(k => k);
    onUpdate({ ...entry, keys: parsedKeys });
  };
  const handleCommentChange = (value: string) => onUpdate({ ...entry, comment: value });
  const handlePriorityChange = (value: string) => {
    const num = parseInt(value, 10);
    onUpdate({ ...entry, priority: isNaN(num) ? 0 : num });
  };
  const handlePositionChange = (value: LorebookEntry['position']) => onUpdate({ ...entry, position: value });
  const handleEnabledChange = (checked: boolean) => onUpdate({ ...entry, enabled: checked });
  const handleCaseSensitiveChange = (checked: boolean) => onUpdate({ ...entry, case_sensitive: checked });
  const handleConstantChange = (checked: boolean) => onUpdate({ ...entry, constant: checked });

  return (
    <div className="space-y-2">
      {/* Name Field */}
      <div>
        <label className="block text-sm font-medium text-vault-700 dark:text-vault-300 mb-2">
          Entry Name
        </label>
        <input
          type="text"
          value={entry.name || ''}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Entry display name (optional)"
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
            text-vault-900 dark:text-vault-100 placeholder:text-vault-400
            focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
        />
      </div>

      {/* Keys Field */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-vault-700 dark:text-vault-300">
            Trigger Keys
          </label>
          <span className="text-xs text-vault-400">(comma, separated)</span>
          <button
            onClick={handleGenerateKeys}
            disabled={!generatingKeys && !entry.content.trim()}
            title={generatingKeys ? 'Stop generation' : 'Generate trigger keys with AI'}
            className={`p-1.5 rounded transition-colors ${
              generatingKeys
                ? 'text-red-400 animate-pulse cursor-pointer hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-vault-400 hover:text-vault-600 dark:hover:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-700 disabled:opacity-40 disabled:cursor-not-allowed'
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
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
            text-vault-900 dark:text-vault-100 placeholder:text-vault-400
            focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
        />
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-vault-700 dark:text-vault-300 mb-2">
            Priority
          </label>
          <input
            type="number"
            value={entry.priority ?? 0}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
              text-vault-900 dark:text-vault-100
              focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
          />
        </div>

        {/* Position */}
        <div>
          <label className="block text-sm font-medium text-vault-700 dark:text-vault-300 mb-2">
            Position
          </label>
          <select
            value={entry.position || 'before_char'}
            onChange={(e) => handlePositionChange(e.target.value as LorebookEntry['position'])}
            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
              text-vault-900 dark:text-vault-100
              focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
          >
            {POSITION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={entry.enabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
            className="w-4 h-4 rounded border-vault-300 text-vault-600 focus:ring-vault-500"
          />
          <span className="text-sm text-vault-700 dark:text-vault-300">Enabled</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={entry.case_sensitive}
            onChange={(e) => handleCaseSensitiveChange(e.target.checked)}
            className="w-4 h-4 rounded border-vault-300 text-vault-600 focus:ring-vault-500"
          />
          <span className="text-sm text-vault-700 dark:text-vault-300">Case Sensitive</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={entry.constant ?? false}
            onChange={(e) => handleConstantChange(e.target.checked)}
            className="w-4 h-4 rounded border-vault-300 text-vault-600 focus:ring-vault-500"
          />
          <span className="text-sm text-vault-700 dark:text-vault-300">Constant</span>
        </label>
      </div>

      {/* Content Editor (with AI toolbar) */}
      <div>
        <div
          ref={editorRef}
          className="border border-vault-200 dark:border-vault-700 rounded-xl overflow-hidden"
          style={{ minHeight: '200px' }}
        />
      </div>

      {/* Comment Field */}
      <div>
        <input
          type="text"
          value={entry.comment || ''}
          onChange={(e) => handleCommentChange(e.target.value)}
          placeholder="Internal notes about this entry, not used in output (optional)"
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
            text-vault-900 dark:text-vault-100 placeholder:text-vault-400
            focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
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
  setSelectedText,
  contextSectionIds,
  aiConfig,
  samplerSettings,
  promptSettings,
  getContextContent,
  activeSection,
}: LorebookEditorProps): React.ReactElement {
  return (
    <LorebookEditorInner
      lorebook={lorebook}
      onChange={onChange}
      setSelectedText={setSelectedText}
      contextSectionIds={contextSectionIds}
      aiConfig={aiConfig}
      samplerSettings={samplerSettings}
      promptSettings={promptSettings}
      getContextContent={getContextContent}
      activeSection={activeSection}
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
  setSelectedText,
  contextSectionIds,
  aiConfig,
  samplerSettings,
  promptSettings,
  getContextContent,
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

  // Notify parent of changes
  const notifyChange = useCallback((
    newEntries: LorebookEntry[],
    newName: string,
    newDesc: string
  ) => {
    const updatedLorebook: CharacterBook = {
      name: newName,
      description: newDesc,
      entries: newEntries,
      extensions: draftLorebook.extensions || {},
    };
    setDraftLorebook(updatedLorebook);
    onChange(updatedLorebook);
  }, [draftLorebook.extensions, onChange]);

  // Handle entry update
  const handleEntryUpdate = useCallback((updatedEntry: LorebookEntry) => {
    const newEntries = [...entries];
    newEntries[safeSelectedIndex] = updatedEntry;
    notifyChange(newEntries, bookName, bookDescription);
  }, [entries, safeSelectedIndex, bookName, bookDescription, notifyChange]);

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
      insertion_order: entries.length,
      case_sensitive: false,
      name: '',
      priority: 0,
      position: 'before_char',
    };
    const newEntries = [...entries, newEntry];
    const newIndex = newEntries.length - 1;

    notifyChange(newEntries, bookName, bookDescription);
    setSelectedEntryIndex(newIndex);
    setIsMobileViewOpen(true);
  }, [entries, bookName, bookDescription, notifyChange, getNextAvailableId]);

  // Handle delete entry
  const handleDeleteEntry = useCallback((index: number) => {
    const entry = entries[index];
    const shouldDelete = window.confirm(`Delete lorebook entry "${entry.name || `Entry ${index + 1}`}"?`);
    if (!shouldDelete) return;

    const newEntries = entries.filter((_, i) => i !== index);
    notifyChange(newEntries, bookName, bookDescription);

    // Adjust selected index if needed
    if (selectedEntryIndex >= newEntries.length) {
      setSelectedEntryIndex(Math.max(0, newEntries.length - 1));
    } else if (selectedEntryIndex > index) {
      setSelectedEntryIndex(selectedEntryIndex - 1);
    }
  }, [entries, selectedEntryIndex, bookName, bookDescription, notifyChange]);

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
    notifyChange(entries, value, bookDescription);
  };

  const handleBookDescriptionChange = (value: string) => {
    notifyChange(entries, bookName, value);
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden min-h-0">
      {/* Left Sidebar - Hidden on mobile when viewing detail */}
      <div className={`
        w-full md:w-64 shrink-0 min-h-0 max-h-[50dvh] md:max-h-none overflow-hidden border-r border-vault-200 dark:border-vault-700 
        bg-vault-50/30 dark:bg-vault-800/20 flex flex-col
        ${isMobileViewOpen ? 'hidden md:flex' : 'flex'}
      `}>
        {/* Book Settings Toggle */}
        <div className="shrink-0 border-b border-vault-200 dark:border-vault-700">
          <button
            onClick={() => setIsBookSettingsOpen(!isBookSettingsOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-vault-700 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-700/50 transition-colors"
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
                <label className="block text-xs font-medium text-vault-600 dark:text-vault-400 mb-1">
                  Book Name
                </label>
                <input
                  type="text"
                  value={bookName}
                  onChange={(e) => handleBookNameChange(e.target.value)}
                  placeholder="Character Lorebook"
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded
                    text-vault-900 dark:text-vault-100 placeholder:text-vault-400
                    focus:outline-none focus:ring-1 focus:ring-vault-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-vault-600 dark:text-vault-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={bookDescription}
                  onChange={(e) => handleBookDescriptionChange(e.target.value)}
                  placeholder="Brief description"
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded
                    text-vault-900 dark:text-vault-100 placeholder:text-vault-400
                    focus:outline-none focus:ring-1 focus:ring-vault-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Search Bar */}
        {entries.length > 0 && (
          <div className="shrink-0 px-3 py-2 border-b border-vault-200 dark:border-vault-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-vault-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${entries.length} entries...`}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded
                  text-vault-900 dark:text-vault-100 placeholder:text-vault-400
                  focus:outline-none focus:ring-1 focus:ring-vault-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-vault-400 hover:text-vault-600 dark:hover:text-vault-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="text-[10px] text-vault-500 dark:text-vault-400 mt-1">
                {filteredEntries.length} of {entries.length} entries
              </div>
            )}
          </div>
        )}

        {/* Entry List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-vault-400 dark:text-vault-500">
              <Book className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No entries yet</p>
              <p className="text-[10px] mt-0.5">Click "Add Entry" to start</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-vault-400 dark:text-vault-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No entries match</p>
              <p className="text-[10px] mt-0.5">Try a different search term</p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const originalIndex = entries.findIndex(e => e.id === entry.id);
              return (
                <LorebookEntryListItem
                  key={entry.id}
                  entry={entry}
                  index={originalIndex}
                  isSelected={originalIndex === safeSelectedIndex}
                  onSelect={() => handleSelectEntry(originalIndex)}
                  onDelete={() => handleDeleteEntry(originalIndex)}
                />
              );
            })
          )}
        </div>

        {/* Add Button at Bottom */}
        <div className="shrink-0 p-3 border-t border-vault-200 dark:border-vault-700">
          <button
            onClick={handleAddEntry}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-vault-300 dark:border-vault-600
              text-vault-600 dark:text-vault-400 hover:text-vault-800 dark:hover:text-vault-200
              hover:border-vault-400 dark:hover:border-vault-500 hover:bg-vault-50 dark:hover:bg-vault-700/30
              rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </button>
        </div>
      </div>

      {/* Right Detail Panel */}
      <div className={`
        flex-1 min-h-0 overflow-y-auto bg-white dark:bg-vault-900
        ${!isMobileViewOpen ? 'hidden md:block' : 'block'}
      `}>
        {selectedEntry ? (
          <div className="p-4 md:p-6 pb-[max(env(safe-area-inset-bottom),0px)]">
            {/* Mobile Back Button */}
            <button
              onClick={handleBackToList}
              className="md:hidden mb-4 flex items-center gap-1 text-sm text-vault-600 dark:text-vault-400 hover:text-vault-800 dark:hover:text-vault-200"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to entries
            </button>
            <LorebookEntryDetail
              entry={selectedEntry}
              onUpdate={handleEntryUpdate}
              aiConfig={aiConfig}
              samplerSettings={samplerSettings}
              promptSettings={promptSettings}
              getContextContent={getContextContent}
              contextSectionIds={contextSectionIds}
              setSelectedText={setSelectedText}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-vault-400 dark:text-vault-500">
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
