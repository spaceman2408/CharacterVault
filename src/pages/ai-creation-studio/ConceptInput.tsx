/**
 * @fileoverview Concept input component for AI Creation Studio
 * @module @pages/ai-creation-studio/ConceptInput
 */

import React from 'react';
import { Sparkles, AlertCircle, Settings2, Loader2, X } from 'lucide-react';

interface ConceptInputProps {
  concept: string;
  onConceptChange: (value: string) => void;
  onGenerate: () => void;
  onAbort: () => void;
  isConfigured: boolean;
  isGenerating: boolean;
  onOpenSettings: () => void;
}

export const ConceptInput: React.FC<ConceptInputProps> = ({
  concept,
  onConceptChange,
  onGenerate,
  onAbort,
  isConfigured,
  isGenerating,
  onOpenSettings,
}) => {
  const canGenerate = isConfigured && concept.trim().length > 0 && !isGenerating;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-vault-800 dark:text-vault-200 mb-2">
          Character Concept
        </label>
        <p className="text-xs text-vault-500 dark:text-vault-400 mb-3">
          Describe your character idea. The AI will generate Name, Description, First Message, and Examples.
        </p>
        <textarea
          value={concept}
          onChange={(e) => onConceptChange(e.target.value)}
          placeholder="E.g., A cynical dwarven blacksmith with a secret past, living in a mountain fortress..."
          disabled={isGenerating}
          className="w-full h-32 p-4 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-vault-500 dark:focus:ring-vault-400 disabled:opacity-60 transition-all"
        />
      </div>

      {!isConfigured && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              AI is not configured. Set up your API key and model to generate characters.
            </p>
            <button
              onClick={onOpenSettings}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-lg transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Configure AI
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-vault-900 dark:bg-vault-50 text-white dark:text-vault-900 font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
        {isGenerating && (
          <button
            onClick={onAbort}
            className="flex items-center gap-2 px-4 py-2.5 border border-vault-300 dark:border-vault-700 text-vault-700 dark:text-vault-300 font-medium rounded-xl hover:bg-vault-50 dark:hover:bg-vault-900 transition-colors"
          >
            <X className="w-4 h-4" />
            Stop
          </button>
        )}
      </div>
    </div>
  );
};
