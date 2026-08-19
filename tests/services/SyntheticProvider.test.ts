import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearCapabilityCaches,
  getCapabilityCache,
} from '../../src/services/chatRequestRepair';
import {
  OpenAICompatProvider,
  SyntheticProvider,
  isSyntheticBaseUrl,
  mapSyntheticCatalog,
  normalizeSyntheticQuotas,
  resolveProvider,
  syntheticQuotasUrl,
} from '../../src/services/providers';

const SAMPLE_CATALOG = {
  data: [
    {
      id: 'hf:nomic-ai/nomic-embed-text-v1.5',
      name: 'nomic-embed-text-v1.5',
      output_modalities: ['embedding'],
      context_length: 8192,
    },
    {
      id: 'hf:zai-org/GLM-5.2',
      name: 'zai-org/GLM-5.2',
      context_length: 524288,
      pricing: { prompt: '$0.000001', completion: '$0.000003' },
      reasoning_parameters: { efforts: ['none', 'high', 'max'] },
      output_modalities: ['text'],
    },
    {
      id: 'syn:small:text',
      name: 'syn:small:text',
      context_length: 196608,
      output_modalities: ['text'],
    },
    {
      id: 'syn:large:text',
      name: 'syn:large:text',
      context_length: 524288,
      output_modalities: ['text'],
      reasoning_parameters: { efforts: ['none', 'high', 'max'] },
    },
    {
      id: 'hf:Qwen/Qwen3.6-27B',
      name: 'Qwen/Qwen3.6-27B',
      context_length: 262144,
      output_modalities: ['text', 'image'],
    },
  ],
};

describe('isSyntheticBaseUrl / resolveProvider', () => {
  it('matches official and OpenAI-path Synthetic URLs', () => {
    expect(isSyntheticBaseUrl('https://api.synthetic.new/v1')).toBe(true);
    expect(isSyntheticBaseUrl('https://api.synthetic.new/openai/v1')).toBe(true);
    expect(isSyntheticBaseUrl('https://nano-gpt.com/api/v1')).toBe(false);
  });

  it('resolves Synthetic before the OpenAI-compat fallback', () => {
    expect(resolveProvider('https://api.synthetic.new/v1')).toBeInstanceOf(SyntheticProvider);
    expect(resolveProvider('https://openrouter.ai/api/v1')).toBeInstanceOf(OpenAICompatProvider);
  });
});

describe('mapSyntheticCatalog', () => {
  afterEach(() => {
    clearCapabilityCaches();
  });

  it('drops embeddings, labels aliases, and sorts syn: models first', () => {
    const models = mapSyntheticCatalog(SAMPLE_CATALOG);
    expect(models.map((model) => model.id)).toEqual([
      'syn:large:text',
      'syn:small:text',
      'hf:Qwen/Qwen3.6-27B',
      'hf:zai-org/GLM-5.2',
    ]);
    expect(models[0].name).toBe('Large text');
    expect(models[1].name).toBe('Small text');
    expect(models[2].name).toBe('Qwen/Qwen3.6-27B');
    expect(models.find((model) => model.id === 'hf:zai-org/GLM-5.2')?.contextLength).toBe(524288);
    expect(models.find((model) => model.id === 'hf:zai-org/GLM-5.2')?.pricing).toEqual({
      prompt: 0.000001,
      completion: 0.000003,
    });
  });

  it('seeds reasoning effort allowlists when a cache base URL is provided', () => {
    mapSyntheticCatalog(SAMPLE_CATALOG, 'https://api.synthetic.new/v1');
    expect(getCapabilityCache('https://api.synthetic.new/v1', 'syn:large:text').effortAllowlist).toEqual(
      ['none', 'high', 'max']
    );
  });

  it('rejects a non-array payload', () => {
    expect(() => mapSyntheticCatalog({})).toThrow(/expected data array/);
  });
});

