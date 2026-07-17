/**
 * Endpoint + model picker for per-prompt AI routing.
 * Uses a bottom sheet / modal on all viewports so search is not clipped
 * by the settings panel scroll area (especially on mobile).
 */

import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Brain, ChevronDown, Loader2, RefreshCw, Search, X } from 'lucide-react';
import type { AIConfig, AIModelInfo, PromptModelBinding } from '../../../db/characterTypes';
import {
  AI_BASE_URL_PRESETS,
  getStoredApiKey,
  isPresetUrl,
  normalizeBaseUrl,
} from '../config/aiBaseUrlPresets';
import { useFocusOnOpen, useModalSheet } from '../hooks/useModalSheet';

const DEFAULT_ENDPOINT = '__default__';

interface PromptModelBindingSelectProps {
  binding: PromptModelBinding | undefined;
  globalAi: AIConfig;
  modelsByBaseUrl: Record<string, AIModelInfo[]>;
  onChange: (binding: PromptModelBinding | undefined) => void;
  onFetch: (baseUrl: string) => Promise<void>;
  isFetching: boolean;
}

function endpointLabel(baseUrl: string): string {
  const preset = AI_BASE_URL_PRESETS.find(
    (p) => normalizeBaseUrl(p.baseUrl) === normalizeBaseUrl(baseUrl)
  );
  if (preset) return preset.label;
  return baseUrl;
}

function isLocalEndpoint(baseUrl: string): boolean {
  const normalized = normalizeBaseUrl(baseUrl).toLowerCase();
  return (
    normalized.includes('127.0.0.1') ||
    normalized.includes('localhost') ||
    normalized.startsWith('http://192.168.') ||
    normalized.startsWith('http://10.')
  );
}

/** Prefer 16px text on mobile so iOS does not zoom on focus. */
const fieldClass =
  'w-full min-h-11 px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/50';

