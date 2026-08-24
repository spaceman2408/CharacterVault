import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearCapabilityCaches,
  getCapabilityCache,
} from '../../src/services/chatRequestRepair';
import {
  OpenRouterProvider,
  SyntheticProvider,
  isOpenRouterBaseUrl,
  mapOpenRouterCatalog,
  normalizeOpenRouterKey,
  openRouterAppHeaders,
  openRouterKeyUrl,
  resolveOpenRouterNextUrl,
  resolveProvider,
} from '../../src/services/providers';

const SAMPLE_CATALOG = {
  data: [
    {
      id: 'openai/text-embedding-3-small',
      name: 'OpenAI: Text Embedding 3 Small',
      architecture: { output_modalities: ['embeddings'] },
      context_length: 8191,
    },
    {
      id: 'openai/gpt-4o',
      name: 'OpenAI: GPT-4o',
      context_length: 128000,
      pricing: { prompt: '0.0000025', completion: '0.00001' },
      architecture: { output_modalities: ['text'] },
      reasoning: { supported_efforts: ['minimal', 'low', 'medium', 'high'] },
    },
    {
      id: 'black-forest-labs/flux.1-schnell',
      name: 'Flux.1 Schnell',
      architecture: { output_modalities: ['image'] },
    },
    {
      id: 'anthropic/claude-sonnet-4.5',
      name: 'Anthropic: Claude Sonnet 4.5',
      context_length: 200000,
      pricing: { prompt: '0.000003', completion: '0.000015' },
      architecture: { output_modalities: ['text'] },
    },
  ],
};

describe('isOpenRouterBaseUrl / resolveProvider', () => {
  it('matches official OpenRouter URLs', () => {
    expect(isOpenRouterBaseUrl('https://openrouter.ai/api/v1')).toBe(true);
    expect(isOpenRouterBaseUrl('https://openrouter.ai/api/v1/')).toBe(true);
    expect(isOpenRouterBaseUrl('https://api.synthetic.new/v1')).toBe(false);
  });

  it('resolves OpenRouter before the OpenAI-compat fallback', () => {
    expect(resolveProvider('https://openrouter.ai/api/v1')).toBeInstanceOf(OpenRouterProvider);
    expect(resolveProvider('https://api.synthetic.new/v1')).toBeInstanceOf(SyntheticProvider);
  });
});

describe('mapOpenRouterCatalog', () => {
  afterEach(() => {
    clearCapabilityCaches();
  });

  it('drops embeddings and image-only models, and uses display names', () => {
    const models = mapOpenRouterCatalog(SAMPLE_CATALOG);
    expect(models.map((model) => model.id)).toEqual([
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-4o',
    ]);
    expect(models[0].name).toBe('Anthropic: Claude Sonnet 4.5');
    expect(models.find((model) => model.id === 'openai/gpt-4o')?.contextLength).toBe(128000);
    expect(models.find((model) => model.id === 'openai/gpt-4o')?.pricing).toEqual({
      prompt: 0.0000025,
      completion: 0.00001,
    });
  });

  it('seeds reasoning effort allowlists when a cache base URL is provided', () => {
    mapOpenRouterCatalog(SAMPLE_CATALOG, 'https://openrouter.ai/api/v1');
    expect(
      getCapabilityCache('https://openrouter.ai/api/v1', 'openai/gpt-4o').effortAllowlist
    ).toEqual(['minimal', 'low', 'medium', 'high']);
  });

  it('rejects a non-array payload', () => {
    expect(() => mapOpenRouterCatalog({})).toThrow(/expected data array/);
  });
});

