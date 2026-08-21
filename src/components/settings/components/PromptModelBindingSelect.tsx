/**
 * Endpoint + model picker for per-prompt AI routing.
 * Uses a bottom sheet / modal on all viewports so search is not clipped
 * by the settings panel scroll area (especially on mobile).
 */

import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Brain,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
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
  heading?: string;
  bare?: boolean;
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
  'w-full min-h-11 px-3 py-2.5 border border-border-strong rounded-xl bg-surface text-fg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all';

export const PromptModelBindingSelect: React.FC<PromptModelBindingSelectProps> = ({
  binding,
  globalAi,
  modelsByBaseUrl,
  onChange,
  onFetch,
  isFetching,
  heading = 'Model for this prompt',
  bare = false,
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

  const optionClass = (selected: boolean) =>
    selected
      ? 'border-accent/40 bg-accent-soft text-accent shadow-sm'
      : 'border-border bg-surface text-fg hover:border-accent/40 hover:bg-accent-soft hover:text-accent active:scale-[0.99]';

  const modelPicker =
    isModelOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
        <button
          type="button"
          aria-label="Close model picker"
          className="absolute inset-0 bg-overlay backdrop-blur-sm animate-in fade-in"
          onClick={closeModelPicker}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-[201] w-full sm:max-w-md sm:mx-4 max-h-[min(85dvh,36rem)] flex flex-col bg-surface rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 sm:fade-in pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="relative flex items-center justify-between gap-3 px-4 pt-3 pb-2 sm:px-5 sm:pt-4 border-b border-border shrink-0 bg-surface/95 backdrop-blur-sm rounded-t-2xl">
            <div className="mx-auto sm:hidden w-10 h-1 rounded-full bg-border absolute left-1/2 -translate-x-1/2 top-2" />
            <div className="min-w-0 pt-2 sm:pt-0">
              <h3 id={titleId} className="text-base font-semibold text-fg truncate">
                Choose model
              </h3>
              <p className="text-xs text-fg-muted truncate mt-0.5">
                {endpointLabel(selectedEndpoint)}
                {models.length > 0
                  ? ` · ${models.length} model${models.length === 1 ? '' : 's'}`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={closeModelPicker}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 touch-manipulation"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-3 sm:px-4 py-3 border-b border-border shrink-0">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none group-focus-within:text-accent transition-colors" />
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
                className={`${fieldClass} pl-10 focus:border-accent/40`}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4">
            {filteredModels.length === 0 ? (
              <div className="px-2 py-10 text-sm text-fg-muted text-center space-y-1">
                <p className="font-medium text-fg">
                  {models.length === 0 ? 'No models loaded' : 'No matches'}
                </p>
                <p className="text-xs">
                  {models.length === 0
                    ? 'Use Fetch on the previous screen, or type a model ID there.'
                    : `Nothing matched “${searchTerm}”`}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredModels.map((model) => {
                  const selected = model.id === selectedModelId;
                  const nameDiffers = model.name !== model.id;
                  return (
                    <li key={model.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectModel(model.id)}
                        className={`w-full min-h-12 px-3.5 py-3 rounded-xl border text-left transition-all touch-manipulation ${optionClass(
                          selected
                        )}`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              selected
                                ? 'bg-accent/15 text-accent'
                                : 'bg-muted text-fg-muted'
                            }`}
                          >
                            <Brain className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-base sm:text-sm break-words">
                                {model.name}
                              </span>
                              {selected && (
                                <Check
                                  className="w-4 h-4 shrink-0 text-accent"
                                  aria-hidden
                                />
                              )}
                            </div>
                            {nameDiffers && (
                              <p
                                className={`text-xs mt-0.5 break-all ${
                                  selected ? 'text-accent/80' : 'text-fg-muted'
                                }`}
                              >
                                {model.id}
                              </p>
                            )}
                          </div>
                        </div>
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
    <div className={bare ? 'space-y-3' : 'mt-3 pt-3 border-t border-border space-y-3'}>
      <div className="flex items-center gap-2 text-xs font-semibold text-fg-muted uppercase tracking-wide">
        <Brain className="w-3.5 h-3.5 shrink-0" />
        {heading}
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
                className={`${fieldClass} flex-1 text-left flex items-center justify-between gap-2 hover:border-accent/40 hover:bg-accent-soft/40`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {selectedModelId ? (
                    <Brain className="w-4 h-4 shrink-0 text-accent" />
                  ) : null}
                  <span
                    className={`min-w-0 truncate ${
                      selectedModelId ? 'font-medium' : 'text-fg-subtle'
                    }`}
                  >
                    {selectedModel?.name || 'Select a model…'}
                  </span>
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
                className="min-h-11 px-4 py-2.5 bg-muted hover:bg-accent-soft hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed text-fg-muted rounded-xl transition-all flex items-center justify-center gap-2 text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 shrink-0 touch-manipulation"
              >
                {isFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
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
              Select or enter a model ID.
            </p>
          )}
        </div>
      )}

      {modelPicker}
    </div>
  );
};
