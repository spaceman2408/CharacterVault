/**
 * Resolve effective AIConfig for a toolbar operation using per-prompt model bindings.
 */

import type {
  AIConfig,
  AIOperation,
  PromptModelMap,
} from '../db/characterTypes';
import { getStoredApiKey, normalizeBaseUrl } from '../utils/aiBaseUrl';

/**
 * Apply a per-operation endpoint/model binding to the global AI config.
 * Missing or incomplete bindings leave the original config unchanged.
 */
export function resolveConfigForOperation(
  config: AIConfig,
  operation: AIOperation,
  promptModels?: PromptModelMap | null
): AIConfig {
  const binding = promptModels?.[operation];
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

/** Normalize and filter a persisted prompt model map. */
export function normalizePromptModelMap(
  map: PromptModelMap | null | undefined
): PromptModelMap {
  if (!map || typeof map !== 'object') {
    return {};
  }

  const result: PromptModelMap = {};
  for (const [key, binding] of Object.entries(map)) {
    if (!binding || typeof binding !== 'object') continue;
    const modelId = typeof binding.modelId === 'string' ? binding.modelId.trim() : '';
    const baseUrl = typeof binding.baseUrl === 'string' ? normalizeBaseUrl(binding.baseUrl) : '';
    if (!modelId || !baseUrl) continue;
    result[key as keyof PromptModelMap] = { baseUrl, modelId };
  }
  return result;
}
