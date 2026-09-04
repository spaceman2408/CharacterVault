/**
 * @fileoverview Concept input component for AI Creation Studio with Write/Tags toggle
 * @module @pages/ai-creation-studio/ConceptInput
 */

import React from 'react';
import {
  Sparkles,
  AlertCircle,
  Settings2,
  Loader2,
  X,
  PenLine,
  Tag,
} from 'lucide-react';
import { TagSelector } from './TagSelector';
import type { InputMode } from './types';
import type { TagCategory, TaggedRef } from './tags/tagData';
import {
  formatTag,
  getGenerationTags,
  hasRequiredGenerationTags,
  PERSPECTIVE_TAGS,
  TENSE_TAGS,
  toggleGenerationTagSelection,
} from './tags/tagData';

interface ConceptInputProps {
  /* Write mode state */
  concept: string;
  onConceptChange: (value: string) => void;
  /* Tag mode state */
  tagSelections: Record<string, string[]>;
  onTagSelectionsChange: (s: Record<string, string[]>) => void;
  onFeelingLucky: () => void;
  /* Shared */
  inputMode: InputMode;
  onInputModeChange: (mode: InputMode) => void;
  onGenerate: () => void;
  onAbort: () => void;
  isConfigured: boolean;
  isGenerating: boolean;
  minApiCalls?: number;
  onOpenSettings: () => void;
  categories: TagCategory[];
  allCategories: TagCategory[];
  hiddenCategoryCount: number;
  favorites: TaggedRef[];
  recent: TaggedRef[];
  onToggleFavorite: (category: string, tag: string) => void;
  onAddCustomTag: (categoryKey: string, raw: string) => Promise<{ ok: boolean; slug?: string; error?: string }>;
  onRemoveCustomTag: (categoryKey: string, tag: string) => void;
}

const WORD_COUNT_MIN = 3;

interface GenerationStyleSelectorProps {
  selections: Record<string, string[]>;
  onSelectionsChange: (s: Record<string, string[]>) => void;
  isGenerating: boolean;
}

