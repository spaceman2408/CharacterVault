/**
 * @fileoverview Generation progress component for AI Creation Studio
 * @module @pages/ai-creation-studio/GenerationProgress
 */

import React from 'react';
import { Loader2, Check, AlertCircle, RotateCcw, Sparkles, RefreshCw } from 'lucide-react';
import type { GenerationField, GenerationState } from './types';
import { GENERATION_FIELDS } from './types';

interface GenerationProgressProps {
  state: GenerationState;
  isLoading: boolean;
  onGenerateField: (field: GenerationField) => void;
  onRegenerateField: (field: GenerationField) => void;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  state,
  isLoading,
  onGenerateField,
  onRegenerateField,
}) => {
  const { status, currentField, completedFields, error, failedField } = state;

  const hasError = status === 'error';

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-vault-700 dark:text-vault-300 mb-3">
        Generation Progress
      </h3>

      {GENERATION_FIELDS.map((field) => {
        const isDone = completedFields.includes(field.key);
        const isActive = currentField === field.key;
        const isFailed = failedField === field.key;
        const isPending = !isDone && !isActive && !isFailed;

        return (
          <div
            key={field.key}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              isActive
                ? 'bg-vault-50 dark:bg-vault-800/50 border-vault-300 dark:border-vault-600'
                : isFailed
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : isDone
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-white dark:bg-vault-900 border-vault-200 dark:border-vault-800'
            }`}
          >
            <div className="shrink-0">
              {isDone && !isFailed ? (
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : isActive && !hasError ? (
                <Loader2 className="w-5 h-5 text-vault-600 dark:text-vault-400 animate-spin" />
              ) : isFailed ? (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-vault-300 dark:border-vault-600" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span
                className={`text-sm font-medium ${
                  isActive
                    ? 'text-vault-900 dark:text-vault-100'
                    : isFailed
                    ? 'text-red-700 dark:text-red-300'
                    : isDone
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-vault-500 dark:text-vault-400'
                }`}
              >
                {field.label}
              </span>
              {isActive && (
                <p className="text-xs text-vault-500 dark:text-vault-400 mt-0.5">
                  Generating...
                </p>
              )}
              {isFailed && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  {error}
                </p>
              )}
            </div>

            {isFailed && (
              <button
                onClick={() => onGenerateField(field.key)}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium text-vault-600 dark:text-vault-400 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Retry this field"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}

            {isDone && !isFailed && (
              <button
                onClick={() => onRegenerateField(field.key)}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Regenerate this field"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            )}

            {isPending && (
              <button
                onClick={() => onGenerateField(field.key)}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium text-vault-500 dark:text-vault-400 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Generate this field"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
