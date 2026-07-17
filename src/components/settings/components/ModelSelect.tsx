/**
 * @fileoverview Searchable AI model selector for settings.
 * Uses a bottom sheet / modal so search is usable on mobile and not clipped
 * by the settings panel scroll area.
 * @module components/settings/components/ModelSelect
 */

import React, { useCallback, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Brain, ChevronDown, Loader2, RefreshCw, Search, X } from 'lucide-react';
import type { AIModelInfo } from '../../../db/characterTypes';
import { useFocusOnOpen, useModalSheet } from '../hooks/useModalSheet';

interface ModelSelectProps {
  models: AIModelInfo[];
  selectedModelId: string;
  onSelect: (modelId: string) => void;
  onFetch: () => void;
  isFetching: boolean;
  disabled?: boolean;
}

/** Prefer 16px text on mobile so iOS does not zoom on focus. */
const fieldClass =
  'w-full min-h-11 px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/50';

export const ModelSelect: React.FC<ModelSelectProps> = ({
  models,
  selectedModelId,
  onSelect,
  onFetch,
  isFetching,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const closePicker = useCallback(() => {
    setIsOpen(false);
    setSearchTerm('');
  }, []);

  useModalSheet(isOpen, closePicker);
  useFocusOnOpen(isOpen, searchInputRef);

  const selectedModel =
    models.find((m) => m.id === selectedModelId) ??
    (selectedModelId ? { id: selectedModelId, name: selectedModelId } : undefined);

  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (modelId: string) => {
    onSelect(modelId);
    closePicker();
  };

  const modelPicker =
    isOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
        <button
          type="button"
          aria-label="Close model picker"
          className="absolute inset-0 bg-overlay backdrop-blur-[1px]"
          onClick={closePicker}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-[201] w-full sm:max-w-md sm:mx-4 max-h-[min(85dvh,36rem)] flex flex-col bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl ring-1 ring-border pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 sm:px-5 sm:pt-4 border-b border-border shrink-0">
            <div className="min-w-0">
              <div className="mx-auto sm:hidden w-10 h-1 rounded-full bg-fg-subtle mb-3" />
              <h3
                id={titleId}
                className="text-base font-semibold text-fg truncate"
              >
                Choose model
              </h3>
              <p className="text-xs text-fg-muted mt-0.5">
                {models.length > 0
                  ? `${models.length} model${models.length === 1 ? '' : 's'} available`
                  : 'Fetch models if the list is empty'}
              </p>
            </div>
            <button
              type="button"
              onClick={closePicker}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 sm:px-5 py-3 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredModels.length > 0) {
                    e.preventDefault();
                    handleSelect(filteredModels[0].id);
                  }
                }}
                placeholder="Search models…"
                className={`${fieldClass} pl-10`}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {filteredModels.length === 0 ? (
              <div className="px-4 py-8 text-sm text-fg-muted text-center">
                {models.length === 0
                  ? 'No models loaded. Tap Fetch models, then try again.'
                  : `No match for “${searchTerm}”`}
              </div>
            ) : (
              <ul className="py-1">
                {filteredModels.map((model) => {
                  const selected = model.id === selectedModelId;
                  return (
                    <li key={model.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(model.id)}
                        className={`w-full min-h-12 px-4 sm:px-5 py-3 text-left transition-colors active:bg-hover ${
                          selected
                            ? 'bg-muted text-fg'
                            : 'text-fg-muted'
                        }`}
                      >
                        <div className="font-medium text-base sm:text-sm break-words">
                          {model.name}
                        </div>
                        <div className="text-xs text-fg-muted mt-0.5 break-all">{model.id}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-fg">
        <span className="p-1.5 rounded-md bg-muted text-fg-muted">
          <Brain className="w-4 h-4" />
        </span>
        Model
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          className={`${fieldClass} flex-1 text-left flex items-center justify-between gap-2 ${
            disabled
              ? 'bg-muted text-fg-subtle cursor-not-allowed border-border'
              : 'hover:border-border-strong'
          }`}
        >
          <span
            className={`min-w-0 truncate ${
              selectedModelId ? 'font-medium' : 'text-fg-subtle'
            }`}
          >
            {selectedModel?.name || 'Select a model…'}
          </span>
          <ChevronDown className="w-4 h-4 text-fg-subtle shrink-0" />
        </button>

        <button
          type="button"
          onClick={onFetch}
          disabled={isFetching || disabled}
          className="min-h-11 px-4 py-2.5 bg-muted hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed text-fg-muted rounded-lg transition-all flex items-center justify-center gap-2 text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 shrink-0"
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Fetch models
        </button>
      </div>
      {modelPicker}
    </div>
  );
};
