/**
 * @fileoverview Generic OpenAI-compatible provider adapter.
 * @module @services/providers/OpenAICompatProvider
 */

import type {
  IProviderAdapter,
  FetchModelsOptions,
  ExtendedAIModelInfo,
  ModelProviderInfo,
} from './types';

/**
 * OpenAI-compatible models list response
 */
interface ModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

/**
 * Generic OpenAI-compatible provider adapter.
 * Works with LM Studio and any standard OpenAI-compatible API.
 * Provider selection is not supported.
 */
export class OpenAICompatProvider implements IProviderAdapter {
  /**
   * This is the fallback provider - matches any URL
   */
  matches(): boolean {
    return true;
  }

  /**
   * Normalize base URL (remove trailing slashes)
   */
  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/$/, '');
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
   * Fetch available models from the OpenAI-compatible API
   */
  async fetchModels(
    baseUrl: string,
    apiKey: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: FetchModelsOptions = {}
  ): Promise<ExtendedAIModelInfo[]> {
    const normalizedUrl = this.normalizeBaseUrl(baseUrl);

    const response = await fetch(`${normalizedUrl}/models`, {
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

    const data = (await response.json()) as ModelsResponse;

    if (!Array.isArray(data.data)) {
      throw new Error('Invalid response format: expected data array');
    }

    const models: ExtendedAIModelInfo[] = data.data.map((model) => ({
      id: model.id,
      name: model.id,
    }));

    // Sort models alphabetically by ID
    return models.sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Provider selection is not supported by generic OpenAI-compatible APIs.
   * Returns a response indicating no provider selection support.
   */
  async fetchModelProviders(
    _baseUrl: string,
    _apiKey: string,
    modelId: string
  ): Promise<ModelProviderInfo> {
    return {
      canonicalId: modelId,
      displayName: modelId,
      supportsProviderSelection: false,
      defaultPrice: { inputPer1kTokens: 0, outputPer1kTokens: 0 },
      providers: [],
    };
  }

  /**
   * Provider selection is not supported by generic OpenAI-compatible APIs.
   */
  maySupportProviderSelection(): boolean {
    return false;
  }

  /**
   * No extra headers for generic OpenAI-compatible APIs
   */
  getChatHeaders(): Record<string, string> {
    return {};
  }
}