describe('normalizeSyntheticQuotas', () => {
  it('reads subscription request windows', () => {
    expect(
      normalizeSyntheticQuotas({
        subscription: { limit: 135, requests: 12, renewsAt: '2025-09-21T14:36:14.288Z' },
      })
    ).toEqual({
      subscription: {
        limit: 135,
        requests: 12,
        renewsAt: '2025-09-21T14:36:14.288Z',
      },
      searchHourly: null,
      freeToolCalls: null,
      weeklyTokenLimit: null,
      rollingFiveHourLimit: null,
    });
  });

  it('accepts snake_case renews_at', () => {
    expect(
      normalizeSyntheticQuotas({
        subscription: { limit: 10, requests: 1, renews_at: '2026-01-01T00:00:00.000Z' },
      }).subscription?.renewsAt
    ).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns a null subscription when the window is incomplete', () => {
    expect(normalizeSyntheticQuotas({ subscription: { limit: 10 } }).subscription).toBeNull();
  });

  it('reads the live five-hour and weekly fields (subscription.requests stays 0)', () => {
    const quotas = normalizeSyntheticQuotas({
      subscription: { limit: 500, requests: 0, renewsAt: '2026-08-19T20:18:11.436Z' },
      search: { hourly: { limit: 250, requests: 0, renewsAt: '2026-08-19T16:18:11.437Z' } },
      freeToolCalls: { limit: 0, requests: 0, renewsAt: '2026-08-20T15:18:11.441Z' },
      weeklyTokenLimit: {
        nextRegenAt: '2026-08-19T16:19:42.000Z',
        percentRemaining: 99.98130416666666,
        maxCredits: '$24.00',
        remainingCredits: '$23.99',
        nextRegenCredits: '$0.48',
      },
      rollingFiveHourLimit: {
        nextTickAt: '2026-08-19T15:27:19.000Z',
        tickPercent: 0.05,
        remaining: 498.9,
        max: 500,
        limited: false,
      },
    });

    expect(quotas.subscription?.requests).toBe(0);
    expect(quotas.searchHourly).toEqual({
      limit: 250,
      requests: 0,
      renewsAt: '2026-08-19T16:18:11.437Z',
    });
    expect(quotas.rollingFiveHourLimit).toMatchObject({
      remaining: 498.9,
      max: 500,
      limited: false,
    });
    expect(quotas.weeklyTokenLimit).toMatchObject({
      maxCredits: '$24.00',
      remainingCredits: '$23.99',
      maxCreditsAmount: 24,
      remainingCreditsAmount: 23.99,
      percentRemaining: 99.98130416666666,
    });
  });
});

describe('SyntheticProvider network methods', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearCapabilityCaches();
  });

  it('fetches and maps /models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(url).toBe('https://api.synthetic.new/v1/models');
        return {
          ok: true,
          json: async () => SAMPLE_CATALOG,
        };
      })
    );

    const models = await new SyntheticProvider().fetchModels(
      'https://api.synthetic.new/v1/',
      'sk-test'
    );
    expect(models[0].id).toBe('syn:large:text');
    expect(models.some((model) => model.id.includes('embed'))).toBe(false);
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
      new SyntheticProvider().fetchModels('https://api.synthetic.new/v1', 'bad')
    ).rejects.toThrow('Invalid API key');
  });

  it('fetches quotas from origin /v2/quotas', async () => {
    expect(syntheticQuotasUrl('https://api.synthetic.new/v1')).toBe(
      'https://api.synthetic.new/v2/quotas'
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe('https://api.synthetic.new/v2/quotas');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer sk-test' });
        return {
          ok: true,
          json: async () => ({
            subscription: { limit: 135, requests: 0, renewsAt: '2025-09-21T14:36:14.288Z' },
          }),
        };
      })
    );

    const quotas = await new SyntheticProvider().fetchQuotas(
      'https://api.synthetic.new/v1',
      'sk-test'
    );
    expect(quotas.subscription?.limit).toBe(135);
    expect(quotas.subscription?.requests).toBe(0);
    expect(quotas.rollingFiveHourLimit).toBeNull();
  });

  it('forwards an AbortSignal to /v2/quotas', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.signal).toBe(controller.signal);
        return {
          ok: true,
          json: async () => ({
            subscription: { limit: 500, requests: 0 },
          }),
        };
      })
    );

    await new SyntheticProvider().fetchQuotas(
      'https://api.synthetic.new/v1',
      'sk-test',
      controller.signal
    );
  });
});
