import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/db/characterTypes';
import type { AIConfig } from '../../src/db/characterTypes';
import { AIService, type ChatCompletionRequestBody } from '../../src/services/AIService';

const TOOLS = [{ name: 'list_entries', description: 'List entries' }];

function config(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    ...DEFAULT_SETTINGS.ai,
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-or-test',
    modelId: 'meta-llama/llama-3.3-70b-instruct',
    enableStreaming: false,
    enableReasoning: false,
    openRouter: { exactoForAgent: true, sort: 'price' },
    ...overrides,
  };
}

function captureRequests(): ChatCompletionRequestBody[] {
  const bodies: ChatCompletionRequestBody[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({
          id: 'gen',
          object: 'chat.completion',
          created: 0,
          model: 'meta-llama/llama-3.3-70b-instruct',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    })
  );
  return bodies;
}

describe('OpenRouter Exacto for tool-calling requests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends :exacto without host priority when the request has tools', async () => {
    const bodies = captureRequests();
    await new AIService(config(), DEFAULT_SETTINGS.sampler).chat(
      [{ role: 'user', content: 'hi' }],
      undefined,
      undefined,
      { tools: TOOLS }
    );

    expect(bodies[0].model).toBe('meta-llama/llama-3.3-70b-instruct:exacto');
    expect(bodies[0].provider).toBeUndefined();
    expect(bodies[0].tools).toHaveLength(1);
  });

  it('leaves requests without tools, or off OpenRouter, unchanged', async () => {
    const bodies = captureRequests();
    await new AIService(config(), DEFAULT_SETTINGS.sampler).chat([{ role: 'user', content: 'hi' }]);
    await new AIService(
      config({ baseUrl: 'https://example.com/v1' }),
      DEFAULT_SETTINGS.sampler
    ).chat([{ role: 'user', content: 'hi' }], undefined, undefined, { tools: TOOLS });

    expect(bodies[0].model).toBe('meta-llama/llama-3.3-70b-instruct');
    expect(bodies[0].provider).toEqual({ sort: 'price' });
    expect(bodies[1].model).toBe('meta-llama/llama-3.3-70b-instruct');
    expect(bodies[1].provider).toBeUndefined();
  });
});
