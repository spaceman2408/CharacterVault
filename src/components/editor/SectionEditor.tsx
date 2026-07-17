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
import { CreatorNotesPreviewModal } from './CreatorNotesPreviewModal';
import { CreatorNotesPreviewPane } from './CreatorNotesPreviewPane';
import { useAIEditor } from '../../hooks';
import { creatorNotesExtensions } from '../../editor/extensions';
import { json } from '@codemirror/lang-json';
import type { Extension } from '@codemirror/state';

interface SectionEditorProps {
  section: CharacterSection;
}

interface MinimalSectionHeaderProps {
  label?: string;
  description?: string;
}

interface NameFieldEditorProps extends MinimalSectionHeaderProps {
  value: string;
  onChange: (value: string) => void;
}

interface TagsFieldEditorProps extends MinimalSectionHeaderProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

function MinimalSectionHeader({ label, description }: MinimalSectionHeaderProps): React.ReactElement {
  return (
    <div className="mb-4 shrink-0">
      <h2 className="text-xl font-bold text-fg">
        {label}
      </h2>
      {description && (
        <p className="text-sm text-fg-muted">
          {description}
        </p>
      )}
    </div>
  );
}

function NameFieldEditor({ value, onChange, label, description }: NameFieldEditorProps): React.ReactElement {
  const [draftName, setDraftName] = React.useState(value);

  React.useEffect(() => {
    setDraftName(value);
  }, [value]);

  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDraftName(nextValue);
    onChange(nextValue);
  }, [onChange]);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden animate-fade-in-slow">
      <MinimalSectionHeader label={label} description={description} />
      <input
        type="text"
        value={draftName}
        onChange={handleChange}
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-fg outline-none transition-all placeholder:text-fg-subtle focus:border-vault-400 focus:ring-2 focus:ring-accent/20 border-border bg-surface text-fg placeholder:text-fg-subtle focus:border-border-strong focus:ring-accent/20"
        placeholder="Character name"
      />
    </div>
  );
}

