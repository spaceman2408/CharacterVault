/**
 * @fileoverview NanoGPT provider adapter for provider selection support.
 * @module @services/providers/NanoGPTProvider
 */

import type {
  IProviderAdapter,
  FetchModelsOptions,
  ExtendedAIModelInfo,
  ModelProviderInfo,
} from './types';
import type { AIConfig } from '../../db/characterTypes';

/**
 * NanoGPT API response for models endpoint with detailed=true
 */
interface NanoGPTModelResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
    supportsProviderSelection?: boolean;
    contextLength?: number;
    pricing?: {
      prompt: number;
      completion: number;
    };
  }>;
}

/**
 * NanoGPT API response for provider discovery endpoint
 */
interface NanoGPTProviderResponse {
  canonicalId: string;
  displayName: string;
  supportsProviderSelection: boolean;
  defaultPrice: {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
  };
  providers: Array<{
    provider: string;
    pricing: {
      inputPer1kTokens: number;
      outputPer1kTokens: number;
    };
    available: boolean;
  }>;
}

/**
 * NanoGPT-specific provider adapter.
 * Handles provider selection, subscription models, and billing mode.
 */
export class NanoGPTProvider implements IProviderAdapter {
  private providerCache = new Map<string, { info: ModelProviderInfo; timestamp: number }>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

  /**
   * Check if this adapter should handle the given base URL
   */
  matches(baseUrl: string): boolean {
    const normalizedUrl = baseUrl.toLowerCase();
    return normalizedUrl.includes('nano-gpt.com');
  }

  /**
   * Normalize base URL (remove trailing slashes and API version path)
   * Converts https://nano-gpt.com/api/v1 -> https://nano-gpt.com
   * Converts https://nano-gpt.com/v1 -> https://nano-gpt.com
   */
  private normalizeBaseUrl(baseUrl: string): string {
    let normalized = baseUrl.replace(/\/$/, '');
    // Strip /api/v1 or /v1 suffix to get the base domain
    normalized = normalized.replace(/\/api\/v1$/, '').replace(/\/v1$/, '');
    return normalized;
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  /**
   * Fetch available models from the NanoGPT API
   * 
   * Uses:
   * - /api/subscription/v1/models when subscriptionOnly=true
   * - /api/v1/models otherwise
   */
  async fetchModels(
    baseUrl: string,
    apiKey: string,
    options: FetchModelsOptions = {}
  ): Promise<ExtendedAIModelInfo[]> {
    const normalizedUrl = this.normalizeBaseUrl(baseUrl);
    const { subscriptionOnly = false, detailed = true } = options;

    const endpoint = subscriptionOnly
      ? `${normalizedUrl}/api/subscription/v1/models`
      : `${normalizedUrl}/api/v1/models`;

    const url = detailed ? `${endpoint}?detailed=true` : endpoint;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(apiKey),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Failed to fetch models: ${response.statusText || `HTTP ${response.status}`}`);
    }

    const data = (await response.json()) as NanoGPTModelResponse;

    if (!Array.isArray(data.data)) {
      throw new Error('Invalid response format: expected data array');
    }

    const models: ExtendedAIModelInfo[] = data.data.map((model) => ({
      id: model.id,
      name: model.id,
      contextLength: model.contextLength,
      pricing: model.pricing,
      supportsProviderSelection: model.supportsProviderSelection ?? false,
    }));

    // Sort models alphabetically by ID
    return models.sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Check cached provider info for a model.
   * Returns cached result if fresh, undefined otherwise.
   */
  getCachedProviderInfo(modelId: string): ModelProviderInfo | undefined {
    const cached = this.providerCache.get(modelId);
    if (!cached) return undefined;
    if (Date.now() - cached.timestamp > NanoGPTProvider.CACHE_TTL_MS) {
      this.providerCache.delete(modelId);
      return undefined;
    }
    return cached.info;
  }

  /**
   * Quick check whether a model *might* support provider selection on NanoGPT.
   * - If we already have cached provider info, use it definitively
   * - Otherwise return true (conservative: let the API call decide)
   *
   * NOTE: The supportsProviderSelection flag from /api/v1/models is unreliable.
   * The /api/models/:id/providers endpoint is the authoritative source.
   */
   maySupportProviderSelection(modelId: string): boolean {
    const cached = this.getCachedProviderInfo(modelId);
    if (cached) return cached.supportsProviderSelection;
    return true;
  }

  /**
   * Fetch available providers for a specific model.
   * Results are cached for CACHE_TTL_MS to avoid redundant API calls.
   */
  async fetchModelProviders(
    baseUrl: string,
    apiKey: string,
    modelId: string
  ): Promise<ModelProviderInfo> {
    const cached = this.getCachedProviderInfo(modelId);
    if (cached) return cached;

    const normalizedUrl = this.normalizeBaseUrl(baseUrl);
    const url = `${normalizedUrl}/api/models/${encodeURIComponent(modelId)}/providers`;

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        const notFoundInfo: ModelProviderInfo = {
          canonicalId: modelId,
          displayName: modelId,
          supportsProviderSelection: false,
          defaultPrice: { inputPer1kTokens: 0, outputPer1kTokens: 0 },
          providers: [],
        };
        this.providerCache.set(modelId, { info: notFoundInfo, timestamp: Date.now() });
        return notFoundInfo;
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Failed to fetch providers: ${response.statusText || `HTTP ${response.status}`}`);
    }

    const data = (await response.json()) as NanoGPTProviderResponse;

    const info: ModelProviderInfo = {
      canonicalId: data.canonicalId ?? modelId,
      displayName: data.displayName ?? modelId,
      supportsProviderSelection: data.supportsProviderSelection ?? false,
      defaultPrice: data.defaultPrice ?? { inputPer1kTokens: 0, outputPer1kTokens: 0 },
      providers: (data.providers ?? []).map((p) => ({
        provider: p.provider,
        pricing: p.pricing,
        available: p.available,
      })),
    };

    this.providerCache.set(modelId, { info, timestamp: Date.now() });
    return info;
  }

  /**
   * Get headers for chat completion requests
   * 
   * Adds:
   * - X-Provider: when a specific provider is selected for the model
   * - X-Billing-Mode: paygo when billingMode is 'paygo'
   */
  getChatHeaders(config: AIConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    // Add provider header if one is selected for the current model
    if (config.modelId) {
      const selectedProvider =
        config.providerByModelId?.[config.modelId] ?? config.selectedProvider;

      if (selectedProvider) {
        headers['X-Provider'] = selectedProvider;
      }
    }

    // Add billing mode header if forcing pay-as-you-go
    if (config.billingMode === 'paygo') {
      headers['X-Billing-Mode'] = 'paygo';
    }

    return headers;
  }
}
