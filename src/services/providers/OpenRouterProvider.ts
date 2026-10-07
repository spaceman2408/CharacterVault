import {
  getCapabilityCache,
  recordSupportedEfforts,
} from '../chatRequestRepair';
import type {
  AIConfig,
  AIModelInfo,
  OpenRouterOptions,
  OpenRouterSort,
} from '../../db/characterTypes';
import type {
  IProviderAdapter,
  FetchModelsOptions,
  ExtendedAIModelInfo,
  ModelProvider,
  ModelProviderInfo,
  OpenRouterKeyInfo,
} from './types';

export const OPENROUTER_APP_TITLE = 'CharacterVault';
export const OPENROUTER_APP_URL = 'https://vault.charactervault.app';

const MAX_MODEL_PAGES = 20;
const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000;

interface OpenRouterArchitecture {
  output_modalities?: unknown;
  outputModalities?: unknown;
}

interface OpenRouterModel {
  id?: string;
  name?: string;
  context_length?: number;
  contextLength?: number;
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
  };
  architecture?: OpenRouterArchitecture;
  output_modalities?: unknown;
  outputModalities?: unknown;
  reasoning?: {
    supported_efforts?: unknown;
    supportedEfforts?: unknown;
  };
}

interface OpenRouterModelsResponse {
  data?: unknown;
  links?: { next?: unknown };
}

interface OpenRouterEndpoint {
  provider_name?: unknown;
  tag?: unknown;
  quantization?: unknown;
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
  };
}

interface OpenRouterEndpointsResponse {
  data?: {
    id?: unknown;
    name?: unknown;
    endpoints?: unknown;
  };
}

/** Request body `provider` object (provider routing preferences). */
export interface OpenRouterProviderPrefs {
  order?: string[];
  allow_fallbacks?: boolean;
  sort?: OpenRouterSort;
  data_collection?: 'allow' | 'deny';
  zdr?: boolean;
}

export function isOpenRouterBaseUrl(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes('openrouter.ai');
}

export function openRouterKeyUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/key`;
}

export function openRouterZdrUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/endpoints/zdr`;
}

export function openRouterEndpointsUrl(baseUrl: string, modelId: string): string {
  const path = modelId.split('/').map(encodeURIComponent).join('/');
  return `${normalizeBaseUrl(baseUrl)}/models/${path}/endpoints`;
}

export function getOpenRouterPinnedHost(config: AIConfig): string | undefined {
  if (!config.modelId) return undefined;
  return config.openRouter?.providerByModelId?.[config.modelId] || undefined;
}

/**
 * `:exacto` model id for a tool-calling request, or undefined when Exacto is off.
 * Ids that already carry a variant (`:free`, `:nitro`, …) are left alone.
 */
export function openRouterExactoModelId(config: AIConfig): string | undefined {
  if (!config.openRouter?.exactoForAgent) return undefined;
  if (!config.modelId || config.modelId.includes(':')) return undefined;
  return `${config.modelId}:exacto`;
}

export function buildOpenRouterProviderPrefs(
  config: AIConfig,
  { exacto = false }: { exacto?: boolean } = {}
): OpenRouterProviderPrefs | undefined {
  const options = config.openRouter ?? {};
  const prefs: OpenRouterProviderPrefs = {};

  const pinned = getOpenRouterPinnedHost(config);
  if (pinned) {
    prefs.order = [pinned];
    if (options.pinnedHostOnly) prefs.allow_fallbacks = false;
  } else if (options.sort && !exacto) {
    // An explicit sort would override Exacto's ordering.
    prefs.sort = options.sort;
  }
  if (options.denyDataCollection) prefs.data_collection = 'deny';
  if (options.zdrOnly) prefs.zdr = true;

  return Object.keys(prefs).length > 0 ? prefs : undefined;
}

