import {
  getCapabilityCache,
  recordSupportedEfforts,
} from '../chatRequestRepair';
import type {
  IProviderAdapter,
  FetchModelsOptions,
  ExtendedAIModelInfo,
  ModelProviderInfo,
  OpenRouterKeyInfo,
} from './types';

export const OPENROUTER_APP_TITLE = 'CharacterVault';
export const OPENROUTER_APP_URL = 'https://vault.charactervault.app';

const MAX_MODEL_PAGES = 20;

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

export function isOpenRouterBaseUrl(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes('openrouter.ai');
}

export function openRouterKeyUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/key`;
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
    _options: FetchModelsOptions = {}
  ): Promise<ExtendedAIModelInfo[]> {
    void _options;
    const normalizedUrl = normalizeBaseUrl(baseUrl);
    const collected: unknown[] = [];
    const seenUrls = new Set<string>();
    let requestUrl: string | null = `${normalizedUrl}/models`;

    for (let page = 0; requestUrl && page < MAX_MODEL_PAGES; page += 1) {
      if (seenUrls.has(requestUrl)) break;
      seenUrls.add(requestUrl);

      const response = await fetch(requestUrl, {
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

  maySupportProviderSelection(): boolean {
    return false;
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
