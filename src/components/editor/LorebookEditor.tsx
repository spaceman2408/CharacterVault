/**
 * @fileoverview Lorebook Editor component for managing character lore entries.
 * Uses CodeMirror with AI toolbar for entry content editing.
 * @module components/editor/LorebookEditor
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Book } from 'lucide-react';
import type { SamplerSettings, AIConfig, PromptSettings } from '../../db/types';
import type { CharacterSection, LorebookEntry, CharacterBook } from '../../db/characterTypes';
import { useAIEditor } from '../../hooks';

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

interface LorebookEntryCardProps {
  entry: LorebookEntry;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: (entry: LorebookEntry) => void;
  onDelete: () => void;
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
 * Individual lorebook entry card with CodeMirror editor for content
 */
function LorebookEntryCard({
  entry,
  index,
  isOpen,
  onToggle,
  onUpdate,
  onDelete,
  aiConfig,
  samplerSettings,
  promptSettings,
  getContextContent,
  contextSectionIds,
  setSelectedText,
}: LorebookEntryCardProps): React.ReactElement {
  // Use the shared AI editor hook for the content field
  const { editorRef } = useAIEditor({
    value: entry.content,
    onChange: (value) => onUpdate({ ...entry, content: value }),
    setSelectedText,
    aiConfig,
    samplerSettings,
    promptSettings,
    getContextContent,
    contextSectionIds,
    minHeight: 'clamp(110px, 22vh, 180px)',
    maxHeight: 'clamp(220px, 40vh, 360px)',
    isActive: isOpen,
  });

  // Local state for keys input to allow typing commas/spaces without immediate parsing
  const [keysInput, setKeysInput] = React.useState(entry.keys.join(', '));
  
  // Sync keysInput when entry.keys changes from outside (e.g., initial load)
  // Only update if the actual keys content is different to avoid resetting while typing
  React.useEffect(() => {
    const newKeysString = entry.keys.join(', ');
    // Only update if different (to avoid interrupting typing)
    setKeysInput(prev => prev !== newKeysString ? newKeysString : prev);
  }, [entry.keys]);

  // Form input handlers
  const handleNameChange = (value: string) => onUpdate({ ...entry, name: value });
  
  const handleKeysChange = (value: string) => {
    setKeysInput(value);
  };
  
  const handleKeysBlur = () => {
    // Parse keys only when the input loses focus
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

  const keysDisplay = entry.keys.join(', ') || 'No keys';
  const statusDisplay = entry.enabled ? 'Enabled' : 'Disabled';

  return (
    <div className="border border-vault-200 dark:border-vault-700 rounded-xl overflow-hidden bg-white dark:bg-vault-800 shadow-sm">
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-vault-50 dark:bg-vault-700/50 border-b border-vault-200 dark:border-vault-700">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-mono text-vault-400 dark:text-vault-500 shrink-0">
            (UID: {entry.id})
          </span>
          <span className="text-sm font-medium text-vault-700 dark:text-vault-300 truncate">
            {entry.name || `Entry ${index + 1}`}
          </span>
          <span className="text-xs text-vault-500 dark:text-vault-400 shrink-0">
            ({entry.keys.length} keys)
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
            entry.enabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            {statusDisplay}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className="p-1.5 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-200 dark:hover:bg-vault-700 rounded-lg transition-colors"
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete entry"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Card Content (when expanded) */}
      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-xs font-medium text-vault-600 dark:text-vault-400 mb-1.5">
              Entry Name
            </label>
            <input
              type="text"
              value={entry.name || ''}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Entry display name (optional)"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
                text-vault-900 dark:text-vault-100 placeholder:text-vault-400
                focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
            />
          </div>

          {/* Keys Field */}
          <div>
            <label className="block text-xs font-medium text-vault-600 dark:text-vault-400 mb-1.5">
              Trigger Keys <span className="text-vault-400">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={keysInput}
              onChange={(e) => handleKeysChange(e.target.value)}
              onBlur={handleKeysBlur}
              placeholder="castle, fortress, stronghold"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
                text-vault-900 dark:text-vault-100 placeholder:text-vault-400
                focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
            />
          </div>

          {/* Settings Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-vault-600 dark:text-vault-400 mb-1.5">
                Priority
              </label>
              <input
                type="number"
                value={entry.priority ?? 0}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
                  text-vault-900 dark:text-vault-100
                  focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
              />
            </div>

            {/* Position */}
            <div>
              <label className="block text-xs font-medium text-vault-600 dark:text-vault-400 mb-1.5">
                Position
              </label>
              <select
                value={entry.position || 'before_char'}
                onChange={(e) => handlePositionChange(e.target.value as LorebookEntry['position'])}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
                  text-vault-900 dark:text-vault-100
                  focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
              >
                {POSITION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={(e) => handleEnabledChange(e.target.checked)}
                  className="w-4 h-4 rounded border-vault-300 text-vault-600 focus:ring-vault-500"
                />
                <span className="text-xs text-vault-600 dark:text-vault-400">Enabled</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={entry.case_sensitive}
                  onChange={(e) => handleCaseSensitiveChange(e.target.checked)}
                  className="w-4 h-4 rounded border-vault-300 text-vault-600 focus:ring-vault-500"
                />
                <span className="text-xs text-vault-600 dark:text-vault-400">Case Sensitive</span>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={entry.constant ?? false}
                  onChange={(e) => handleConstantChange(e.target.checked)}
                  className="w-4 h-4 rounded border-vault-300 text-vault-600 focus:ring-vault-500"
                />
                <span className="text-xs text-vault-600 dark:text-vault-400">Constant</span>
              </label>
            </div>
          </div>

          {/* Content Editor (with AI toolbar) */}
          <div>
            <label className="block text-xs font-medium text-vault-600 dark:text-vault-400 mb-1.5">
              Content <span className="text-vault-400">(AI toolbar available when text is selected)</span>
            </label>
            <div
              ref={editorRef}
              className="border border-vault-200 dark:border-vault-700 rounded-xl overflow-hidden min-h-[clamp(110px,22vh,180px)]"
            />
          </div>

          {/* Comment Field */}
          <div>
            <label className="block text-xs font-medium text-vault-600 dark:text-vault-400 mb-1.5">
              Comment <span className="text-vault-400">(internal notes, not included in output)</span>
            </label>
            <input
              type="text"
              value={entry.comment || ''}
              onChange={(e) => handleCommentChange(e.target.value)}
              placeholder="Internal notes about this entry"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
                text-vault-900 dark:text-vault-100 placeholder:text-vault-400
                focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Collapsed Preview */}
      {!isOpen && (
        <div className="px-4 py-3 bg-vault-50/50 dark:bg-vault-800/50">
          <div className="text-xs text-vault-600 dark:text-vault-400 mb-1">
            <strong>Keys:</strong> {keysDisplay}
          </div>
          <div className="text-xs text-vault-500 dark:text-vault-500 truncate">
            {entry.content || <span className="italic">No content</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lorebook Editor for managing character lore entries
 * Uses a key-based approach to reset state when lorebook reference changes
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
  // Use a stable key that only changes when the lorebook reference changes
  // This prevents remounting when only the content changes
  const lorebookKey = lorebook 
    ? `lb-${lorebook.name ?? 'unnamed'}-${lorebook.entries.length}`
    : 'no-lorebook';

  return (
    <LorebookEditorInner
      key={lorebookKey}
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
 * Inner component that gets remounted when lorebook changes
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
  const [openCards, setOpenCards] = useState<Set<number>>(new Set([0]));
  
  // Use props directly as source of truth - memoized to prevent unnecessary re-renders
  const entries = useMemo(() => lorebook?.entries || [], [lorebook?.entries]);
  const bookName = lorebook?.name || '';
  const bookDescription = lorebook?.description || '';

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
      extensions: lorebook?.extensions || {},
    };
    onChange(updatedLorebook);
  }, [lorebook?.extensions, onChange]);

  // Handle entry update
  const handleEntryUpdate = useCallback((index: number, updatedEntry: LorebookEntry) => {
    const newEntries = [...entries];
    newEntries[index] = updatedEntry;
    notifyChange(newEntries, bookName, bookDescription);
  }, [entries, bookName, bookDescription, notifyChange]);

  // Find the lowest available ID (reuse freed IDs)
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
    setOpenCards(prev => new Set([...prev, newIndex]));
    notifyChange(newEntries, bookName, bookDescription);
  }, [entries, bookName, bookDescription, notifyChange, getNextAvailableId]);

  // Handle delete entry
  const handleDeleteEntry = useCallback((index: number) => {
    const shouldDelete = window.confirm(`Delete lorebook entry ${index + 1}?`);
    if (!shouldDelete) {
      return;
    }

    const newEntries = entries.filter((_, i) => i !== index);
    const newOpenCards = new Set<number>();
    openCards.forEach(i => {
      if (i < index) newOpenCards.add(i);
      else if (i > index) newOpenCards.add(i - 1);
    });
    setOpenCards(newOpenCards);
    notifyChange(newEntries, bookName, bookDescription);
  }, [entries, openCards, bookName, bookDescription, notifyChange]);

  // Handle toggle card
  const handleToggleCard = useCallback((index: number) => {
    const newOpenCards = new Set(openCards);
    if (newOpenCards.has(index)) {
      newOpenCards.delete(index);
    } else {
      newOpenCards.add(index);
    }
    setOpenCards(newOpenCards);
  }, [openCards]);

  // Handle book name/description changes
  const handleBookNameChange = (value: string) => {
    notifyChange(entries, value, bookDescription);
  };

  const handleBookDescriptionChange = (value: string) => {
    notifyChange(entries, bookName, value);
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-vault-900 dark:text-vault-50">
            Lorebook
          </h2>
          <p className="text-sm text-vault-500 dark:text-vault-400">
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} total
          </p>
        </div>
        <button
          onClick={handleAddEntry}
          className="flex items-center gap-2 px-4 py-2 bg-vault-600 hover:bg-vault-700 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      </div>

      {/* Book Settings */}
      <div className="mb-4 p-4 bg-vault-50 dark:bg-vault-800/50 border border-vault-200 dark:border-vault-700 rounded-xl shrink-0">
        <h3 className="text-sm font-semibold text-vault-700 dark:text-vault-300 mb-3">
          Book Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-vault-600 dark:text-vault-400 mb-1.5">
              Book Name
            </label>
            <input
              type="text"
              value={bookName}
              onChange={(e) => handleBookNameChange(e.target.value)}
              placeholder="Character Lorebook"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
                text-vault-900 dark:text-vault-100 placeholder:text-vault-400
                focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-vault-600 dark:text-vault-400 mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={bookDescription}
              onChange={(e) => handleBookDescriptionChange(e.target.value)}
              placeholder="Brief description of this lorebook"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg
                text-vault-900 dark:text-vault-100 placeholder:text-vault-400
                focus:outline-none focus:ring-2 focus:ring-vault-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {entries.length === 0 ? (
          <div className="text-center py-12 text-vault-400 dark:text-vault-500">
            <Book className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No lore entries yet</p>
            <p className="text-xs mt-1">Click "Add Entry" to create your first lore entry</p>
          </div>
        ) : (
          entries.map((entry, index) => (
            <LorebookEntryCard
              key={entry.id}
              entry={entry}
              index={index}
              isOpen={openCards.has(index)}
              onToggle={() => handleToggleCard(index)}
              onUpdate={(updatedEntry) => handleEntryUpdate(index, updatedEntry)}
              onDelete={() => handleDeleteEntry(index)}
              aiConfig={aiConfig}
              samplerSettings={samplerSettings}
              promptSettings={promptSettings}
              getContextContent={getContextContent}
              contextSectionIds={contextSectionIds}
              setSelectedText={setSelectedText}
            />
          ))
        )}
      </div>

      {/* Info Footer */}
      <div className="mt-4 p-3 bg-vault-50 dark:bg-vault-800/50 border border-vault-200 dark:border-vault-700 rounded-lg shrink-0">
        <p className="text-xs text-vault-600 dark:text-vault-400">
          <strong>Note:</strong> This editor provides essential lore management. For advanced logic or complex world-building features, power users may prefer using dedicated tools like SillyTavern's World Info.
        </p>
      </div>
    </div>
  );
}

export default LorebookEditor;