export function openRouterAppHeaders(): Record<string, string> {
  return {
    'HTTP-Referer': OPENROUTER_APP_URL,
    'X-OpenRouter-Title': OPENROUTER_APP_TITLE,
    'X-Title': OPENROUTER_APP_TITLE,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(/[$,]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

function outputModalities(model: OpenRouterModel): string[] | undefined {
  const raw =
    model.architecture?.output_modalities ??
    model.architecture?.outputModalities ??
    model.output_modalities ??
    model.outputModalities;
  return stringList(raw);
}

export function isOpenRouterChatModel(model: OpenRouterModel): boolean {
  const id = (model.id ?? '').toLowerCase();
  if (!id) return false;
  if (/(?:^|[/_:.-])embed(?:ding)?s?(?:$|[/_:.-])/.test(id)) return false;

  const outputs = outputModalities(model);
  if (outputs && outputs.length > 0 && !outputs.includes('text')) return false;

  return true;
}

export function displayNameForOpenRouterModel(model: OpenRouterModel): string {
  const id = model.id ?? '';
  if (model.name && model.name !== id) return model.name;
  return id;
}

function parsePricing(model: OpenRouterModel): ExtendedAIModelInfo['pricing'] | undefined {
  const prompt = asNumber(model.pricing?.prompt);
  const completion = asNumber(model.pricing?.completion);
  if (prompt === null && completion === null) return undefined;
  return {
    prompt: prompt ?? 0,
    completion: completion ?? 0,
  };
}

function reasoningEfforts(model: OpenRouterModel): string[] | undefined {
  const efforts = model.reasoning?.supported_efforts ?? model.reasoning?.supportedEfforts;
  if (!Array.isArray(efforts)) return undefined;
  const cleaned = efforts
    .filter((effort): effort is string => typeof effort === 'string')
    .map((effort) => effort.trim().toLowerCase())
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function mapOpenRouterCatalog(data: unknown, cacheBaseUrl?: string): ExtendedAIModelInfo[] {
  const payload = data as OpenRouterModelsResponse;
  if (!Array.isArray(payload?.data)) {
    throw new Error('Invalid response format: expected data array');
  }

  const seen = new Set<string>();
  const models: ExtendedAIModelInfo[] = [];
  for (const raw of payload.data) {
    const model = raw as OpenRouterModel;
    if (!isOpenRouterChatModel(model) || !model.id || seen.has(model.id)) continue;
    seen.add(model.id);

    models.push({
      id: model.id,
      name: displayNameForOpenRouterModel(model),
      contextLength: model.context_length ?? model.contextLength,
      pricing: parsePricing(model),
    });

    const efforts = reasoningEfforts(model);
    if (efforts && cacheBaseUrl) {
      recordSupportedEfforts(getCapabilityCache(cacheBaseUrl, model.id), efforts);
    }
  }

  return models.sort((a, b) => {
    const nameDiff = a.name.localeCompare(b.name);
    if (nameDiff !== 0) return nameDiff;
    return a.id.localeCompare(b.id);
  });
}

function endpointVariant(tag: string, quantization: string | null): string | undefined {
  const slash = tag.indexOf('/');
  if (slash !== -1) return tag.slice(slash + 1) || undefined;
  return quantization && quantization !== 'unknown' ? quantization : undefined;
}

export function mapOpenRouterEndpoints(data: unknown, modelId: string): ModelProviderInfo {
  const root = (data as OpenRouterEndpointsResponse | null)?.data;
  const endpoints = Array.isArray(root?.endpoints) ? root.endpoints : [];

  const seen = new Set<string>();
  const providers: ModelProvider[] = [];
  for (const raw of endpoints) {
    const endpoint = (raw ?? {}) as OpenRouterEndpoint;
    const tag = asString(endpoint.tag);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);

    providers.push({
      provider: tag,
      name: asString(endpoint.provider_name) ?? tag,
      variant: endpointVariant(tag, asString(endpoint.quantization)),
      pricing: {
        inputPer1kTokens: (asNumber(endpoint.pricing?.prompt) ?? 0) * 1000,
        outputPer1kTokens: (asNumber(endpoint.pricing?.completion) ?? 0) * 1000,
      },
      available: true,
    });
  }

  return {
    canonicalId: asString(root?.id) ?? modelId,
    displayName: asString(root?.name) ?? modelId,
    supportsProviderSelection: providers.length > 0,
    defaultPrice: { inputPer1kTokens: 0, outputPer1kTokens: 0 },
    providers,
  };
}

export function isFreeOpenRouterModel(model: AIModelInfo): boolean {
  return model.pricing?.prompt === 0 && model.pricing.completion === 0;
}

/** Model ids (variant suffix included) that have at least one ZDR endpoint. */
export function mapOpenRouterZdrModelIds(data: unknown): Set<string> {
  const rows = (data as { data?: unknown } | null)?.data;
  if (!Array.isArray(rows)) {
    throw new Error('Invalid response format: expected data array');
  }
  const ids = new Set<string>();
  for (const row of rows) {
    const id = asString((row as { model_id?: unknown } | null)?.model_id);
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * List-only filters. `zdrModelIds` is null until the ZDR list loads (or if it fails);
 * nothing is hidden then, since OpenRouter still enforces `zdr` on the request.
 */
export function filterOpenRouterModels<T extends AIModelInfo>(
  models: T[],
  options: OpenRouterOptions = {},
  zdrModelIds: ReadonlySet<string> | null = null
): T[] {
  let visible = models;
  if (options.freeModelsOnly) visible = visible.filter(isFreeOpenRouterModel);
  if (options.zdrOnly && zdrModelIds) {
    visible = visible.filter((model) => zdrModelIds.has(model.id));
  }
  return visible;
}

export function resolveOpenRouterNextUrl(next: unknown, requestUrl: string): string | null {
  if (typeof next !== 'string' || !next.trim()) return null;
  try {
    return new URL(next.trim(), requestUrl).href;
  } catch {
    return null;
  }
}

export function normalizeOpenRouterKey(raw: unknown): OpenRouterKeyInfo {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid key response');
  }

  const root = raw as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const usage = asNumber(data.usage);
  if (usage === null) {
    throw new Error('Invalid key response');
  }

  return {
    label: asString(data.label),
    limit: asNumber(data.limit),
    limitRemaining: asNumber(data.limit_remaining ?? data.limitRemaining),
    limitReset: asString(data.limit_reset ?? data.limitReset),
    usage,
    usageDaily: asNumber(data.usage_daily ?? data.usageDaily) ?? 0,
    usageWeekly: asNumber(data.usage_weekly ?? data.usageWeekly) ?? 0,
    usageMonthly: asNumber(data.usage_monthly ?? data.usageMonthly) ?? 0,
    isFreeTier: asBoolean(data.is_free_tier ?? data.isFreeTier),
    expiresAt: asString(data.expires_at ?? data.expiresAt),
  };
}

export class OpenRouterProvider implements IProviderAdapter {
  private providerCache = new Map<string, { info: ModelProviderInfo; timestamp: number }>();
  private zdrCache: { ids: Set<string>; timestamp: number } | null = null;

  matches(baseUrl: string): boolean {
    return isOpenRouterBaseUrl(baseUrl);
  }

  private getHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...openRouterAppHeaders(),
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    return headers;
  }

  async fetchModels(
    baseUrl: string,
    apiKey: string,
    options: FetchModelsOptions = {}
  ): Promise<ExtendedAIModelInfo[]> {
    const normalizedUrl = normalizeBaseUrl(baseUrl);
    const collected: unknown[] = [];
    const seenUrls = new Set<string>();
    // /models/user drops models the key cannot reach (guardrails, ignored providers, privacy).
    let requestUrl: string | null = apiKey.trim()
      ? `${normalizedUrl}/models/user`
      : `${normalizedUrl}/models`;

    for (let page = 0; requestUrl && page < MAX_MODEL_PAGES; page += 1) {
      if (seenUrls.has(requestUrl)) break;
      seenUrls.add(requestUrl);

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: this.getHeaders(apiKey),
        signal: options.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        throw new Error(
          `Failed to fetch models: ${response.statusText || `HTTP ${response.status}`}`
        );
      }

      const payload = (await response.json()) as OpenRouterModelsResponse;
      if (!Array.isArray(payload.data)) {
        throw new Error('Invalid response format: expected data array');
      }
      collected.push(...payload.data);
      requestUrl = resolveOpenRouterNextUrl(payload.links?.next, requestUrl);
    }

    return mapOpenRouterCatalog({ data: collected }, normalizedUrl);
  }

  getCachedProviderInfo(modelId: string): ModelProviderInfo | undefined {
    const cached = this.providerCache.get(modelId);
    if (!cached) return undefined;
    if (Date.now() - cached.timestamp > PROVIDER_CACHE_TTL_MS) {
      this.providerCache.delete(modelId);
      return undefined;
    }
    return cached.info;
  }

  async fetchModelProviders(
    baseUrl: string,
    apiKey: string,
    modelId: string,
    signal?: AbortSignal
  ): Promise<ModelProviderInfo> {
    const cached = this.getCachedProviderInfo(modelId);
    if (cached) return cached;

    const response = await fetch(openRouterEndpointsUrl(baseUrl, modelId), {
      method: 'GET',
      headers: this.getHeaders(apiKey),
      signal,
    });

    let info: ModelProviderInfo;
    if (response.status === 404) {
      info = mapOpenRouterEndpoints(null, modelId);
    } else if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(
        `Failed to fetch providers: ${response.statusText || `HTTP ${response.status}`}`
      );
    } else {
      info = mapOpenRouterEndpoints(await response.json(), modelId);
    }

    this.providerCache.set(modelId, { info, timestamp: Date.now() });
    return info;
  }

  maySupportProviderSelection(modelId: string): boolean {
    return this.getCachedProviderInfo(modelId)?.supportsProviderSelection ?? true;
  }

  async fetchZdrModelIds(baseUrl: string, signal?: AbortSignal): Promise<Set<string>> {
    if (this.zdrCache && Date.now() - this.zdrCache.timestamp <= PROVIDER_CACHE_TTL_MS) {
      return this.zdrCache.ids;
    }

    const response = await fetch(openRouterZdrUrl(baseUrl), {
      method: 'GET',
      headers: openRouterAppHeaders(),
      signal,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ZDR endpoints: ${response.statusText || `HTTP ${response.status}`}`
      );
    }

    const ids = mapOpenRouterZdrModelIds(await response.json());
    this.zdrCache = { ids, timestamp: Date.now() };
    return ids;
  }

  getChatHeaders(): Record<string, string> {
    return openRouterAppHeaders();
  }

  async fetchKey(
    baseUrl: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<OpenRouterKeyInfo> {
    if (!apiKey.trim()) {
      throw new Error('API key required');
    }

    const response = await fetch(openRouterKeyUrl(baseUrl), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...openRouterAppHeaders(),
      },
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Failed to fetch key usage: ${response.statusText || `HTTP ${response.status}`}`);
    }

    return normalizeOpenRouterKey(await response.json());
  }
}