function splitTagInput(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function mergeTags(currentTags: string[], incomingTags: string[]): string[] {
  const seen = new Set(currentTags.map((tag) => tag.toLocaleLowerCase()));
  const next = [...currentTags];

  for (const tag of incomingTags) {
    const normalized = tag.toLocaleLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(tag);
  }

  return next;
}

function TagsFieldEditor({ tags, onChange, label, description }: TagsFieldEditorProps): React.ReactElement {
  const [currentTags, setCurrentTags] = React.useState(tags);
  const [draftTag, setDraftTag] = React.useState('');

  React.useEffect(() => {
    setCurrentTags(tags);
  }, [tags]);

  const persistTags = React.useCallback((nextTags: string[]) => {
    setCurrentTags(nextTags);
    onChange(nextTags);
  }, [onChange]);

  const addTags = React.useCallback((rawValue: string) => {
    const nextTags = mergeTags(currentTags, splitTagInput(rawValue));
    if (nextTags.length !== currentTags.length) {
      persistTags(nextTags);
    }
  }, [currentTags, persistTags]);

  const removeTag = React.useCallback((tagToRemove: string) => {
    persistTags(currentTags.filter((tag) => tag !== tagToRemove));
  }, [currentTags, persistTags]);

  const handleInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value.includes(',')) {
      addTags(value);
      setDraftTag('');
      return;
    }

    setDraftTag(value);
  }, [addTags]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTags(draftTag);
      setDraftTag('');
      return;
    }

    if (event.key === 'Backspace' && draftTag === '' && currentTags.length > 0) {
      event.preventDefault();
      persistTags(currentTags.slice(0, -1));
    }
  }, [addTags, currentTags, draftTag, persistTags]);

  const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = event.clipboardData.getData('text');
    if (!pastedText.includes(',')) return;

    event.preventDefault();
    addTags(pastedText);
    setDraftTag('');
  }, [addTags]);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden animate-fade-in-slow">
      <MinimalSectionHeader label={label} description={description} />
      <div className="flex min-h-28 flex-wrap content-start gap-2 rounded-xl border border-border bg-surface p-3 transition-all focus-within:border-border-strong focus-within:ring-2 focus-within:ring-accent/20">
        {currentTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-medium text-fg-muted bg-muted text-fg"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-sm text-fg-subtle transition-colors hover:text-danger focus:outline-none focus:ring-2 focus:ring-accent/30 text-fg0 hover:text-danger"
              aria-label={`Remove ${tag}`}
            >
              x
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draftTag}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="min-w-36 flex-1 bg-transparent px-1 py-1 text-sm text-fg outline-none placeholder:text-fg-subtle text-fg placeholder:text-fg-subtle"
          placeholder={currentTags.length === 0 ? 'Type a tag and press Enter' : 'Add tag'}
        />
      </div>
    </div>
  );
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
    promptModels,
    getContextContent,
    activeSection,
    fontSize,
    setFontSize,
    spellcheck,
  } = useCharacterEditorContext();
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isSplitPreviewOpen, setIsSplitPreviewOpen] = React.useState(false);

  // Get current value based on section
  const currentValue = React.useMemo(() => {
    if (!currentCharacter) return '';
    return getSectionValue(currentCharacter, section);
  }, [currentCharacter, section]);
  const [livePreviewValue, setLivePreviewValue] = React.useState(currentValue);

  React.useEffect(() => {
    setLivePreviewValue(currentValue);
  }, [currentValue]);

  React.useEffect(() => {
    if (section !== 'creator_notes') {
      setIsPreviewOpen(false);
      setIsSplitPreviewOpen(false);
    }
  }, [section]);

  // Handle value change
  const handlePersistChange = useCallback((value: string) => {
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

  const sectionExtensions = React.useMemo<Extension[] | undefined>(() => {
    if (section === 'creator_notes') return creatorNotesExtensions();
    if (section === 'extensions') return [json()];
    return undefined;
  }, [section]);

  const sectionSpellcheckMode: 'prose' | 'html' | 'json' =
    section === 'creator_notes' ? 'html'
    : section === 'extensions' ? 'json'
    : 'prose';

  // Use the shared AI editor hook
  // Key forces re-initialization when section changes to prevent value mixing
  const { editorRef } = useAIEditor({
    key: `${section}-${isSplitPreviewOpen ? 'split' : 'single'}`,
    value: currentValue,
    onImmediateChange: section === 'creator_notes' ? setLivePreviewValue : undefined,
    onPersistChange: handlePersistChange,
    setSelectedText,
    aiConfig,
    samplerSettings,
    promptSettings,
    promptModels,
    getContextContent,
    contextSectionIds,
    minHeight: 'clamp(180px, 40vh, 400px)',
    editorStyles: { padding: 'clamp(8px, 2vw, 16px)' },
    isActive: section !== 'image' && section !== 'name' && section !== 'creator' && section !== 'tags' && section !== 'alternate_greetings' && section !== 'lorebook' && !!currentCharacter,
    fontSize,
    onFontSizeChange: setFontSize,
    additionalExtensions: sectionExtensions,
    spellcheck,
    spellcheckMode: sectionSpellcheckMode,
  });

  // Early return for no character
  if (!currentCharacter) {
    return <div>No character selected</div>;
  }

  const sectionMeta = CHARACTER_SECTIONS.find(s => s.id === section);
  const isCreatorNotesSection = section === 'creator_notes';

  if (section === 'name') {
    return (
      <NameFieldEditor
        value={currentValue}
        onChange={(value) => void updateSpecField('name', value)}
        label={sectionMeta?.label}
        description={sectionMeta?.description}
      />
    );
  }

  if (section === 'creator') {
    return (
      <NameFieldEditor
        value={currentValue}
        onChange={(value) => void updateSpecField('creator', value)}
        label={sectionMeta?.label}
        description={sectionMeta?.description}
      />
    );
  }

  if (section === 'tags') {
    return (
      <TagsFieldEditor
        tags={currentCharacter.data.spec.tags ?? []}
        onChange={(tags) => void updateSpecField('tags', tags)}
        label={sectionMeta?.label}
        description={sectionMeta?.description}
      />
    );
  }

  // Handle image section specially
  if (section === 'image') {
    return (
      <div className="h-full flex items-center justify-center text-fg-muted animate-fade-in-slow">
        <p>Use the Image section in the left sidebar to upload a character image.</p>
      </div>
    );
  }

  // Handle extensions section specially
  if (section === 'extensions') {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden animate-fade-in-slow">
        <div className="mb-4 shrink-0">
          <h2 className="text-xl font-bold text-fg">
            {sectionMeta?.label}
          </h2>
          <p className="text-sm text-fg-muted">
            Extension data (JSON format)
          </p>
        </div>
        <div
          ref={editorRef}
          className="flex-1 min-h-0 border border-border rounded-xl overflow-hidden"
        />
      </div>
    );
  }

  // Handle alternate_greetings section specially
  if (section === 'alternate_greetings') {
    return (
      <div className="absolute inset-0 h-full w-full animate-fade-in-slow">
        <GreetingsEditor
          greetings={currentCharacter?.data?.spec?.alternate_greetings || []}
          onChange={(greetings) => void updateSpecField(section, greetings)}
          selectedText={''}
          setSelectedText={setSelectedText}
          contextSectionIds={contextSectionIds}
          aiConfig={aiConfig}
          samplerSettings={samplerSettings}
          promptSettings={promptSettings}
          promptModels={promptModels}
          getContextContent={getContextContent}
          activeSection={activeSection}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          spellcheck={spellcheck}
        />
      </div>
    );
  }

  // Handle lorebook section specially
  if (section === 'lorebook') {
    return (
      <div className="absolute inset-0 h-full w-full animate-fade-in-slow">
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
          onDelete={() => {
            void updateCharacter({
              data: {
                ...currentCharacter.data,
                characterBook: undefined,
              },
            });
          }}
          setSelectedText={setSelectedText}
          contextSectionIds={contextSectionIds}
          aiConfig={aiConfig}
          samplerSettings={samplerSettings}
          promptSettings={promptSettings}
          promptModels={promptModels}
          getContextContent={getContextContent}
          activeSection={activeSection}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          characterName={currentCharacter?.name}
          spellcheck={spellcheck}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden animate-fade-in-slow">
      <div className="mb-4 shrink-0 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-fg">
              {sectionMeta?.label}
            </h2>
            <p className="text-sm text-fg-muted">
              {sectionMeta?.description}
            </p>
          </div>

          {section === 'creator_notes' && (
            <button
              type="button"
              onClick={() => {
                if (isSplitPreviewOpen) {
                  setIsSplitPreviewOpen(false);
                  return;
                }
                setIsPreviewOpen(prev => !prev);
              }}
              className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                isPreviewOpen || isSplitPreviewOpen
                  ? 'border-accent bg-accent text-accent-fg hover:opacity-90'
                  : 'border-border bg-surface text-fg-muted hover:bg-accent-soft hover:text-accent'
              }`}
            >
              {isSplitPreviewOpen ? 'Stop Previewing CSS' : 'Preview CSS'}
            </button>
          )}
        </div>
      </div>

      {isCreatorNotesSection && isSplitPreviewOpen ? (
        <div className="flex flex-1 min-h-0 flex-col gap-4 lg:flex-row">
          <div
            ref={editorRef}
            className="min-h-0 border border-border rounded-xl overflow-hidden lg:w-1/2"
          />

          <div className="min-h-0 overflow-hidden rounded-xl border border-border bg-vault-800 shadow-inner border-border lg:w-1/2">
            <CreatorNotesPreviewPane
              content={livePreviewValue}
              frameClassName="block h-full w-full bg-vault-800"
              emptyClassName="flex h-[calc(100%-41px)] items-center justify-center px-5 py-6 text-center text-sm text-fg-subtle"
            />
          </div>
        </div>
      ) : (
        <div
          ref={editorRef}
          className="flex-1 min-h-0 border border-border rounded-xl overflow-hidden"
        />
      )}

      {section === 'creator_notes' && (
        <CreatorNotesPreviewModal
          content={livePreviewValue}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          onAddToEditor={() => {
            setIsSplitPreviewOpen(true);
            setIsPreviewOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default SectionEditor;
