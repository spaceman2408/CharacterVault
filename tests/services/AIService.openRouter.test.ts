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

describe('OpenRouter data-policy errors', () => {
  const ZDR_ERROR = {
    error: {
      code: 404,
      message:
        'No endpoints found matching your data policy (Zero data retention). Configure: https://openrouter.ai/settings/privacy',
      metadata: { failed_routing_step: 'Filter by Data Policy' },
    },
  };

  function failWith(body: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), { status: 404 }))
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names the CharacterVault privacy filters that are on', async () => {
    failWith(ZDR_ERROR);
    const service = new AIService(
      config({ openRouter: { zdrOnly: true, denyDataCollection: true } }),
      DEFAULT_SETTINGS.sampler
    );

    await expect(service.chat([{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      message:
        'API error: No endpoints found matching your data policy (Zero data retention). Configure: https://openrouter.ai/settings/privacy Zero data retention only and No training on prompts are on in Settings → AI Config → OpenRouter Options.',
    });
  });

  it('adds nothing when the filters are off or the error is not about data policy', async () => {
    failWith(ZDR_ERROR);
    await expect(
      new AIService(config({ openRouter: {} }), DEFAULT_SETTINGS.sampler).chat([
        { role: 'user', content: 'hi' },
      ])
    ).rejects.toMatchObject({ message: `API error: ${ZDR_ERROR.error.message}` });

    failWith({ error: { code: 404, message: 'Model not found' } });
    await expect(
      new AIService(config({ openRouter: { zdrOnly: true } }), DEFAULT_SETTINGS.sampler).chat([
        { role: 'user', content: 'hi' },
      ])
    ).rejects.toMatchObject({ message: 'API error: Model not found' });
  });
});
