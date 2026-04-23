/**
 * @fileoverview TypeScript interfaces for AI provider adapters.
 * @module @services/providers/types
 */

import type { AIConfig, AIModelInfo } from '../../db/types';

/** A single provider option for a model */
export interface ModelProvider {
  provider: string;
  pricing: {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
  };
  available: boolean;
}

/** Response from the provider-discovery endpoint */
export interface ModelProviderInfo {
  canonicalId: string;
  displayName: string;
  supportsProviderSelection: boolean;
  defaultPrice: {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
  };
  providers: ModelProvider[];
}

/** Extended model info with provider-selection support flag */
export interface ExtendedAIModelInfo extends AIModelInfo {
  supportsProviderSelection?: boolean;
}

/** Provider adapter interface */
export interface IProviderAdapter {
  /** Detect if this adapter handles the given base URL */
  matches(baseUrl: string): boolean;

  /** Fetch models (endpoint may vary by provider) */
  fetchModels(
    baseUrl: string,
    apiKey: string,
    options?: FetchModelsOptions
  ): Promise<ExtendedAIModelInfo[]>;

  /** Fetch available providers for a specific model */
  fetchModelProviders(
    baseUrl: string,
    apiKey: string,
    modelId: string
  ): Promise<ModelProviderInfo>;

  /** Check cached provider info without making an API call */
  getCachedProviderInfo?(modelId: string): ModelProviderInfo | undefined;

  /**
   * Quick check whether a model *might* support provider selection.
   * Uses cached model list when available, falls back to provider-specific heuristics.
   * Returns false when provider selection is definitively not supported,
   * true when it *might* be (needs a fetchModelProviders call to confirm).
   */
  maySupportProviderSelection(
    modelId: string,
    availableModels?: AIModelInfo[]
  ): boolean;

  /** Get any extra headers to attach to chat completion requests */
  getChatHeaders(config: AIConfig): Record<string, string>;
}

export interface FetchModelsOptions {
  subscriptionOnly?: boolean;
  detailed?: boolean;
}