export const PromptModelBindingSelect: React.FC<PromptModelBindingSelectProps> = ({
  binding,
  globalAi,
  modelsByBaseUrl,
  onChange,
  onFetch,
  isFetching,
}) => {
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const selectedEndpoint = binding?.baseUrl
    ? normalizeBaseUrl(binding.baseUrl)
    : DEFAULT_ENDPOINT;

  const endpointOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: DEFAULT_ENDPOINT, label: 'Default (AI Config)' },
    ];

    for (const preset of AI_BASE_URL_PRESETS) {
      options.push({
        value: normalizeBaseUrl(preset.baseUrl),
        label: preset.label,
      });
    }

    const extraUrls = new Set<string>();
    for (const url of Object.keys(globalAi.apiKeysByBaseUrl ?? {})) {
      const normalized = normalizeBaseUrl(url);
      if (normalized && !isPresetUrl(normalized)) {
        extraUrls.add(normalized);
      }
    }
    const lastCustom = normalizeBaseUrl(globalAi.lastCustomBaseUrl ?? '');
    if (lastCustom && !isPresetUrl(lastCustom)) {
      extraUrls.add(lastCustom);
    }
    const active = normalizeBaseUrl(globalAi.baseUrl);
    if (active && !isPresetUrl(active)) {
      extraUrls.add(active);
    }

    for (const url of extraUrls) {
      options.push({ value: url, label: `Custom: ${url}` });
    }

    if (
      selectedEndpoint !== DEFAULT_ENDPOINT &&
      !options.some((o) => o.value === selectedEndpoint)
    ) {
      options.push({
        value: selectedEndpoint,
        label: `Saved: ${selectedEndpoint}`,
      });
    }

    return options;
  }, [globalAi, selectedEndpoint]);

  const models = useMemo(() => {
    if (selectedEndpoint === DEFAULT_ENDPOINT) return [];
    return modelsByBaseUrl[selectedEndpoint] ?? [];
  }, [modelsByBaseUrl, selectedEndpoint]);

  const selectedModelId = binding?.modelId ?? '';
  const selectedModel =
    models.find((m) => m.id === selectedModelId) ??
    (selectedModelId ? { id: selectedModelId, name: selectedModelId } : undefined);

  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasKeyForEndpoint =
    selectedEndpoint === DEFAULT_ENDPOINT ||
    isLocalEndpoint(selectedEndpoint) ||
    !!getStoredApiKey(globalAi.apiKeysByBaseUrl, selectedEndpoint) ||
    (normalizeBaseUrl(globalAi.baseUrl) === selectedEndpoint && !!globalAi.apiKey);

  const closeModelPicker = useCallback(() => {
    setIsModelOpen(false);
    setSearchTerm('');
  }, []);

  useModalSheet(isModelOpen, closeModelPicker);
  useFocusOnOpen(isModelOpen, searchInputRef);

  const handleEndpointChange = (value: string) => {
    if (value === DEFAULT_ENDPOINT) {
      onChange(undefined);
      closeModelPicker();
      return;
    }
    const baseUrl = normalizeBaseUrl(value);
    const remembered = globalAi.modelIdsByBaseUrl?.[baseUrl] ?? '';
    onChange({
      baseUrl,
      modelId: remembered || binding?.modelId || '',
    });
  };

  const handleSelectModel = (modelId: string) => {
    if (selectedEndpoint === DEFAULT_ENDPOINT) return;
    onChange({ baseUrl: selectedEndpoint, modelId });
    closeModelPicker();
  };

  const globalSummary =
    globalAi.modelId?.trim()
      ? `${endpointLabel(globalAi.baseUrl)} · ${globalAi.modelId}`
      : 'No global model selected';

  const modelPicker =
    isModelOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
        <button
          type="button"
          aria-label="Close model picker"
          className="absolute inset-0 bg-overlay backdrop-blur-[1px]"
          onClick={closeModelPicker}
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
              <p className="text-xs text-fg-muted truncate mt-0.5">
                {endpointLabel(selectedEndpoint)}
              </p>
            </div>
            <button
              type="button"
              onClick={closeModelPicker}
              className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-hover focus:outline-none focus:ring-2 focus:ring-accent/50"
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
                    handleSelectModel(filteredModels[0].id);
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
                  ? 'No models loaded. Use Fetch on the previous screen, or type a model ID there.'
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
                        onClick={() => handleSelectModel(model.id)}
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
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-fg-muted uppercase tracking-wide">
        <Brain className="w-3.5 h-3.5 shrink-0" />
        Model for this prompt
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-fg-muted">
          Endpoint
        </label>
        <select
          value={selectedEndpoint}
          onChange={(e) => handleEndpointChange(e.target.value)}
          className={fieldClass}
        >
          {endpointOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {selectedEndpoint === DEFAULT_ENDPOINT && (
          <p className="text-xs text-fg-muted break-words">
            Uses default: {globalSummary}
          </p>
        )}
      </div>

      {selectedEndpoint !== DEFAULT_ENDPOINT && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fg-muted">
              Model
            </label>
            {/* Stack on narrow screens so touch targets stay full-width */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setIsModelOpen(true)}
                className={`${fieldClass} flex-1 text-left flex items-center justify-between gap-2 hover:border-border-strong`}
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
                onClick={() => void onFetch(selectedEndpoint)}
                disabled={isFetching || !hasKeyForEndpoint}
                title={
                  !hasKeyForEndpoint
                    ? 'Add an API key for this endpoint on the AI Config tab'
                    : 'Fetch models for this endpoint'
                }
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
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fg-muted">
              Or type model ID
            </label>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={selectedModelId}
              onChange={(e) => {
                if (selectedEndpoint === DEFAULT_ENDPOINT) return;
                onChange({ baseUrl: selectedEndpoint, modelId: e.target.value });
              }}
              placeholder="e.g. gpt-oss-120b"
              className={fieldClass}
            />
          </div>

          {!hasKeyForEndpoint && (
            <p className="text-xs text-warning">
              Add an API key for this endpoint on the AI Config tab before using this mapping.
            </p>
          )}
          {hasKeyForEndpoint && !selectedModelId && (
            <p className="text-xs text-warning">
              Select or enter a model ID for this prompt.
            </p>
          )}
        </div>
      )}

      {modelPicker}
    </div>
  );
};
