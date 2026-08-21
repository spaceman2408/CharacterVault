/**
 * Resolve effective AIConfig for a toolbar operation using per-prompt model bindings.
 */

import type {
  AIConfig,
  AIOperation,
  PromptModelBinding,
  PromptModelMap,
} from '../db/characterTypes';
import { getStoredApiKey, normalizeBaseUrl } from '../utils/aiBaseUrl';

export function normalizeModelBinding(
  binding: PromptModelBinding | null | undefined,
): PromptModelBinding | undefined {
  if (!binding || typeof binding !== 'object') return undefined;
  const modelId = typeof binding.modelId === 'string' ? binding.modelId.trim() : '';
  const baseUrl = typeof binding.baseUrl === 'string' ? normalizeBaseUrl(binding.baseUrl) : '';
  if (!modelId || !baseUrl) return undefined;
  return { baseUrl, modelId };
}

/**
 * Apply an endpoint/model binding to the global AI config.
 * Missing or incomplete bindings leave the original config unchanged.
 */
export function applyModelBinding(
  config: AIConfig,
  binding?: PromptModelBinding | null,
): AIConfig {
  if (!binding?.modelId?.trim()) {
    return config;
  }

  const baseUrl = normalizeBaseUrl(binding.baseUrl) || normalizeBaseUrl(config.baseUrl);
  if (!baseUrl) {
    return config;
  }

  const modelId = binding.modelId.trim();
  const sameEndpoint = baseUrl === normalizeBaseUrl(config.baseUrl);

  const apiKey =
    getStoredApiKey(config.apiKeysByBaseUrl, baseUrl) ||
    (sameEndpoint ? config.apiKey : '');

  return {
    ...config,
    baseUrl,
    apiKey,
    modelId,
    selectedProvider: sameEndpoint
      ? (config.providerByModelId?.[modelId] ?? config.selectedProvider)
      : (config.providerByModelId?.[modelId] ?? undefined),
  };
}

/**
 * Apply a per-operation endpoint/model binding to the global AI config.
 * Missing or incomplete bindings leave the original config unchanged.
 */
export function resolveConfigForOperation(
  config: AIConfig,
  operation: AIOperation,
  promptModels?: PromptModelMap | null
): AIConfig {
  return applyModelBinding(config, promptModels?.[operation]);
}

/** Normalize and filter a persisted prompt model map. */
export function normalizePromptModelMap(
  map: PromptModelMap | null | undefined
): PromptModelMap {
  if (!map || typeof map !== 'object') {
    return {};
  }

  const result: PromptModelMap = {};
  for (const [key, binding] of Object.entries(map)) {
    const normalized = normalizeModelBinding(binding);
    if (!normalized) continue;
    result[key as keyof PromptModelMap] = normalized;
  }
  return result;
}
