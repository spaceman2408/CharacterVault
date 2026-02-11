/**
 * @fileoverview Greetings Editor component with toolbar for managing multiple greetings.
 * @module components/editor/GreetingsEditor
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { SamplerSettings, AIConfig, PromptSettings } from '../../db/types';
import type { CharacterSection } from '../../db/characterTypes';
import { useAIEditor } from '../../hooks';

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
}

interface GreetingCardProps {
  greeting: string;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: (value: string) => void;
  onDelete: () => void;
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getContextContent: (sectionIds: CharacterSection[]) => string[];
  contextSectionIds: CharacterSection[];
  setSelectedText: (text: string) => void;
}

/**
 * Individual greeting card with CodeMirror editor
 */
function GreetingCard({
  greeting,
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
}: GreetingCardProps): React.ReactElement {
  // Use the shared AI editor hook
  const { editorRef } = useAIEditor({
    value: greeting,
    onChange: onUpdate,
    setSelectedText,
    aiConfig,
    samplerSettings,
    promptSettings,
    getContextContent,
    contextSectionIds,
    minHeight: 'clamp(84px, 18vh, 140px)',
    maxHeight: 'clamp(180px, 36vh, 300px)',
    isActive: isOpen,
  });

  return (
    <div className="border border-vault-200 dark:border-vault-700 rounded-lg overflow-hidden bg-white dark:bg-vault-800">
      <div className="flex items-center justify-between px-4 py-3 bg-vault-50 dark:bg-vault-700/50 border-b border-vault-200 dark:border-vault-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-vault-700 dark:text-vault-300">
            Greeting {index + 1}
          </span>
          <span className="text-xs text-vault-500 dark:text-vault-400">
            ({greeting.length} chars)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className="p-1 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-200 dark:hover:bg-vault-700 rounded transition-colors"
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
            className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete greeting"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {isOpen && (
        <div ref={editorRef} className="min-h-[clamp(84px,18vh,140px)]" />
      )}
      {!isOpen && (
        <div className="px-4 py-3 text-sm text-vault-600 dark:text-vault-400 italic truncate">
          {greeting || <span className="text-vault-400">Empty greeting</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Greetings Editor with toolbar for managing multiple greetings
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
}: GreetingsEditorProps): React.ReactElement {
  const [greetingsList, setGreetingsList] = useState<string[]>(greetings);
  const [openCards, setOpenCards] = useState<Set<number>>(new Set([0]));

  // Sync with props
  useEffect(() => {
    setGreetingsList(greetings);
  }, [greetings]);

  // Handle greeting update
  const handleGreetingUpdate = useCallback((index: number, value: string) => {
    const newList = [...greetingsList];
    newList[index] = value;
    setGreetingsList(newList);
    onChange(newList);
  }, [greetingsList, onChange]);

  // Handle add greeting
  const handleAddGreeting = useCallback(() => {
    const newList = [...greetingsList, ''];
    const newOpenCards = new Set(openCards);
    newOpenCards.add(newList.length - 1);
    setGreetingsList(newList);
    setOpenCards(newOpenCards);
    onChange(newList);
  }, [greetingsList, openCards, onChange]);

  // Handle delete greeting
  const handleDeleteGreeting = useCallback((index: number) => {
    const newList = greetingsList.filter((_, i) => i !== index);
    const newOpenCards = new Set(openCards);
    newOpenCards.delete(index);
    // Adjust open card indices
    const adjustedOpenCards = new Set<number>();
    newOpenCards.forEach(i => {
      if (i > index) {
        adjustedOpenCards.add(i - 1);
      } else {
        adjustedOpenCards.add(i);
      }
    });
    setGreetingsList(newList);
    setOpenCards(adjustedOpenCards);
    onChange(newList);
  }, [greetingsList, openCards, onChange]);

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

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-vault-900 dark:text-vault-50">
            Greetings
          </h2>
          <p className="text-sm text-vault-500 dark:text-vault-400">
            Alternate greetings for your character ({greetingsList.length} total)
          </p>
        </div>
        <button
          onClick={handleAddGreeting}
          className="flex items-center gap-2 px-4 py-2 bg-vault-600 hover:bg-vault-700 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Greeting
        </button>
      </div>

      {/* Greetings List */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {greetingsList.length === 0 ? (
          <div className="text-center py-12 text-vault-400 dark:text-vault-500">
            <p className="text-sm">No alternate greetings yet</p>
            <p className="text-xs mt-1">Click "Add Greeting" to create one</p>
          </div>
        ) : (
          greetingsList.map((greeting, index) => (
            <GreetingCard
              key={index}
              greeting={greeting}
              index={index}
              isOpen={openCards.has(index)}
              onToggle={() => handleToggleCard(index)}
              onUpdate={(value) => handleGreetingUpdate(index, value)}
              onDelete={() => handleDeleteGreeting(index)}
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
    </div>
  );
}

export default GreetingsEditor;
