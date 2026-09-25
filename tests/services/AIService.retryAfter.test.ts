import { describe, expect, it, vi, afterEach } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/db/characterTypes';
import type { AIConfig, SamplerSettings } from '../../src/db/characterTypes';
import { AIError, AIService, parseRetryAfterMs } from '../../src/services/AIService';

function baseConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    ...DEFAULT_SETTINGS.ai,
    baseUrl: 'https://example.com/v1',
    apiKey: 'secret-api-key',
    modelId: 'test-model',
    enableStreaming: true,
    enableReasoning: false,
    ...overrides,
  };
}

function baseSampler(overrides: Partial<SamplerSettings> = {}): SamplerSettings {
  return {
    ...DEFAULT_SETTINGS.sampler,
    ...overrides,
  };
}

function failedResponse(status: number, retryAfter?: string): Response {
  const headers = new Headers();
  if (retryAfter !== undefined) headers.set('retry-after', retryAfter);
  return new Response(JSON.stringify({ error: { message: `HTTP ${status}` } }), {
    status,
    headers,
  });
}

async function chatError(service: AIService): Promise<AIError> {
  try {
    await service.chat([{ role: 'user', content: 'hi' }]);
  } catch (err) {
    expect(err).toBeInstanceOf(AIError);
    return err as AIError;
  }
  throw new Error('expected chat() to throw');
}

describe('parseRetryAfterMs', () => {
  it('converts delta-seconds to milliseconds', () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
    expect(parseRetryAfterMs('0')).toBe(0);
    expect(parseRetryAfterMs('1.9')).toBe(1900);
  });

  it('ignores missing, empty, negative, and non-numeric values', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs(undefined)).toBeUndefined();
    expect(parseRetryAfterMs('')).toBeUndefined();
    expect(parseRetryAfterMs('   ')).toBeUndefined();
    expect(parseRetryAfterMs('-1')).toBeUndefined();
    expect(parseRetryAfterMs('abc')).toBeUndefined();
    expect(parseRetryAfterMs('Wed, 21 Oct 2015 07:28:00 GMT')).toBeUndefined();
  });
});

describe('AIService Retry-After plumbing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('carries retryAfterMs on a 429 with a Retry-After header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => failedResponse(429, '2')));
    const err = await chatError(new AIService(baseConfig(), baseSampler()));
    expect(err.type).toBe('rate_limit');
    expect(err.statusCode).toBe(429);
    expect(err.retryAfterMs).toBe(2000);
  });

  it('leaves retryAfterMs undefined on a 429 without the header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => failedResponse(429)));
    const err = await chatError(new AIService(baseConfig(), baseSampler()));
    expect(err.type).toBe('rate_limit');
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('carries retryAfterMs on a 5xx with a Retry-After header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => failedResponse(503, '5')));
    const err = await chatError(new AIService(baseConfig(), baseSampler()));
    expect(err.type).toBe('server');
    expect(err.statusCode).toBe(503);
    expect(err.retryAfterMs).toBe(5000);
  });

  it('leaves retryAfterMs undefined on a 5xx without the header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => failedResponse(500)));
    const err = await chatError(new AIService(baseConfig(), baseSampler()));
    expect(err.type).toBe('server');
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('leaves retryAfterMs undefined on non-transient failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => failedResponse(401, '3')));
    const err = await chatError(new AIService(baseConfig(), baseSampler()));
    expect(err.type).toBe('auth');
    expect(err.retryAfterMs).toBeUndefined();
  });
});
