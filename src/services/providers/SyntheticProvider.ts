import {
  getCapabilityCache,
  recordSupportedEfforts,
} from '../chatRequestRepair';
import type {
  IProviderAdapter,
  FetchModelsOptions,
  ExtendedAIModelInfo,
  ModelProviderInfo,
  SyntheticQuotas,
  SyntheticQuotaWindow,
  SyntheticRollingFiveHourLimit,
  SyntheticWeeklyTokenLimit,
} from './types';

interface SyntheticModel {
  id?: string;
  name?: string;
  context_length?: number;
  contextLength?: number;
  hugging_face_id?: string;
  output_modalities?: string[];
  outputModalities?: string[];
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
  };
  reasoning_parameters?: { efforts?: string[] };
  reasoningParameters?: { efforts?: string[] };
}

interface SyntheticModelsResponse {
  object?: string;
  data?: SyntheticModel[];
}

const SYN_ALIAS_LABELS: Record<string, string> = {
  'syn:large:text': 'Large text',
  'syn:small:text': 'Small text',
  'syn:large:vision': 'Large vision',
  'syn:small:vision': 'Small vision',
};

const SYN_ALIAS_ORDER = [
  'syn:large:text',
  'syn:small:text',
  'syn:large:vision',
  'syn:small:vision',
] as const;

export function isSyntheticBaseUrl(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes('synthetic.new');
}

export function syntheticQuotasUrl(baseUrl: string): string {
  try {
    return `${new URL(baseUrl).origin}/v2/quotas`;
  } catch {
    return 'https://api.synthetic.new/v2/quotas';
  }
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

function outputModalities(model: SyntheticModel): string[] | undefined {
  const raw = model.output_modalities ?? model.outputModalities;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : undefined;
}

export function isSyntheticChatModel(model: SyntheticModel): boolean {
  const id = (model.id ?? '').toLowerCase();
  if (!id) return false;
  if (/(?:^|[/_:.-])embed(?:ding)?s?(?:$|[/_:.-])/.test(id)) return false;

  const outputs = outputModalities(model);
  if (outputs && outputs.length > 0 && !outputs.includes('text')) return false;

  return true;
}

export function displayNameForSyntheticModel(model: SyntheticModel): string {
  const id = model.id ?? '';
  const known = SYN_ALIAS_LABELS[id];
  if (known) return known;

  if (id.startsWith('syn:')) {
    const parts = id
      .slice(4)
      .split(':')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    }
  }

  if (model.name && model.name !== id) return model.name;

  const slash = id.lastIndexOf('/');
  if (slash >= 0 && slash < id.length - 1) return id.slice(slash + 1);

  return id;
}

function sortRank(id: string): number {
  const aliasIndex = SYN_ALIAS_ORDER.indexOf(id as (typeof SYN_ALIAS_ORDER)[number]);
  if (aliasIndex !== -1) return aliasIndex;
  if (id.startsWith('syn:')) return SYN_ALIAS_ORDER.length;
  return SYN_ALIAS_ORDER.length + 1;
}

export function sortSyntheticModels(models: ExtendedAIModelInfo[]): ExtendedAIModelInfo[] {
  return [...models].sort((a, b) => {
    const rankDiff = sortRank(a.id) - sortRank(b.id);
    if (rankDiff !== 0) return rankDiff;
    return a.id.localeCompare(b.id);
  });
}

function parsePricing(model: SyntheticModel): ExtendedAIModelInfo['pricing'] | undefined {
  const prompt = asNumber(model.pricing?.prompt);
  const completion = asNumber(model.pricing?.completion);
  if (prompt === null && completion === null) return undefined;
  return {
    prompt: prompt ?? 0,
    completion: completion ?? 0,
  };
}

