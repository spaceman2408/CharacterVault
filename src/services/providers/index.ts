/**
 * @fileoverview Barrel export for AI provider adapters.
 * @module @services/providers
 */

export { NanoGPTProvider } from './NanoGPTProvider';
export { OpenAICompatProvider } from './OpenAICompatProvider';
export {
  SyntheticProvider,
  isSyntheticBaseUrl,
  mapSyntheticCatalog,
  normalizeSyntheticQuotas,
  syntheticQuotasUrl,
} from './SyntheticProvider';
export type {
  IProviderAdapter,
  ModelProvider,
  ModelProviderInfo,
  ExtendedAIModelInfo,
  FetchModelsOptions,
  NanoGPTSubscriptionState,
  NanoGPTQuotaWindow,
  NanoGPTSubscriptionUsage,
  NanoGPTBalance,
  SyntheticQuotas,
  SyntheticQuotaWindow,
  SyntheticRollingFiveHourLimit,
  SyntheticSubscriptionQuota,
  SyntheticWeeklyTokenLimit,
} from './types';

import { NanoGPTProvider } from './NanoGPTProvider';
import { OpenAICompatProvider } from './OpenAICompatProvider';
import { SyntheticProvider } from './SyntheticProvider';
import type { IProviderAdapter } from './types';
import type { AIConfig } from '../../db/characterTypes';

// Ordered list: more specific providers first, fallback last
const providers: IProviderAdapter[] = [
  new NanoGPTProvider(),
  new SyntheticProvider(),
  new OpenAICompatProvider(), // fallback — must be last
];

/**
 * Resolve the appropriate provider adapter for the given base URL.
 * Returns the first adapter whose matches() returns true.
 */
export function resolveProvider(baseUrl: string): IProviderAdapter {
  return providers.find((p) => p.matches(baseUrl)) ?? new OpenAICompatProvider();
}

/**
 * Return the configured provider-selection ID only for APIs that support it.
 * Generic OpenAI-compatible endpoints like LM Studio should not display stale
 * NanoGPT provider selections in response stats.
 */
export function getProviderSelectionId(config: AIConfig): string | undefined {
  if (!config.modelId) {
    return undefined;
  }

  const provider = resolveProvider(config.baseUrl);
  if (!provider.maySupportProviderSelection(config.modelId)) {
    return undefined;
  }

  return (config.providerByModelId?.[config.modelId] ?? config.selectedProvider) || undefined;
}
