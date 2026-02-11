/**
 * @fileoverview Section Editor component with CodeMirror and AI integration.
 * Uses fixed AI toolbar panel in CodeMirror - no floating elements.
 * @module components/editor/SectionEditor
 */

import React, { useCallback } from 'react';
import { useCharacterEditorContext } from '../../context';
import type { CharacterSection } from '../../db/characterTypes';
import { CHARACTER_SECTIONS } from '../../db/characterTypes';
import { GreetingsEditor } from './GreetingsEditor';
import { LorebookEditor } from './LorebookEditor';
import { useAIEditor } from '../../hooks';

interface SectionEditorProps {
  section: CharacterSection;
}

/**
 * Get value from character spec based on section
 */
function getSectionValue(character: { data: { spec: { name: string; description: string; personality: string; scenario: string; first_mes: string; mes_example: string; system_prompt: string; post_history_instructions: string; alternate_greetings: string[]; physical_description: string; avatar?: string; creator_notes?: string; creator?: string; character_version?: string; tags?: string[]; }; extensions?: Record<string, unknown> } }, section: CharacterSection): string {
  const spec = character.data.spec;
  switch (section) {
    case 'name':
      return String(spec.name || '');
    case 'description':
      return String(spec.description || '');
    case 'personality':
      return String(spec.personality || '');
    case 'scenario':
      return String(spec.scenario || '');
    case 'first_mes':
      return String(spec.first_mes || '');
    case 'mes_example':
      return String(spec.mes_example || '');
    case 'system_prompt':
      return String(spec.system_prompt || '');
    case 'post_history_instructions':
      return String(spec.post_history_instructions || '');
    case 'alternate_greetings':
      return Array.isArray(spec.alternate_greetings) ? spec.alternate_greetings.join('\n---\n') : '';
    case 'physical_description':
      return String(spec.physical_description || '');
    case 'extensions':
      return JSON.stringify(character.data.extensions || {}, null, 2);
    // V3 spec fields
    case 'avatar':
      return String(spec.avatar || '');
    case 'creator_notes':
      return String(spec.creator_notes || '');
    case 'creator':
      return String(spec.creator || '');
    case 'character_version':
      return String(spec.character_version || '');
    case 'tags':
      return Array.isArray(spec.tags) ? spec.tags.join(', ') : '';
    default:
      return '';
  }
}

/**
 * Section Editor with CodeMirror and AI integration
 * Uses fixed AI toolbar panel at top of editor - no floating elements, no drag needed
 */
export function SectionEditor({ section }: SectionEditorProps): React.ReactElement {
  const {
    currentCharacter,
    updateCharacter,
    updateSpecField,
    setSelectedText,
    contextSectionIds,
    aiConfig,
    samplerSettings,
    promptSettings,
    getContextContent,
    activeSection,
  } = useCharacterEditorContext();

  // Get current value based on section
  const currentValue = React.useMemo(() => {
    if (!currentCharacter) return '';
    return getSectionValue(currentCharacter, section);
  }, [currentCharacter, section]);

  // Handle value change
  const handleChange = useCallback((value: string) => {
    if (section === 'image' || section === 'extensions' || section === 'lorebook') return;

    if (section === 'alternate_greetings') {
      void updateSpecField(section, value.split('\n---\n').filter(g => g.trim()));
    } else if (section === 'tags') {
      // Convert comma-separated string to array, trim whitespace
      void updateSpecField(section, value.split(',').map(t => t.trim()).filter(t => t));
    } else {
      void updateSpecField(section, value);
    }
  }, [section, updateSpecField]);

  // Use the shared AI editor hook
  // Key forces re-initialization when section changes to prevent value mixing
  const { editorRef } = useAIEditor({
    key: section,
    value: currentValue,
    onChange: handleChange,
    setSelectedText,
    aiConfig,
    samplerSettings,
    promptSettings,
    getContextContent,
    contextSectionIds,
    minHeight: 'clamp(180px, 40vh, 400px)',
    editorStyles: { padding: 'clamp(8px, 2vw, 16px)' },
    isActive: section !== 'image' && section !== 'alternate_greetings' && section !== 'lorebook' && !!currentCharacter,
  });

  // Early return for no character
  if (!currentCharacter) {
    return <div>No character selected</div>;
  }

  const sectionMeta = CHARACTER_SECTIONS.find(s => s.id === section);

  // Handle image section specially
  if (section === 'image') {
    return (
      <div className="h-full flex items-center justify-center text-vault-500 animate-fade-in-slow">
        <p>Use the Image section in the left sidebar to upload a character image.</p>
      </div>
    );
  }

  // Handle extensions section specially
  if (section === 'extensions') {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden animate-fade-in-slow">
        <div className="mb-4 shrink-0">
          <h2 className="text-xl font-bold text-vault-900 dark:text-vault-50">
            {sectionMeta?.label}
          </h2>
          <p className="text-sm text-vault-500 dark:text-vault-400">
            Extension data (JSON format)
          </p>
        </div>
        <div
          ref={editorRef}
          className="flex-1 min-h-0 border border-vault-200 dark:border-vault-700 rounded-xl overflow-hidden"
        />
      </div>
    );
  }

  // Handle alternate_greetings section specially
  if (section === 'alternate_greetings') {
    return (
      <div className="h-full animate-fade-in-slow">
        <GreetingsEditor
          greetings={currentCharacter?.data?.spec?.alternate_greetings || []}
          onChange={(greetings) => void updateSpecField(section, greetings)}
          selectedText={''}
          setSelectedText={setSelectedText}
          contextSectionIds={contextSectionIds}
          aiConfig={aiConfig}
          samplerSettings={samplerSettings}
          promptSettings={promptSettings}
          getContextContent={getContextContent}
          activeSection={activeSection}
        />
      </div>
    );
  }

  // Handle lorebook section specially
  if (section === 'lorebook') {
    return (
      <div className="h-full animate-fade-in-slow">
        <LorebookEditor
          lorebook={currentCharacter?.data?.characterBook}
          onChange={(lorebook) => {
            void updateCharacter({
              data: {
                ...currentCharacter.data,
                characterBook: lorebook,
              },
            });
          }}
          setSelectedText={setSelectedText}
          contextSectionIds={contextSectionIds}
          aiConfig={aiConfig}
          samplerSettings={samplerSettings}
          promptSettings={promptSettings}
          getContextContent={getContextContent}
          activeSection={activeSection}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden animate-fade-in-slow">
      <div className="mb-4 shrink-0">
        <h2 className="text-xl font-bold text-vault-900 dark:text-vault-50">
          {sectionMeta?.label}
        </h2>
        <p className="text-sm text-vault-500 dark:text-vault-400">
          {sectionMeta?.description}
        </p>
      </div>

      <div
        ref={editorRef}
        className="flex-1 min-h-0 border border-vault-200 dark:border-vault-700 rounded-xl overflow-hidden"
      />
    </div>
  );
}

export default SectionEditor;
