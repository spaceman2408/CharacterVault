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
  onOpenSettings: () => void;
}

const WORD_COUNT_MIN = 3;

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
  onOpenSettings,
}) => {
  const trimmed = concept.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const hasMinimumWords = wordCount >= WORD_COUNT_MIN;
  const canGenerate = isConfigured && hasMinimumWords && !isGenerating;

  return (
    <div className="space-y-5">
      {/* Write / Tags tab toggle */}
      <div className="flex p-1 bg-vault-100 dark:bg-vault-800/60 rounded-xl">
        <button
          onClick={() => onInputModeChange('write')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
            inputMode === 'write'
              ? 'bg-white dark:bg-vault-700 text-vault-900 dark:text-vault-100 shadow-sm'
              : 'text-vault-500 dark:text-vault-400 hover:text-vault-700 dark:hover:text-vault-200'
          }`}
        >
          <PenLine className="w-4 h-4" />
          Write
        </button>
        <button
          onClick={() => onInputModeChange('tags')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
            inputMode === 'tags'
              ? 'bg-white dark:bg-vault-700 text-vault-900 dark:text-vault-100 shadow-sm'
              : 'text-vault-500 dark:text-vault-400 hover:text-vault-700 dark:hover:text-vault-200'
          }`}
        >
          <Tag className="w-4 h-4" />
          Tags
        </button>
      </div>

      {inputMode === 'write' ? (
        <>
          {/* Header */}
          <div className="text-center sm:text-left">
            <h2 className="text-lg font-bold text-vault-900 dark:text-vault-100">
              What character do you want to create?
            </h2>
            <p className="text-sm text-vault-500 dark:text-vault-400 mt-1">
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
              className="w-full h-36 p-4 bg-vault-50 dark:bg-vault-950/50 border border-vault-200 dark:border-vault-800 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-vault-500/50 dark:focus:ring-vault-400/50 focus:bg-white dark:focus:bg-vault-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-vault-400 dark:placeholder:text-vault-600"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              {isConfigured && (
                <span
                  className={`text-xs font-medium tabular-nums ${
                    hasMinimumWords
                      ? 'text-vault-400 dark:text-vault-500'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
              )}
            </div>
          </div>

          {/* Not Configured State */}
          {!isConfigured && (
            <div className="flex flex-col items-center text-center gap-3 p-5 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/40 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  AI Provider Not Configured
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Configure your AI provider and choose a model to start generating characters.
                </p>
              </div>
              <button
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-800/40 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-lg transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                Configure AI
              </button>
            </div>
          )}

          {/* API call cost notice */}
          <p className="text-xs text-vault-400 dark:text-vault-500 text-center">
            Generation uses a minimum of 4 API calls. At least one per field.
          </p>

          {/* Action Bar */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onGenerate}
              disabled={!canGenerate}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-vault-900 dark:bg-vault-50 text-white dark:text-vault-900 font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
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
                className="flex items-center gap-2 px-4 py-2.5 border border-vault-300 dark:border-vault-700 text-vault-700 dark:text-vault-300 font-medium rounded-xl hover:bg-vault-50 dark:hover:bg-vault-900 active:scale-[0.98] transition-all"
              >
                <X className="w-4 h-4" />
                Stop
              </button>
            )}
          </div>

          {/* Subtle hint when configured but too short */}
          {isConfigured && !isGenerating && trimmed && !hasMinimumWords && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              Add a few more words to help the AI understand your concept.
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
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  );
};
