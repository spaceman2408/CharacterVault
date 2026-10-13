import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/db/characterTypes';
import type { AIConfig } from '../../src/db/characterTypes';
import { AIError, AIService, type ChatCompletionRequestBody } from '../../src/services/AIService';
import { clearCapabilityCaches, getCapabilityCache } from '../../src/services/chatRequestRepair';

function config(): AIConfig {
  return {
    ...DEFAULT_SETTINGS.ai,
    baseUrl: 'https://example.com/v1',
    apiKey: 'test-key',
    modelId: 'test-model',
    enableStreaming: false,
    enableReasoning: true,
    reasoningEffort: 'high',
  };
}

const UNRELATED_400 = {
  error: { message: 'This model maximum context length is 8192 tokens.', type: 'invalid_request_error' },
};

function ok(): Response {
  return new Response(
    JSON.stringify({
      id: 'gen',
      object: 'chat.completion',
      created: 0,
      model: 'test-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function stubFetch(statuses: number[]): ChatCompletionRequestBody[] {
  const bodies: ChatCompletionRequestBody[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      const status = statuses[bodies.length - 1] ?? 200;
      if (status === 200) return ok();
      return new Response(JSON.stringify(UNRELATED_400), { status });
    }),
  );
  return bodies;
}

async function chat(): Promise<unknown> {
  try {
    return await new AIService(config(), DEFAULT_SETTINGS.sampler).chat([{ role: 'user', content: 'hi' }]);
  } catch (err) {
    return err;
  }
}

describe('AIService blind 400 retry', () => {
  beforeEach(() => {
    clearCapabilityCaches();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not remember the stripped params when the retry fails the same way', async () => {
    const bodies = stubFetch([400, 400, 400, 400]);
    expect(await chat()).toBeInstanceOf(AIError);
    expect(bodies[0].reasoning_effort).toBe('high');
    expect(bodies[1].reasoning_effort).toBeUndefined();
    expect([...getCapabilityCache('https://example.com/v1', 'test-model').rejectedParams]).toEqual([]);

    const next = stubFetch([200]);
    await chat();
    expect(next[0].reasoning_effort).toBe('high');
  });

  it('remembers the stripped params when the retry succeeds', async () => {
    const bodies = stubFetch([400, 200]);
    await chat();
    expect(bodies).toHaveLength(2);
    expect(getCapabilityCache('https://example.com/v1', 'test-model').rejectedParams.has('reasoning_effort')).toBe(true);
  });
});
