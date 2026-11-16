import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/db/characterTypes';
import type { AIConfig } from '../../src/db/characterTypes';
import { AIService, parsePromptUsage } from '../../src/services/AIService';
import { clearCapabilityCaches } from '../../src/services/chatRequestRepair';

const OPENROUTER = 'https://openrouter.ai/api/v1';
const NANOGPT = 'https://nano-gpt.com/api/v1';

function config(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    ...DEFAULT_SETTINGS.ai,
    baseUrl: OPENROUTER,
    apiKey: 'secret-api-key',
    modelId: 'anthropic/claude-sonnet-4.5',
    enableStreaming: false,
    enableReasoning: false,
    ...overrides,
  };
}

function jsonReply(usage?: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
      usage,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

async function sentBody(
  overrides: Partial<AIConfig>,
  options: { cachePrompt?: boolean } = { cachePrompt: true },
  onChunk?: () => void,
): Promise<Record<string, unknown>> {
  const fetchMock = vi.fn(async () => jsonReply());
  vi.stubGlobal('fetch', fetchMock);
  const service = new AIService(config(overrides), DEFAULT_SETTINGS.sampler);
  await service.chat([{ role: 'user', content: 'hi' }], undefined, onChunk, options);
  const init = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
  return JSON.parse(init[1].body) as Record<string, unknown>;
}

describe('AIService prompt cache markers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearCapabilityCaches();
  });

  it('marks Claude requests cacheable on OpenRouter', async () => {
    const body = await sentBody({});
    expect(body.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('sends no marker for other models or without cachePrompt', async () => {
    expect((await sentBody({ modelId: 'openai/gpt-5' })).cache_control).toBeUndefined();
    expect(
      (await sentBody({ modelId: 'Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled' })).cache_control,
    ).toBeUndefined();
    expect((await sentBody({ modelId: '~anthropic/claude-sonnet-latest' })).cache_control).toEqual({
      type: 'ephemeral',
    });
    expect((await sentBody({}, {})).cache_control).toBeUndefined();
  });

  it('sends no marker to hosts that are not OpenRouter or NanoGPT', async () => {
    const body = await sentBody({ baseUrl: 'https://example.com/v1', modelId: 'claude-sonnet-4-5' });
    expect(body.cache_control).toBeUndefined();
    expect(body.prompt_caching).toBeUndefined();
  });

  it('sends NanoGPT no Claude marker, with or without cache routing', async () => {
    const off = await sentBody({ baseUrl: NANOGPT, modelId: 'anthropic/claude-haiku-5.5' });
    expect(off.prompt_caching).toBeUndefined();
    expect(off.cache_control).toBeUndefined();
    const on = await sentBody({
      baseUrl: NANOGPT,
      modelId: 'anthropic/claude-haiku-5.5',
      enableCacheProviderRouting: true,
    });
    expect(on.prompt_caching).toBeUndefined();
    expect(on.cache_control).toBeUndefined();
    expect(on.caching).toBe(true);
  });

  it('asks NanoGPT and OpenAI for usage on streams only', async () => {
    const streamed = await sentBody(
      { baseUrl: NANOGPT, enableStreaming: true },
      { cachePrompt: true },
      () => {},
    );
    expect(streamed.stream_options).toEqual({ include_usage: true });
    const openai = await sentBody(
      { baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-5', enableStreaming: true },
      { cachePrompt: true },
      () => {},
    );
    expect(openai.stream_options).toEqual({ include_usage: true });
    expect((await sentBody({ baseUrl: NANOGPT })).stream_options).toBeUndefined();
    const other = await sentBody(
      { baseUrl: 'https://example.com/v1', enableStreaming: true },
      { cachePrompt: true },
      () => {},
    );
    expect(other.stream_options).toBeUndefined();
  });
});

describe('AIService prompt usage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads OpenAI-style, NanoGPT-style, and DeepSeek-style cache reads', () => {
    expect(
      parsePromptUsage({ prompt_tokens: 1000, prompt_tokens_details: { cached_tokens: 800 } }),
    ).toEqual({ promptTokens: 1000, cachedTokens: 800 });
    expect(parsePromptUsage({ prompt_tokens: 8500, cache_read_input_tokens: 8000 })).toEqual({
      promptTokens: 8500,
      cachedTokens: 8000,
    });
    expect(parsePromptUsage({ prompt_tokens: 500, prompt_cache_hit_tokens: 0 })).toEqual({
      promptTokens: 500,
      cachedTokens: 0,
    });
  });

  it('leaves cachedTokens unset when the host does not report it', () => {
    expect(parsePromptUsage({ prompt_tokens: 1000 })).toEqual({ promptTokens: 1000 });
    expect(parsePromptUsage(undefined)).toBeUndefined();
    expect(parsePromptUsage({ completion_tokens: 3 })).toBeUndefined();
  });

  it('adds cache reads and writes back when prompt_tokens leaves them out', () => {
    expect(
      parsePromptUsage({
        prompt_tokens: 50,
        cache_read_input_tokens: 900,
        cache_creation_input_tokens: 50,
      }),
    ).toEqual({ promptTokens: 1000, cachedTokens: 900 });
  });

  it('returns usage from a non-streamed reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonReply({ prompt_tokens: 1200, prompt_tokens_details: { cached_tokens: 1000 } }),
      ),
    );
    const service = new AIService(config(), DEFAULT_SETTINGS.sampler);
    const reply = await service.chat([{ role: 'user', content: 'hi' }]);
    expect(reply.usage).toEqual({ promptTokens: 1200, cachedTokens: 1000 });
  });

  it('returns usage from a trailing stream chunk with no choices', async () => {
    const chunks = [
      { choices: [{ index: 0, delta: { content: 'hi' }, finish_reason: 'stop' }] },
      { choices: [], usage: { prompt_tokens: 400, prompt_tokens_details: { cached_tokens: 300 } } },
    ];
    const text = chunks.map((chunk) => 'data: ' + JSON.stringify(chunk) + '\n\n').join('') + 'data: [DONE]\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new TextEncoder().encode(text), { status: 200 })),
    );
    const service = new AIService(config({ enableStreaming: true }), DEFAULT_SETTINGS.sampler);
    const reply = await service.chat([{ role: 'user', content: 'hi' }], undefined, () => {});
    expect(reply.content).toBe('hi');
    expect(reply.usage).toEqual({ promptTokens: 400, cachedTokens: 300 });
  });
});
