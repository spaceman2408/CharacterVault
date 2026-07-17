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
      <h3 className="text-sm font-semibold text-fg-muted mb-3">
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
                ? 'bg-accent-soft border-accent'
                : isFailed
                ? 'bg-danger-soft border-danger/30'
                : isDone
                ? 'bg-success-soft border-success/30'
                : 'bg-surface border-border'
            }`}
          >
            <div className="shrink-0">
              {isDone && !isFailed ? (
                <Check className="w-5 h-5 text-success" />
              ) : isActive && !hasError ? (
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              ) : isFailed ? (
                <AlertCircle className="w-5 h-5 text-danger" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-border-strong" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span
                className={`text-sm font-medium ${
                  isActive
                    ? 'text-accent'
                    : isFailed
                    ? 'text-danger-soft-fg'
                    : isDone
                    ? 'text-success'
                    : 'text-fg-muted'
                }`}
              >
                {field.label}
              </span>
              {isActive && (
                <p className="text-xs text-accent/80 mt-0.5">
                  Generating...
                </p>
              )}
              {isFailed && (
                <p className="text-xs text-danger mt-0.5">
                  {error}
                </p>
              )}
            </div>

            {isFailed && (
              <button
                onClick={() => onGenerateField(field.key)}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium text-fg-muted hover:bg-hover rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium text-success hover:bg-success-soft rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
