/**
 * @fileoverview Greetings Editor component with two-panel layout.
 * Left sidebar for greeting list, right panel for editor.
 * @module components/editor/GreetingsEditor
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Trash2, MessageSquare, ChevronLeft } from 'lucide-react';
import type { SamplerSettings, AIConfig, PromptSettings } from '../../db/characterTypes';
import type { CharacterSection } from '../../db/characterTypes';
import { useAIEditor } from '../../hooks';
import { estimateTokens } from '../../services/AIService';

interface GreetingsEditorProps {
  greetings: string[];
  onChange: (greetings: string[]) => void;
  selectedText: string;
  setSelectedText: (text: string) => void;
  contextSectionIds: CharacterSection[];
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getContextContent: (sectionIds: CharacterSection[]) => string[];
  activeSection: string;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  spellcheck?: import('../../db/characterTypes').SpellcheckSettings;
}

interface GreetingListItemProps {
  greeting: string;
  index: number;
  tokenCount: number | null;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

interface GreetingDetailProps {
  greeting: string;
  onPersistUpdate: (value: string) => void;
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getContextContent: (sectionIds: CharacterSection[]) => string[];
  contextSectionIds: CharacterSection[];
  setSelectedText: (text: string) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  spellcheck?: import('../../db/characterTypes').SpellcheckSettings;
}

/**
 * Compact greeting card for the sidebar list
 */
