/**
 * @fileoverview Greetings Editor component with two-panel layout.
 * Left sidebar for greeting list, right panel for editor.
 * @module components/editor/GreetingsEditor
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Trash2, MessageSquare, ChevronLeft } from 'lucide-react';
import type {
  SamplerSettings,
  AIConfig,
  PromptSettings,
  PromptModelMap,
} from '../../db/characterTypes';
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
  promptModels?: PromptModelMap;
  getContextContent: (sectionIds: CharacterSection[]) => string[] | Promise<string[]>;
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
  promptModels?: PromptModelMap;
  getContextContent: (sectionIds: CharacterSection[]) => string[] | Promise<string[]>;
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
  const preview = greeting.replace(/\s+/g, ' ').trim();

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
      <div className="flex items-start gap-2.5">
        <div className="mt-1.5 shrink-0">
          {hasContent ? (
            <div className="h-2 w-2 rounded-full bg-success" title="Has content" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-fg-subtle" title="Empty" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-fg">
            Greeting {index + 1}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
            {tokenCount !== null ? <span>{tokenCount.toLocaleString()} tokens</span> : null}
            {!hasContent ? <span>Empty</span> : null}
          </div>
          {hasContent && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-fg-subtle">
              {preview}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 rounded-lg p-2 text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger touch-manipulation"
          title="Delete greeting"
          aria-label={`Delete greeting ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
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
  promptModels,
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

  const { editorRef, payloadPreviewModal } = useAIEditor({
    value: draftGreeting,
    onImmediateChange: setDraftGreeting,
    onPersistChange: onPersistUpdate,
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={editorRef}
        className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-bg shadow-inner"
        style={{ minHeight: '12rem' }}
      />
      {payloadPreviewModal}
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
  promptModels,
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
      {/* List panel: full height on mobile; fixed-width sidebar on desktop */}
      <div
        className={`
          flex min-h-0 w-full flex-col overflow-hidden border-border bg-muted/40
          md:w-72 md:shrink-0 md:border-r
          ${isMobileViewOpen ? 'hidden md:flex' : 'flex flex-1 md:flex-none'}
        `}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-fg-muted">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">Greetings</p>
              <p className="text-xs text-fg-muted">
                {greetingsList.length} greeting{greetingsList.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {greetingsList.length === 0 ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 py-10 text-center text-fg-subtle">
              <MessageSquare className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm font-medium text-fg-muted">No greetings yet</p>
              <p className="mt-1 text-xs">Add one to give your character alternate first messages.</p>
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

        <div className="shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleAddGreeting}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-3 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:border-accent/50 hover:bg-accent-soft hover:text-accent touch-manipulation"
          >
            <Plus className="h-4 w-4" />
            New Greeting
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
        {selectedGreeting !== undefined ? (
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
                <p className="text-sm font-semibold text-fg">Greeting {safeSelectedIndex + 1}</p>
                {selectedGreetingTokenCount !== null && (
                  <p className="text-xs text-fg-muted">
                    {selectedGreetingTokenCount.toLocaleString()} tokens
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteGreeting(safeSelectedIndex)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger touch-manipulation"
                title="Delete greeting"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sm:inline">Delete</span>
              </button>
            </div>
            <GreetingDetail
              greeting={selectedGreeting}
              onPersistUpdate={(value) => handleGreetingPersistUpdate(safeSelectedIndex, value)}
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
              <MessageSquare className="mx-auto mb-3 h-12 w-12 opacity-40" />
              <p className="text-sm font-medium text-fg-muted">Select a greeting to edit</p>
              <p className="mt-1 text-xs">Or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GreetingsEditor;