describe('normalizeOpenRouterKey', () => {
  it('reads usage and an optional spending cap from data', () => {
    expect(
      normalizeOpenRouterKey({
        data: {
          label: 'vault',
          limit: 100,
          limit_remaining: 74.5,
          limit_reset: 'monthly',
          usage: 25.5,
          usage_daily: 1.2,
          usage_weekly: 8.4,
          usage_monthly: 25.5,
          is_free_tier: false,
          expires_at: '2027-12-31T23:59:59Z',
        },
      })
    ).toEqual({
      label: 'vault',
      limit: 100,
      limitRemaining: 74.5,
      limitReset: 'monthly',
      usage: 25.5,
      usageDaily: 1.2,
      usageWeekly: 8.4,
      usageMonthly: 25.5,
      isFreeTier: false,
      expiresAt: '2027-12-31T23:59:59Z',
    });
  });

  it('treats a null limit as unlimited', () => {
    const key = normalizeOpenRouterKey({
      data: {
        limit: null,
        limit_remaining: null,
        limit_reset: null,
        usage: 0,
        is_free_tier: true,
      },
    });
    expect(key.limit).toBeNull();
    expect(key.limitRemaining).toBeNull();
    expect(key.isFreeTier).toBe(true);
    expect(key.usageDaily).toBe(0);
  });

  it('rejects a payload with no usage', () => {
    expect(() => normalizeOpenRouterKey({ data: { label: 'x' } })).toThrow(/Invalid key response/);
  });
});

describe('resolveOpenRouterNextUrl', () => {
  it('resolves a relative pagination path against the request URL', () => {
    expect(
      resolveOpenRouterNextUrl(
        '/api/v1/models?offset=500&limit=500',
        'https://openrouter.ai/api/v1/models'
      )
    ).toBe('https://openrouter.ai/api/v1/models?offset=500&limit=500');
  });

  it('returns null when there is no next page', () => {
    expect(resolveOpenRouterNextUrl(null, 'https://openrouter.ai/api/v1/models')).toBeNull();
  });
});

describe('OpenRouterProvider network methods', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearCapabilityCaches();
  });

  it('fetches /models without a page limit and maps the catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(url).toBe('https://openrouter.ai/api/v1/models');
        return {
          ok: true,
          json: async () => SAMPLE_CATALOG,
        };
      })
    );

    const models = await new OpenRouterProvider().fetchModels(
      'https://openrouter.ai/api/v1/',
      'sk-or-test'
    );
    expect(models.map((model) => model.id)).toEqual([
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-4o',
    ]);
  });

  it('follows links.next when the catalog is paginated', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://openrouter.ai/api/v1/models') {
        return {
          ok: true,
          json: async () => ({
            data: [SAMPLE_CATALOG.data[3]],
            links: { next: '/api/v1/models?offset=500&limit=500' },
          }),
        };
      }
      expect(url).toBe('https://openrouter.ai/api/v1/models?offset=500&limit=500');
      return {
        ok: true,
        json: async () => ({
          data: [SAMPLE_CATALOG.data[1]],
          links: { next: null },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const models = await new OpenRouterProvider().fetchModels(
      'https://openrouter.ai/api/v1',
      'sk-or-test'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(models.map((model) => model.id)).toEqual([
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-4o',
    ]);
  });

  it('maps 401 on /models to Invalid API key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }))
    );

    await expect(
      new OpenRouterProvider().fetchModels('https://openrouter.ai/api/v1', 'bad')
    ).rejects.toThrow('Invalid API key');
  });

  it('fetches key usage from /key and forwards AbortSignal', async () => {
    expect(openRouterKeyUrl('https://openrouter.ai/api/v1')).toBe(
      'https://openrouter.ai/api/v1/key'
    );

    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe('https://openrouter.ai/api/v1/key');
        expect(init?.signal).toBe(controller.signal);
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer sk-or-test',
          ...openRouterAppHeaders(),
        });
        return {
          ok: true,
          json: async () => ({
            data: { usage: 1.25, usage_daily: 0.1, is_free_tier: false, limit: null },
          }),
        };
      })
    );

    const key = await new OpenRouterProvider().fetchKey(
      'https://openrouter.ai/api/v1',
      'sk-or-test',
      controller.signal
    );
    expect(key.usage).toBe(1.25);
    expect(key.limit).toBeNull();
  });

  it('sends attribution headers on chat requests', () => {
    expect(new OpenRouterProvider().getChatHeaders()).toEqual(openRouterAppHeaders());
    expect(openRouterAppHeaders()['HTTP-Referer']).toBe(
      'https://vault.charactervault.app'
    );
    expect(openRouterAppHeaders()['X-OpenRouter-Title']).toBe('CharacterVault');
  });
});
