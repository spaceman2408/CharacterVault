/**
 * @fileoverview Model list caching and fetch helpers for AI settings.
 * @module components/settings/hooks/useModelCatalog
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIConfig, AIModelInfo, SamplerSettings } from '../../../db/characterTypes';
import { AIService, AIError } from '../../../services/AIService';
import type { ModelProvider } from '../../../services/providers';
import {
  AI_BASE_URL_PRESETS,
  MODEL_CACHE_STALENESS_MS,
  getStoredApiKey,
  getStoredModelId,
  isPresetUrl,
  normalizeBaseUrl,
} from '../config/aiBaseUrlPresets';
import type { AddToast, SettingsDraft } from '../types';

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

interface CachedModels {
  models: AIModelInfo[];
  fetchedAt: number;
  subscriptionOnly: boolean;
}

export interface FetchModelsCallOptions {
  subscriptionOnly?: boolean;
}

interface UseModelCatalogOptions {
  isOpen: boolean;
  isLoading: boolean;
  draft: SettingsDraft;
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft>>;
  addToast: AddToast;
}

function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

export function useModelCatalog({
  isOpen,
  isLoading,
  draft,
  setDraft,
  addToast,
}: UseModelCatalogOptions) {
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelsByBaseUrl, setModelsByBaseUrl] = useState<Record<string, CachedModels>>({});
  const [modelFetchErrorByBaseUrl, setModelFetchErrorByBaseUrl] = useState<Record<string, string>>({});
  const [fetchingModelsByBaseUrl, setFetchingModelsByBaseUrl] = useState<Record<string, boolean>>(
    {}
  );
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [isFetchingProviders, setIsFetchingProviders] = useState(false);
  const [supportsProviderSelection, setSupportsProviderSelection] = useState(false);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const modelsByBaseUrlRef = useRef(modelsByBaseUrl);
  modelsByBaseUrlRef.current = modelsByBaseUrl;
  const fetchingModelsByBaseUrlRef = useRef(fetchingModelsByBaseUrl);
  fetchingModelsByBaseUrlRef.current = fetchingModelsByBaseUrl;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const catalogAbortRef = useRef<AbortController | null>(null);
  /** Skip setState after unmount when in-flight model/provider fetches complete */
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      catalogAbortRef.current?.abort();
      catalogAbortRef.current = null;
      setModelsByBaseUrl({});
      setFetchingModelsByBaseUrl({});
      setModelProviders([]);
      setSupportsProviderSelection(false);
      setIsFetchingModels(false);
      setIsFetchingProviders(false);
      setDraft((prev) =>
        prev.ai.availableModels?.length
          ? { ...prev, ai: { ...prev.ai, availableModels: [] } }
          : prev
      );
      return;
    }

    const controller = new AbortController();
    catalogAbortRef.current = controller;
    return () => {
      controller.abort();
      if (catalogAbortRef.current === controller) {
        catalogAbortRef.current = null;
      }
    };
  }, [isOpen, setDraft]);

  const isCacheStale = (normalizedUrl: string, subscriptionOnly: boolean): boolean => {
    const cached = modelsByBaseUrlRef.current[normalizedUrl];
    if (!cached) return true;
    if (cached.subscriptionOnly !== subscriptionOnly) return true;
    return Date.now() - cached.fetchedAt > MODEL_CACHE_STALENESS_MS;
  };

  const fetchModelsForUrl = useCallback(
    async (
      baseUrl: string,
      apiKey: string,
      options?: FetchModelsCallOptions
    ): Promise<AIModelInfo[]> => {
      const normalizedUrl = normalizeBaseUrl(baseUrl);
      const subscriptionOnly =
        options?.subscriptionOnly ?? !!draftRef.current.ai.subscriptionModelsOnly;
      if (!isOpenRef.current || !mountedRef.current) {
        return modelsByBaseUrlRef.current[normalizedUrl]?.models ?? [];
      }
      if (fetchingModelsByBaseUrlRef.current[normalizedUrl]) {
        return modelsByBaseUrlRef.current[normalizedUrl]?.models ?? [];
      }
      const signal = catalogAbortRef.current?.signal;
      if (signal?.aborted) {
        return modelsByBaseUrlRef.current[normalizedUrl]?.models ?? [];
      }
      setFetchingModelsByBaseUrl((prev) => ({ ...prev, [normalizedUrl]: true }));
      try {
        const aiService = new AIService(
          { ...draftRef.current.ai, baseUrl, apiKey, subscriptionModelsOnly: subscriptionOnly },
          draftRef.current.sampler
        );
        const models = await aiService.fetchModels({
          subscriptionOnly,
          detailed: true,
          signal,
        });
        if (mountedRef.current && isOpenRef.current && !signal?.aborted) {
          setModelsByBaseUrl((prev) => ({
            ...prev,
            [normalizedUrl]: { models, fetchedAt: Date.now(), subscriptionOnly },
          }));
          setModelFetchErrorByBaseUrl((prev) => withoutKey(prev, normalizedUrl));
        }
        return models;
      } catch (err) {
        if (isAbortError(err)) {
          return modelsByBaseUrlRef.current[normalizedUrl]?.models ?? [];
        }
        if (mountedRef.current && isOpenRef.current) {
          const message = err instanceof AIError ? err.message : 'Failed to fetch models';
          setModelFetchErrorByBaseUrl((prev) => ({ ...prev, [normalizedUrl]: message }));
        }
        return [];
      } finally {
        if (mountedRef.current && isOpenRef.current) {
          setFetchingModelsByBaseUrl((prev) => ({ ...prev, [normalizedUrl]: false }));
        }
      }
    },
    []
  );

  const fetchModelsForUrlRef = useRef(fetchModelsForUrl);
  fetchModelsForUrlRef.current = fetchModelsForUrl;

  const showModelsIfCurrent = useCallback(
    (normalizedUrl: string, models: AIModelInfo[]) => {
      setDraft((prev) =>
        normalizeBaseUrl(prev.ai.baseUrl) === normalizedUrl
          ? { ...prev, ai: { ...prev.ai, availableModels: models } }
          : prev
      );
    },
    [setDraft]
  );

  // Auto-fetch models for presets with stored keys when panel opens
  useEffect(() => {
    if (!isOpen || isLoading) return;

    const autoFetch = async () => {
      const fetches: Promise<void>[] = [];

      for (const preset of AI_BASE_URL_PRESETS) {
        const normalizedUrl = normalizeBaseUrl(preset.baseUrl);
        const apiKey = draftRef.current.ai.apiKeysByBaseUrl?.[normalizedUrl];

        if (!apiKey) continue;

        const subscriptionOnly = !!draftRef.current.ai.subscriptionModelsOnly;

        if (!isCacheStale(normalizedUrl, subscriptionOnly)) {
          const cached = modelsByBaseUrlRef.current[normalizedUrl];
          if (
            normalizeBaseUrl(draftRef.current.ai.baseUrl) === normalizedUrl &&
            cached
          ) {
            setDraft((prev) => ({
              ...prev,
              ai: { ...prev.ai, availableModels: cached.models },
            }));
          }
          continue;
        }

        fetches.push(
          fetchModelsForUrl(preset.baseUrl, apiKey, { subscriptionOnly }).then((models) => {
            if (!mountedRef.current || !isOpenRef.current) return;
            showModelsIfCurrent(normalizedUrl, models);
          })
        );
      }

      await Promise.allSettled(fetches);
    };

    void autoFetch();
  }, [isOpen, isLoading, fetchModelsForUrl, setDraft, showModelsIfCurrent]);

  const fetchModels = useCallback(
    async (options?: FetchModelsCallOptions) => {
      if (mountedRef.current) setIsFetchingModels(true);
      const fetchedUrl = normalizeBaseUrl(draftRef.current.ai.baseUrl);
      try {
        const { ai, sampler } = draftRef.current;
        const subscriptionOnly =
          options?.subscriptionOnly !== undefined
            ? options.subscriptionOnly
            : !!ai.subscriptionModelsOnly;

        if (options?.subscriptionOnly !== undefined) {
          draftRef.current = {
            ...draftRef.current,
            ai: { ...ai, subscriptionModelsOnly: options.subscriptionOnly },
          };
        }

        const signal = catalogAbortRef.current?.signal;
        const aiService = new AIService(
          { ...draftRef.current.ai, subscriptionModelsOnly: subscriptionOnly },
          sampler
        );
        const models = await aiService.fetchModels({
          subscriptionOnly,
          detailed: true,
          signal,
        });
        if (!mountedRef.current || !isOpenRef.current || signal?.aborted) return;
        showModelsIfCurrent(fetchedUrl, models);
        setModelsByBaseUrl((prev) => ({
          ...prev,
          [fetchedUrl]: { models, fetchedAt: Date.now(), subscriptionOnly },
        }));
        setModelFetchErrorByBaseUrl((prev) => withoutKey(prev, fetchedUrl));
        addToast('success', `Fetched ${models.length} models`);
      } catch (err) {
        if (!mountedRef.current || !isOpenRef.current || isAbortError(err)) return;
        const message = err instanceof AIError ? err.message : 'Failed to fetch models';
        setModelFetchErrorByBaseUrl((prev) => ({ ...prev, [fetchedUrl]: message }));
        addToast('error', message);
      } finally {
        if (mountedRef.current && isOpenRef.current) setIsFetchingModels(false);
      }
    },
    [addToast, showModelsIfCurrent]
  );

  const fetchModelProviders = useCallback(
    async (modelId: string, ai: AIConfig, sampler: SamplerSettings) => {
      if (!modelId) return;

      if (mountedRef.current) setIsFetchingProviders(true);
      try {
        const signal = catalogAbortRef.current?.signal;
        const aiService = new AIService(ai, sampler);
        const providerInfo = await aiService.fetchModelProviders(modelId, signal);

        if (!mountedRef.current || !isOpenRef.current || signal?.aborted) return;

        setSupportsProviderSelection(providerInfo.supportsProviderSelection);

        if (providerInfo.supportsProviderSelection) {
          setModelProviders(providerInfo.providers);
          const currentProvider = draftRef.current.ai.selectedProvider;
          if (
            currentProvider &&
            !providerInfo.providers.some((p) => p.provider === currentProvider)
          ) {
            setDraft((prev) => ({
              ...prev,
              ai: {
                ...prev.ai,
                selectedProvider: '',
                providerByModelId: { ...(prev.ai.providerByModelId ?? {}) },
              },
            }));
          }
        } else {
          setModelProviders([]);
        }
      } catch (err) {
        if (isAbortError(err) || !mountedRef.current || !isOpenRef.current) return;
        console.error('Failed to fetch model providers:', err);
        setModelProviders([]);
        setSupportsProviderSelection(false);
      } finally {
        if (mountedRef.current && isOpenRef.current) setIsFetchingProviders(false);
      }
    },
    [setDraft]
  );

  // Fetch providers when model changes
  useEffect(() => {
    if (!isOpen || isLoading) return;

    if (!draft.ai.modelId) {
      setModelProviders([]);
      setSupportsProviderSelection(false);
      return;
    }

    void fetchModelProviders(draft.ai.modelId, draft.ai, draft.sampler);
    // Intentionally depend on modelId primarily; full ai/sampler passed into fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isLoading, draft.ai.modelId, fetchModelProviders]);

  const handleBaseUrlChange = useCallback(
    (baseUrl: string, loadStoredProfile: boolean) => {
      const normalizedUrl = normalizeBaseUrl(baseUrl);
      const subscriptionOnly = !!draftRef.current.ai.subscriptionModelsOnly;
      const cached = modelsByBaseUrl[normalizedUrl];
      const cachedModels =
        !cached || isCacheStale(normalizedUrl, subscriptionOnly) ? [] : cached.models;

      setDraft((prev) => {
        const shouldSaveAsCustom =
          prev.ai.baseUrl && !isPresetUrl(prev.ai.baseUrl) && baseUrl !== prev.ai.baseUrl;

        return {
          ...prev,
          ai: {
            ...prev.ai,
            baseUrl,
            lastCustomBaseUrl: shouldSaveAsCustom
              ? normalizeBaseUrl(prev.ai.baseUrl)
              : prev.ai.lastCustomBaseUrl,
            modelId: loadStoredProfile
              ? getStoredModelId(prev.ai.modelIdsByBaseUrl, baseUrl)
              : prev.ai.modelId,
            apiKey: loadStoredProfile
              ? getStoredApiKey(prev.ai.apiKeysByBaseUrl, baseUrl)
              : prev.ai.apiKey,
            availableModels: cachedModels,
          },
        };
      });

      if (cachedModels.length === 0) {
        const apiKey = draftRef.current.ai.apiKeysByBaseUrl?.[normalizedUrl];
        if (apiKey) {
          void fetchModelsForUrl(baseUrl, apiKey, { subscriptionOnly }).then((models) => {
            if (!mountedRef.current || !isOpenRef.current) return;
            showModelsIfCurrent(normalizedUrl, models);
          });
        }
      }
    },
    [modelsByBaseUrl, setDraft, fetchModelsForUrl, showModelsIfCurrent]
  );

  const handleCustomUrlChange = useCallback(
    (baseUrl: string) => {
      const normalizedUrl = normalizeBaseUrl(baseUrl);
      const subscriptionOnly = !!draftRef.current.ai.subscriptionModelsOnly;
      const cached = modelsByBaseUrl[normalizedUrl];
      const cachedModels =
        !cached || isCacheStale(normalizedUrl, subscriptionOnly) ? [] : cached.models;

      setDraft((prev) => ({
        ...prev,
        ai: {
          ...prev.ai,
          baseUrl,
          lastCustomBaseUrl: normalizedUrl,
          modelId: normalizedUrl
            ? getStoredModelId(prev.ai.modelIdsByBaseUrl, normalizedUrl)
            : prev.ai.modelId,
          apiKey: normalizedUrl
            ? getStoredApiKey(prev.ai.apiKeysByBaseUrl, normalizedUrl)
            : prev.ai.apiKey,
          availableModels: cachedModels,
        },
      }));

      if (cachedModels.length === 0 && normalizedUrl) {
        const apiKey = draftRef.current.ai.apiKeysByBaseUrl?.[normalizedUrl];
        if (apiKey) {
          void fetchModelsForUrl(baseUrl, apiKey, { subscriptionOnly }).then((models) => {
            if (!mountedRef.current || !isOpenRef.current) return;
            showModelsIfCurrent(normalizedUrl, models);
          });
        }
      }
    },
    [modelsByBaseUrl, setDraft, fetchModelsForUrl, showModelsIfCurrent]
  );

  const handleApiKeyChange = useCallback(
    (apiKey: string) => {
      setDraft((prev) => {
        const normalizedBaseUrl = normalizeBaseUrl(prev.ai.baseUrl);
        const apiKeysByBaseUrl = { ...(prev.ai.apiKeysByBaseUrl ?? {}) };

        if (normalizedBaseUrl) {
          if (apiKey) {
            apiKeysByBaseUrl[normalizedBaseUrl] = apiKey;
          } else {
            delete apiKeysByBaseUrl[normalizedBaseUrl];
          }
        }

        return {
          ...prev,
          ai: {
            ...prev.ai,
            apiKey,
            apiKeysByBaseUrl,
          },
        };
      });
    },
    [setDraft]
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      setDraft((prev) => {
        const normalizedBaseUrl = normalizeBaseUrl(prev.ai.baseUrl);
        const modelIdsByBaseUrl = { ...(prev.ai.modelIdsByBaseUrl ?? {}) };

        if (normalizedBaseUrl) {
          if (modelId) {
            modelIdsByBaseUrl[normalizedBaseUrl] = modelId;
          } else {
            delete modelIdsByBaseUrl[normalizedBaseUrl];
          }
        }

        if (modelId === prev.ai.modelId) {
          return {
            ...prev,
            ai: { ...prev.ai, modelIdsByBaseUrl },
          };
        }

        const savedProvider = prev.ai.providerByModelId?.[modelId];
        const providerToUse =
          savedProvider !== undefined ? savedProvider : prev.ai.selectedProvider;

        return {
          ...prev,
          ai: {
            ...prev.ai,
            modelId,
            modelIdsByBaseUrl,
            selectedProvider: providerToUse,
          },
        };
      });
    },
    [setDraft]
  );

  const handleProviderChange = useCallback(
    (providerId: string) => {
      setDraft((prev) => {
        const providerByModelId = { ...(prev.ai.providerByModelId ?? {}) };

        if (prev.ai.modelId) {
          if (providerId) {
            providerByModelId[prev.ai.modelId] = providerId;
          } else {
            delete providerByModelId[prev.ai.modelId];
          }
        }

        return {
          ...prev,
          ai: {
            ...prev.ai,
            selectedProvider: providerId,
            providerByModelId,
          },
        };
      });
    },
    [setDraft]
  );

  const selectedBaseUrlPreset =
    AI_BASE_URL_PRESETS.find(
      (preset) => normalizeBaseUrl(preset.baseUrl) === normalizeBaseUrl(draft.ai.baseUrl)
    )?.id ?? 'custom';

  const isFetchingModelsForCurrentUrl =
    !!fetchingModelsByBaseUrl[normalizeBaseUrl(draft.ai.baseUrl)];
  const modelFetchErrorForCurrentUrl =
    modelFetchErrorByBaseUrl[normalizeBaseUrl(draft.ai.baseUrl)] ?? null;

  const resetProviderState = useCallback(() => {
    setModelProviders([]);
    setSupportsProviderSelection(false);
  }, []);

  const modelsByBaseUrlList = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(modelsByBaseUrl).map(([url, cache]) => [url, cache.models])
      ),
    [modelsByBaseUrl]
  );

  const isFetchingModelsForUrl = useCallback(
    (baseUrl: string) => !!fetchingModelsByBaseUrl[normalizeBaseUrl(baseUrl)],
    [fetchingModelsByBaseUrl]
  );

  const modelFetchErrorForUrl = useCallback(
    (baseUrl: string) => modelFetchErrorByBaseUrl[normalizeBaseUrl(baseUrl)] ?? null,
    [modelFetchErrorByBaseUrl]
  );

  const fetchModelsForUrlPublic = useCallback(
    async (baseUrl: string) => {
      const normalizedUrl = normalizeBaseUrl(baseUrl);
      if (!normalizedUrl) return;
      const apiKey =
        getStoredApiKey(draftRef.current.ai.apiKeysByBaseUrl, normalizedUrl) ||
        (normalizeBaseUrl(draftRef.current.ai.baseUrl) === normalizedUrl
          ? draftRef.current.ai.apiKey
          : '');
      await fetchModelsForUrlRef.current(normalizedUrl, apiKey);
    },
    []
  );

  return {
    isFetchingModels,
    isFetchingModelsForCurrentUrl,
    modelFetchErrorForCurrentUrl,
    modelsByBaseUrl: modelsByBaseUrlList,
    isFetchingModelsForUrl,
    modelFetchErrorForUrl,
    modelProviders,
    isFetchingProviders,
    supportsProviderSelection,
    selectedBaseUrlPreset,
    fetchModels,
    /** Public single-arg fetch for Prompts tab helpers */
    fetchModelsForUrl: fetchModelsForUrlPublic,
    /** Ref form used by NanoGPT sign-in (baseUrl + apiKey) */
    fetchModelsForUrlRef,
    handleBaseUrlChange,
    handleCustomUrlChange,
    handleApiKeyChange,
    handleModelChange,
    handleProviderChange,
    resetProviderState,
  };
}