function reasoningEfforts(model: SyntheticModel): string[] | undefined {
  const efforts = model.reasoning_parameters?.efforts ?? model.reasoningParameters?.efforts;
  if (!Array.isArray(efforts)) return undefined;
  const cleaned = efforts
    .filter((effort): effort is string => typeof effort === 'string')
    .map((effort) => effort.trim().toLowerCase())
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function mapSyntheticCatalog(data: unknown, cacheBaseUrl?: string): ExtendedAIModelInfo[] {
  const payload = data as SyntheticModelsResponse;
  if (!Array.isArray(payload?.data)) {
    throw new Error('Invalid response format: expected data array');
  }

  const models: ExtendedAIModelInfo[] = [];
  for (const model of payload.data) {
    if (!isSyntheticChatModel(model) || !model.id) continue;

    const mapped: ExtendedAIModelInfo = {
      id: model.id,
      name: displayNameForSyntheticModel(model),
      contextLength: model.context_length ?? model.contextLength,
      pricing: parsePricing(model),
    };
    models.push(mapped);

    const efforts = reasoningEfforts(model);
    if (efforts && cacheBaseUrl) {
      recordSupportedEfforts(getCapabilityCache(cacheBaseUrl, model.id), efforts);
    }
  }

  return sortSyntheticModels(models);
}

function parseQuotaWindow(raw: unknown): SyntheticQuotaWindow | null {
  if (!raw || typeof raw !== 'object') return null;
  const window = raw as Record<string, unknown>;
  const limit = asNumber(window.limit) ?? asNumber(window.max);
  const requests = asNumber(window.requests) ?? asNumber(window.used);
  if (limit === null || requests === null) return null;
  return {
    limit,
    requests,
    renewsAt: asString(window.renewsAt) ?? asString(window.renews_at),
  };
}

function parseWeeklyTokenLimit(raw: unknown): SyntheticWeeklyTokenLimit | null {
  if (!raw || typeof raw !== 'object') return null;
  const weekly = raw as Record<string, unknown>;
  const maxCredits = asString(weekly.maxCredits) ?? asString(weekly.max_credits);
  const remainingCredits =
    asString(weekly.remainingCredits) ?? asString(weekly.remaining_credits);
  const maxCreditsAmount = asNumber(weekly.maxCreditsAmount) ?? asNumber(maxCredits);
  const remainingCreditsAmount =
    asNumber(weekly.remainingCreditsAmount) ?? asNumber(remainingCredits);
  const percentRemaining =
    asNumber(weekly.percentRemaining) ?? asNumber(weekly.percent_remaining);

  if (
    maxCredits === null &&
    remainingCredits === null &&
    maxCreditsAmount === null &&
    remainingCreditsAmount === null &&
    percentRemaining === null
  ) {
    return null;
  }

  return {
    percentRemaining,
    maxCredits,
    remainingCredits,
    maxCreditsAmount,
    remainingCreditsAmount,
    nextRegenAt: asString(weekly.nextRegenAt) ?? asString(weekly.next_regen_at),
    nextRegenCredits: asString(weekly.nextRegenCredits) ?? asString(weekly.next_regen_credits),
  };
}

function parseRollingFiveHourLimit(raw: unknown): SyntheticRollingFiveHourLimit | null {
  if (!raw || typeof raw !== 'object') return null;
  const rolling = raw as Record<string, unknown>;
  const remaining = asNumber(rolling.remaining);
  const max = asNumber(rolling.max) ?? asNumber(rolling.limit);
  if (remaining === null || max === null) return null;
  return {
    remaining,
    max,
    nextTickAt: asString(rolling.nextTickAt) ?? asString(rolling.next_tick_at),
    tickPercent: asNumber(rolling.tickPercent) ?? asNumber(rolling.tick_percent),
    limited: Boolean(rolling.limited),
  };
}

export function normalizeSyntheticQuotas(raw: unknown): SyntheticQuotas {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid quotas response');
  }

  const root = raw as Record<string, unknown>;
  const searchRaw =
    root.search && typeof root.search === 'object'
      ? (root.search as Record<string, unknown>)
      : null;

  return {
    subscription: parseQuotaWindow(root.subscription),
    searchHourly: parseQuotaWindow(searchRaw?.hourly),
    freeToolCalls: parseQuotaWindow(root.freeToolCalls ?? root.free_tool_calls),
    weeklyTokenLimit: parseWeeklyTokenLimit(
      root.weeklyTokenLimit ?? root.weekly_token_limit
    ),
    rollingFiveHourLimit: parseRollingFiveHourLimit(
      root.rollingFiveHourLimit ?? root.rolling_five_hour_limit
    ),
  };
}

export class SyntheticProvider implements IProviderAdapter {
  matches(baseUrl: string): boolean {
    return isSyntheticBaseUrl(baseUrl);
  }

  private getHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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

    return mapSyntheticCatalog(await response.json(), normalizedUrl);
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
    return {};
  }

  async fetchQuotas(baseUrl: string, apiKey: string): Promise<SyntheticQuotas> {
    if (!apiKey.trim()) {
      throw new Error('API key required');
    }

    const response = await fetch(syntheticQuotasUrl(baseUrl), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Failed to fetch quotas: ${response.statusText || `HTTP ${response.status}`}`);
    }

    return normalizeSyntheticQuotas(await response.json());
  }
}