const GenerationStyleSelector: React.FC<GenerationStyleSelectorProps> = ({
  selections,
  onSelectionsChange,
  isGenerating,
}) => {
  const generationSelections = selections.generation ?? [];
  const generationTags = getGenerationTags(selections);

  const toggleTag = (tag: string) => {
    onSelectionsChange({
      ...selections,
      generation: toggleGenerationTagSelection(generationSelections, tag),
    });
  };

  const renderTagButton = (tag: string) => {
    const isSelected = generationSelections.includes(tag);
    return (
      <button
        key={tag}
        type="button"
        onClick={() => toggleTag(tag)}
        disabled={isGenerating}
        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          isSelected
            ? 'bg-accent-soft text-accent border-accent ring-1 ring-accent'
            : 'border-border text-fg-muted hover:border-accent/40 hover:bg-accent-soft hover:text-accent'
        }`}
      >
        {formatTag(tag)}
      </button>
    );
  };

  return (
    <div className="space-y-3 p-4 bg-bg/50 border border-border rounded-xl">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Generation Style
        </span>
        <span className="font-bold px-1.5 py-0.5 rounded-full bg-warning-soft text-warning-soft-fg">
          Required
        </span>
      </div>

      <div className="space-y-2">
        <div>
          <p className="font-medium text-fg-muted mb-1.5">
            Perspective
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PERSPECTIVE_TAGS.map(renderTagButton)}
          </div>
        </div>
        <div>
          <p className="font-medium text-fg-muted mb-1.5">
            Tense
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TENSE_TAGS.map(renderTagButton)}
          </div>
        </div>
      </div>

      {(!generationTags.perspective || !generationTags.tense) && (
        <p className="text-xs text-warning">
          Choose one perspective and one tense before generating.
        </p>
      )}
    </div>
  );
};

export const ConceptInput: React.FC<ConceptInputProps> = ({
  concept,
  onConceptChange,
  tagSelections,
  onTagSelectionsChange,
  onFeelingLucky,
  inputMode,
  onInputModeChange,
  onGenerate,
  onAbort,
  isConfigured,
  isGenerating,
  minApiCalls = 4,
  onOpenSettings,
  categories,
  allCategories,
  hiddenCategoryCount,
  favorites,
  recent,
  onToggleFavorite,
  onAddCustomTag,
  onRemoveCustomTag,
}) => {
  const trimmed = concept.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const hasMinimumWords = wordCount >= WORD_COUNT_MIN;
  const hasGenerationTags = hasRequiredGenerationTags(tagSelections);
  const canGenerate = isConfigured && hasMinimumWords && hasGenerationTags && !isGenerating;

  return (
    <div className="space-y-5">
      {/* Write / Tags tab toggle */}
      <div className="flex p-1 bg-muted/60 rounded-xl">
        <button
          onClick={() => onInputModeChange('write')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
            inputMode === 'write'
              ? 'bg-surface text-accent shadow-sm ring-1 ring-accent/30'
              : 'text-fg-muted hover:text-fg hover:bg-accent-soft/50'
          }`}
        >
          <PenLine className="w-4 h-4" />
          Write
        </button>
        <button
          onClick={() => onInputModeChange('tags')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
            inputMode === 'tags'
              ? 'bg-surface text-accent shadow-sm ring-1 ring-accent/30'
              : 'text-fg-muted hover:text-fg hover:bg-accent-soft/50'
          }`}
        >
          <Tag className="w-4 h-4" />
          Tags
        </button>
      </div>

      {inputMode === 'write' ? (
        <>
          <GenerationStyleSelector
            selections={tagSelections}
            onSelectionsChange={onTagSelectionsChange}
            isGenerating={isGenerating}
          />

          {/* Header */}
          <div className="text-center sm:text-left">
            <h2 className="text-lg font-bold text-fg">
              What character do you want to create?
            </h2>
            <p className="text-sm text-fg-muted mt-1">
              Describe your idea and the AI will generate a complete character card.
            </p>
          </div>

          {/* Input Area */}
          <div className="relative">
            <textarea
              value={concept}
              onChange={(e) => onConceptChange(e.target.value)}
              placeholder="A cynical dwarven blacksmith with a secret past, living in a mountain fortress who speaks in riddles..."
              disabled={isGenerating}
              className="w-full h-36 p-4 bg-bg/50 border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-fg-subtle"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              {isConfigured && (
                <span
                  className={`text-xs font-medium tabular-nums ${
                    hasMinimumWords
                      ? 'text-fg-subtle'
                      : 'text-warning'
                  }`}
                >
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
              )}
            </div>
          </div>

          {/* Not Configured State */}
          {!isConfigured && (
            <div className="flex flex-col items-center text-center gap-3 p-5 bg-warning-soft/60 border border-warning/30 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-warning-soft flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-warning-soft-fg">
                  AI Provider Not Configured
                </p>
                <p className="text-xs text-warning-soft-fg mt-0.5">
                  Configure your AI provider and choose a model to start generating characters.
                </p>
              </div>
              <button
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-warning-soft-fg bg-warning-soft hover:opacity-90 rounded-lg transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                Configure AI
              </button>
            </div>
          )}

          {/* API call cost notice */}
          <p className="text-xs text-fg-subtle text-center">
            Generation uses a minimum of {minApiCalls} API call{minApiCalls === 1 ? '' : 's'}. At least one per field.
          </p>

          {/* Action Bar */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onGenerate}
              disabled={!canGenerate}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-accent text-accent-fg font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating ? 'Generating Character...' : 'Generate Character'}
            </button>
            {isGenerating && (
              <button
                onClick={onAbort}
                className="flex items-center gap-2 px-4 py-2.5 border border-border-strong text-fg-muted font-medium rounded-xl hover:bg-hover active:scale-[0.98] transition-all"
              >
                <X className="w-4 h-4" />
                Stop
              </button>
            )}
          </div>

          {/* Subtle hint when configured but too short */}
          {isConfigured && !isGenerating && trimmed && !hasMinimumWords && (
            <p className="text-xs text-warning text-center">
              Add a few more words to help the AI understand your concept.
            </p>
          )}

          {isConfigured && !isGenerating && hasMinimumWords && !hasGenerationTags && (
            <p className="text-xs text-warning text-center">
              Choose a generation style before creating the character.
            </p>
          )}
        </>
      ) : (
        <TagSelector
          selections={tagSelections}
          onSelectionsChange={onTagSelectionsChange}
          onFeelingLucky={onFeelingLucky}
          onGenerate={onGenerate}
          onAbort={onAbort}
          isGenerating={isGenerating}
          isConfigured={isConfigured}
          minApiCalls={minApiCalls}
          onOpenSettings={onOpenSettings}
          categories={categories}
          allCategories={allCategories}
          hiddenCategoryCount={hiddenCategoryCount}
          favorites={favorites}
          recent={recent}
          onToggleFavorite={onToggleFavorite}
          onAddCustomTag={onAddCustomTag}
          onRemoveCustomTag={onRemoveCustomTag}
        />
      )}
    </div>
  );
};
