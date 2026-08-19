/**
 * @fileoverview TypeScript interfaces for AI provider adapters.
 * @module @services/providers/types
 */

import type { AIConfig, AIModelInfo } from '../../db/characterTypes';

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
   * Returns false when definitively not supported (e.g. non-NanoGPT, or cached as false),
   * true when it *might* be (needs a fetchModelProviders call to confirm).
   */
  maySupportProviderSelection(modelId: string): boolean;

  /** Get any extra headers to attach to chat completion requests */
  getChatHeaders(config: AIConfig): Record<string, string>;
}

export interface FetchModelsOptions {
  subscriptionOnly?: boolean;
  detailed?: boolean;
}

/** NanoGPT subscription state from /api/subscription/v1/usage */
export type NanoGPTSubscriptionState = 'active' | 'grace' | 'inactive';

/** Quota window for input tokens or images (used / remaining / reset) */
export interface NanoGPTQuotaWindow {
  used: number;
  remaining: number;
  /** Fraction in [0, 1] */
  percentUsed: number;
  /** UNIX epoch milliseconds */
  resetAt: number;
}

/** Normalized subscription usage from GET /api/subscription/v1/usage */
export interface NanoGPTSubscriptionUsage {
  active: boolean;
  state: NanoGPTSubscriptionState;
  graceUntil: string | null;
  allowOverage: boolean;
  limits: {
    weeklyInputTokens: number | null;
    dailyInputTokens: number | null;
    dailyImages: number | null;
  };
  period: { currentPeriodEnd: string | null };
  weeklyInputTokens: NanoGPTQuotaWindow | null;
  dailyInputTokens: NanoGPTQuotaWindow | null;
  dailyImages: NanoGPTQuotaWindow | null;
  provider?: string;
  providerStatus?: string;
  cancellationReason?: string | null;
  canceledAt?: string | null;
  endedAt?: string | null;
}

/** Account balance from POST /api/check-balance */
export interface NanoGPTBalance {
  usdBalance: string;
  nanoBalance: string;
}

/** Request-count window (subscription pack, hourly search, free tool calls) */
export interface SyntheticQuotaWindow {
  limit: number;
  requests: number;
  renewsAt: string | null;
}

/** @deprecated Use SyntheticQuotaWindow */
export type SyntheticSubscriptionQuota = SyntheticQuotaWindow;

/** Weekly credit budget from GET https://api.synthetic.new/v2/quotas */
export interface SyntheticWeeklyTokenLimit {
  percentRemaining: number | null;
  maxCredits: string | null;
  remainingCredits: string | null;
  maxCreditsAmount: number | null;
  remainingCreditsAmount: number | null;
  nextRegenAt: string | null;
  nextRegenCredits: string | null;
}

/**
 * Rolling five-hour request allowance.
 * `remaining` can be fractional — cheaper models cost a fraction of one request.
 */
export interface SyntheticRollingFiveHourLimit {
  remaining: number;
  max: number;
  nextTickAt: string | null;
  tickPercent: number | null;
  limited: boolean;
}

/** Normalized quota payload from Synthetic */
export interface SyntheticQuotas {
  subscription: SyntheticQuotaWindow | null;
  searchHourly: SyntheticQuotaWindow | null;
  freeToolCalls: SyntheticQuotaWindow | null;
  weeklyTokenLimit: SyntheticWeeklyTokenLimit | null;
  rollingFiveHourLimit: SyntheticRollingFiveHourLimit | null;
}

/** Normalized GET /api/v1/key payload from OpenRouter (regular inference keys). */
export interface OpenRouterKeyInfo {
  label: string | null;
  limit: number | null;
  limitRemaining: number | null;
  limitReset: string | null;
  usage: number;
  usageDaily: number;
  usageWeekly: number;
  usageMonthly: number;
  isFreeTier: boolean;
  expiresAt: string | null;
}