function GreetingListItem({
  greeting,
  index,
  tokenCount,
  isSelected,
  onSelect,
  onDelete,
}: GreetingListItemProps): React.ReactElement {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const hasContent = greeting.trim().length > 0;
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
          {hasContent ? (
            <div className="w-2 h-2 rounded-full bg-green-500" title="Has content" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-vault-300 dark:bg-vault-600" title="Empty" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-vault-900 dark:text-vault-100 truncate">
            Greeting {index + 1}
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs text-vault-500 dark:text-vault-400">
            {tokenCount !== null ? <span>{tokenCount} tokens</span> : null}
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="
            opacity-0 group-hover:opacity-100 focus:opacity-100
            p-1.5 text-vault-400 hover:text-red-500 dark:text-vault-500 dark:hover:text-red-400
            hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all
          "
          title="Delete greeting"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Full editor for a greeting (right panel)
 */
function GreetingDetail({
  greeting,
  onPersistUpdate,
  aiConfig,
  samplerSettings,
  promptSettings,
  getContextContent,
  contextSectionIds,
  setSelectedText,
  fontSize,
  onFontSizeChange,
  spellcheck,
}: GreetingDetailProps): React.ReactElement {
  const [draftGreeting, setDraftGreeting] = useState(greeting);

  useEffect(() => {
    setDraftGreeting(greeting);
  }, [greeting]);

  const { editorRef } = useAIEditor({
    value: draftGreeting,
    onImmediateChange: setDraftGreeting,
    onPersistChange: onPersistUpdate,
    saveMode: 'debounced',
    saveDebounceMs: 250,
    setSelectedText,
    aiConfig,
    samplerSettings,
    promptSettings,
    getContextContent,
    contextSectionIds,
    minHeight: '200px',
    maxHeight: 'none',
    isActive: true,
    fontSize,
    onFontSizeChange,
    spellcheck,
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Editor */}
      <div
        ref={editorRef}
        className="flex-1 min-h-0 border border-vault-200 dark:border-vault-700 rounded-xl overflow-hidden"
        style={{ minHeight: '200px' }}
      />
    </div>
  );
}

/**
 * Greetings Editor with two-panel layout
 * Sidebar list on left, detail editor on right
 */
export function GreetingsEditor({
  greetings,
  onChange,
  setSelectedText,
  contextSectionIds,
  aiConfig,
  samplerSettings,
  promptSettings,
  getContextContent,
  fontSize,
  onFontSizeChange,
  spellcheck,
}: GreetingsEditorProps): React.ReactElement {
  const [greetingsList, setGreetingsList] = useState<string[]>(greetings);
  const [selectedGreetingIndex, setSelectedGreetingIndex] = useState<number>(0);
  const [isMobileViewOpen, setIsMobileViewOpen] = useState(false);

  // Sync list from persisted state
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setGreetingsList(greetings);
      // Reset selection if out of bounds
      setSelectedGreetingIndex(prev =>
        prev >= (greetings.length || 0) ? 0 : prev
      );
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [greetings]);

  // Handle greeting update (persist to parent)
  const handleGreetingPersistUpdate = useCallback((index: number, value: string) => {
    const newList = [...greetingsList];
    newList[index] = value;
    setGreetingsList(newList);
    onChange(newList);
  }, [greetingsList, onChange]);

  // Handle add greeting
  const handleAddGreeting = useCallback(() => {
    const newList = [...greetingsList, ''];
    const newIndex = newList.length - 1;
    setGreetingsList(newList);
    setSelectedGreetingIndex(newIndex);
    setIsMobileViewOpen(true);
    onChange(newList);
  }, [greetingsList, onChange]);

  // Handle delete greeting
  const handleDeleteGreeting = useCallback((index: number) => {
    const shouldDelete = window.confirm(`Delete greeting ${index + 1}?`);
    if (!shouldDelete) return;

    const newList = greetingsList.filter((_, i) => i !== index);
    setGreetingsList(newList);
    onChange(newList);

    // Adjust selected index if needed
    if (selectedGreetingIndex >= newList.length) {
      setSelectedGreetingIndex(Math.max(0, newList.length - 1));
    } else if (selectedGreetingIndex > index) {
      setSelectedGreetingIndex(selectedGreetingIndex - 1);
    }
  }, [greetingsList, selectedGreetingIndex, onChange]);

  // Handle select greeting with mobile view
  const handleSelectGreeting = useCallback((index: number) => {
    setSelectedGreetingIndex(index);
    setIsMobileViewOpen(true);
  }, []);

  // Handle back to list on mobile
  const handleBackToList = useCallback(() => {
    setIsMobileViewOpen(false);
  }, []);

  // Ensure selected index is valid
  const safeSelectedIndex = selectedGreetingIndex < greetingsList.length ? selectedGreetingIndex : 0;
  const selectedGreeting = greetingsList[safeSelectedIndex];
  const selectedGreetingTokenCount = useMemo(
    () => (selectedGreeting !== undefined ? estimateTokens(selectedGreeting) : null),
    [selectedGreeting],
  );

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden min-h-0">
      {/* Left Sidebar - Hidden on mobile when viewing detail */}
      <div className={`
        w-full md:w-64 shrink-0 min-h-0 max-h-[50dvh] md:max-h-none overflow-hidden border-r border-vault-200 dark:border-vault-700 
        bg-vault-50/30 dark:bg-vault-800/20 flex flex-col
        ${isMobileViewOpen ? 'hidden md:flex' : 'flex'}
      `}>
        {/* Header */}
        <div className="shrink-0 px-3 py-2.5 border-b border-vault-200 dark:border-vault-700">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-vault-500" />
            <span className="text-sm font-medium text-vault-700 dark:text-vault-300">
              {greetingsList.length} greeting{greetingsList.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Greeting List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {greetingsList.length === 0 ? (
            <div className="text-center py-8 text-vault-400 dark:text-vault-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No greetings yet</p>
              <p className="text-[10px] mt-0.5">Click "New Greeting" to start</p>
            </div>
          ) : (
            greetingsList.map((greeting, index) => (
              <GreetingListItem
                key={index}
                greeting={greeting}
                index={index}
                tokenCount={index === safeSelectedIndex ? selectedGreetingTokenCount : null}
                isSelected={index === safeSelectedIndex}
                onSelect={() => handleSelectGreeting(index)}
                onDelete={() => handleDeleteGreeting(index)}
              />
            ))
          )}
        </div>

        {/* Add Button at Bottom */}
        <div className="shrink-0 p-3 border-t border-vault-200 dark:border-vault-700">
          <button
            onClick={handleAddGreeting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-vault-300 dark:border-vault-600
              text-vault-600 dark:text-vault-400 hover:text-vault-800 dark:hover:text-vault-200
              hover:border-vault-400 dark:hover:border-vault-500 hover:bg-vault-50 dark:hover:bg-vault-700/30
              rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Greeting
          </button>
        </div>
      </div>

      {/* Right Detail Panel */}
      <div className={`
        flex-1 min-h-0 overflow-hidden bg-white dark:bg-vault-900
        ${!isMobileViewOpen ? 'hidden md:flex md:flex-col' : 'flex flex-col'}
      `}>
        {selectedGreeting !== undefined ? (
          <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-[max(env(safe-area-inset-bottom),0px)]">
            {/* Mobile Back Button */}
            <button
              onClick={handleBackToList}
              className="md:hidden mb-4 shrink-0 flex items-center gap-1 text-sm text-vault-600 dark:text-vault-400 hover:text-vault-800 dark:hover:text-vault-200"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to greetings
            </button>
            <GreetingDetail
              greeting={selectedGreeting}
              onPersistUpdate={(value) => handleGreetingPersistUpdate(safeSelectedIndex, value)}
              aiConfig={aiConfig}
              samplerSettings={samplerSettings}
              promptSettings={promptSettings}
              getContextContent={getContextContent}
              contextSectionIds={contextSectionIds}
              setSelectedText={setSelectedText}
              fontSize={fontSize}
              onFontSizeChange={onFontSizeChange}
              spellcheck={spellcheck}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-vault-400 dark:text-vault-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select a greeting to edit</p>
              <p className="text-xs mt-1">Or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GreetingsEditor;
