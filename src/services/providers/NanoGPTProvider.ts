/**
 * @fileoverview NanoGPT provider adapter for provider selection support.
 * @module @services/providers/NanoGPTProvider
 */

import type {
  IProviderAdapter,
  FetchModelsOptions,
  ExtendedAIModelInfo,
  ModelProviderInfo,
  NanoGPTBalance,
  NanoGPTQuotaWindow,
  NanoGPTSubscriptionState,
  NanoGPTSubscriptionUsage,
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

  /**
   * Fetch subscription status and weekly/daily quota windows.
   * GET /api/subscription/v1/usage
   *
   * Note: This path currently lacks browser CORS headers on nano-gpt.com
   * (unlike /api/v1/models and /api/check-balance). In Vite dev/preview we
   * route through the same-origin `/__nanogpt` proxy (see vite.config.ts).
   * Optional production override: VITE_NANOGPT_PROXY.
   */
  async fetchSubscriptionUsage(
    baseUrl: string,
    apiKey: string
  ): Promise<NanoGPTSubscriptionUsage> {
    if (!apiKey.trim()) {
      throw new Error('API key required');
    }

    const normalizedUrl = this.normalizeBaseUrl(baseUrl);
    const directUrl = `${normalizedUrl}/api/subscription/v1/usage`;
    const url = resolveCorsSafeNanoGptUrl(directUrl);

    // Prefer x-api-key (same as check-balance); avoid Content-Type on GET
    // so we don't add unnecessary preflight surface when calling direct.
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
        },
      });
    } catch {
      throw new Error(
        'Subscription usage blocked by browser CORS (NanoGPT does not allow this endpoint from web apps). Balance still works. Local dev uses a Vite proxy — restart `npm run dev` after updating.'
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(
        `Failed to fetch subscription usage: ${response.statusText || `HTTP ${response.status}`}`
      );
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid subscription usage response');
    }

    return normalizeSubscriptionUsage(data as Record<string, unknown>);
  }

  /**
   * Fetch account balance.
   * POST /api/check-balance (x-api-key auth)
   */
  async fetchBalance(baseUrl: string, apiKey: string): Promise<NanoGPTBalance> {
    if (!apiKey.trim()) {
      throw new Error('API key required');
    }

    const normalizedUrl = this.normalizeBaseUrl(baseUrl);
    const response = await fetch(`${normalizedUrl}/api/check-balance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(
        `Failed to fetch balance: ${response.statusText || `HTTP ${response.status}`}`
      );
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid balance response');
    }

    const raw = data as Record<string, unknown>;
    const usd =
      typeof raw.usd_balance === 'string'
        ? raw.usd_balance
        : typeof raw.usdBalance === 'string'
          ? raw.usdBalance
          : typeof raw.usd_balance === 'number'
            ? String(raw.usd_balance)
            : '0';
    const nano =
      typeof raw.nano_balance === 'string'
        ? raw.nano_balance
        : typeof raw.nanoBalance === 'string'
          ? raw.nanoBalance
          : typeof raw.nano_balance === 'number'
            ? String(raw.nano_balance)
            : '0';

    return { usdBalance: usd, nanoBalance: nano };
  }
}

/**
 * Rewrite NanoGPT URLs that lack browser CORS to a same-origin or configured proxy.
 * Dev/preview: `/__nanogpt` → vite.config.ts proxy → https://nano-gpt.com
 * Production: set VITE_NANOGPT_PROXY (e.g. your own reverse proxy) if needed.
 */
function resolveCorsSafeNanoGptUrl(absoluteUrl: string): string {
  if (typeof window === 'undefined') return absoluteUrl;

  let parsed: URL;
  try {
    parsed = new URL(absoluteUrl);
  } catch {
    return absoluteUrl;
  }

  if (!parsed.hostname.includes('nano-gpt.com')) return absoluteUrl;

  // Only paths confirmed missing Access-Control-Allow-Origin in browser preflight
  if (!parsed.pathname.includes('/subscription/v1/usage')) {
    return absoluteUrl;
  }

  const env = import.meta.env as ImportMetaEnv & { VITE_NANOGPT_PROXY?: string };
  const configuredProxy = env.VITE_NANOGPT_PROXY?.trim();
  if (configuredProxy) {
    return `${configuredProxy.replace(/\/$/, '')}${parsed.pathname}${parsed.search}`;
  }

  // Vite dev server and `vite preview` proxy (see vite.config.ts)
  if (import.meta.env.DEV) {
    return `/__nanogpt${parsed.pathname}${parsed.search}`;
  }

  // vite preview is production build mode but can still use the preview proxy
  if (import.meta.env.MODE === 'production' && /localhost|127\.0\.0\.1/.test(window.location.hostname)) {
    return `/__nanogpt${parsed.pathname}${parsed.search}`;
  }

  return absoluteUrl;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  return null;
}

function parseQuotaWindow(value: unknown): NanoGPTQuotaWindow | null {
  if (!value || typeof value !== 'object') return null;
  const w = value as Record<string, unknown>;
  const used = asNumber(w.used);
  const remaining = asNumber(w.remaining);
  if (used === null || remaining === null) return null;

  let percentUsed = asNumber(w.percentUsed) ?? asNumber(w.percent_used);
  if (percentUsed === null) {
    const total = used + remaining;
    percentUsed = total > 0 ? used / total : 0;
  }
  percentUsed = Math.min(1, Math.max(0, percentUsed));

  const resetAt = asNumber(w.resetAt) ?? asNumber(w.reset_at) ?? 0;

  return { used, remaining, percentUsed, resetAt };
}

function normalizeSubscriptionState(value: unknown): NanoGPTSubscriptionState {
  if (value === 'active' || value === 'grace' || value === 'inactive') return value;
  return 'inactive';
}

function normalizeSubscriptionUsage(raw: Record<string, unknown>): NanoGPTSubscriptionUsage {
  const limitsRaw =
    raw.limits && typeof raw.limits === 'object'
      ? (raw.limits as Record<string, unknown>)
      : {};
  const periodRaw =
    raw.period && typeof raw.period === 'object'
      ? (raw.period as Record<string, unknown>)
      : {};

  return {
    active: Boolean(raw.active),
    state: normalizeSubscriptionState(raw.state),
    graceUntil: asString(raw.graceUntil) ?? asString(raw.grace_until),
    allowOverage: Boolean(raw.allowOverage ?? raw.allow_overage),
    limits: {
      weeklyInputTokens:
        asNumber(limitsRaw.weeklyInputTokens) ?? asNumber(limitsRaw.weekly_input_tokens),
      dailyInputTokens:
        asNumber(limitsRaw.dailyInputTokens) ?? asNumber(limitsRaw.daily_input_tokens),
      dailyImages: asNumber(limitsRaw.dailyImages) ?? asNumber(limitsRaw.daily_images),
    },
    period: {
      currentPeriodEnd:
        asString(periodRaw.currentPeriodEnd) ?? asString(periodRaw.current_period_end),
    },
    weeklyInputTokens:
      parseQuotaWindow(raw.weeklyInputTokens) ?? parseQuotaWindow(raw.weekly_input_tokens),
    dailyInputTokens:
      parseQuotaWindow(raw.dailyInputTokens) ?? parseQuotaWindow(raw.daily_input_tokens),
    dailyImages: parseQuotaWindow(raw.dailyImages) ?? parseQuotaWindow(raw.daily_images),
    provider: asString(raw.provider) ?? undefined,
    providerStatus:
      asString(raw.providerStatus) ?? asString(raw.provider_status) ?? undefined,
    cancellationReason:
      asString(raw.cancellationReason) ?? asString(raw.cancellation_reason),
    canceledAt: asString(raw.canceledAt) ?? asString(raw.canceled_at),
    endedAt: asString(raw.endedAt) ?? asString(raw.ended_at),
  };
}
