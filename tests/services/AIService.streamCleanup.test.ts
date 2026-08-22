import { describe, expect, it, vi, afterEach } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/db/characterTypes';
import type { AIConfig, SamplerSettings } from '../../src/db/characterTypes';
import { AIService } from '../../src/services/AIService';
import { ReasoningParser } from '../../src/services/ReasoningParser';

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

function sseChunk(delta: { content?: string; reasoning?: string }): string {
  const payload = {
    id: 'chunk',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test-model',
    choices: [
      {
        index: 0,
        delta: {
          content: delta.content,
          reasoning: delta.reasoning,
        },
        finish_reason: null,
      },
    ],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function streamFromParts(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= parts.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(parts[i++]));
    },
  });
}

describe('AIService stream cleanup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not start a request after abort()', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new AIService(baseConfig(), baseSampler());
    service.abort();

    await expect(
      service.chat([{ role: 'user', content: 'hi' }]),
    ).rejects.toMatchObject({ message: 'Request was cancelled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dispose aborts the in-flight controller and keeps sticky aborted state', () => {
    const service = new AIService(baseConfig(), baseSampler());
    const controller = new AbortController();
    const internal = service as unknown as {
      abortController: AbortController | null;
      aborted: boolean;
      isAborted: () => boolean;
    };
    internal.abortController = controller;

    service.dispose();

    expect(controller.signal.aborted).toBe(true);
    expect(internal.abortController).toBeNull();
    expect(internal.aborted).toBe(true);
    expect(internal.isAborted()).toBe(true);
  });

  it('ReasoningParser.reset clears accumulated stream strings', () => {
    const parser = new ReasoningParser();
    parser.parseChunk(
      {
        id: '1',
        object: 'chat.completion.chunk',
        created: 0,
        model: 'qwen-test',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello from the model' },
            finish_reason: null,
          },
        ],
      },
      'qwen-test'
    );
    const before = parser.flush();
    expect(before.content.length).toBeGreaterThan(0);

    parser.reset();
    const after = parser.flush();
    expect(after.content).toBe('');
    expect(after.reasoning).toBe('');
  });

  it('streaming success returns content and finishes cleanly', async () => {
    const body = streamFromParts([
      sseChunk({ content: 'Hi' }),
      sseChunk({ content: ' there' }),
      'data: [DONE]\n\n',
    ]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      })
    );

    const service = new AIService(baseConfig(), baseSampler());
    const chunks: string[] = [];
    const result = await service.askAIWithConversation(
      'hello',
      [],
      [],
      undefined,
      chunk => {
        if (chunk.content) chunks.push(chunk.content);
      }
    );

    expect(result.content).toContain('Hi');
    expect(result.content).toContain('there');
    expect(chunks.join('')).toContain('Hi');
  });

  it('resolves on [DONE] even when the stream never closes', async () => {
    const encoder = new TextEncoder();
    const parts = [sseChunk({ content: 'Hi' }), 'data: [DONE]\n\n'];
    let i = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < parts.length) {
          controller.enqueue(encoder.encode(parts[i++]));
          return;
        }
        return new Promise<void>(() => {});
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      })
    );

    const service = new AIService(baseConfig(), baseSampler());
    const chat = service.askAIWithConversation('hello', [], [], undefined, () => {});
    const result = await Promise.race([
      chat,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('stream did not end on [DONE]')), 2000)
      ),
    ]);

    expect(result.content).toContain('Hi');
  });

  it('recognizes [DONE] split across network chunks', async () => {
    const body = streamFromParts([
      sseChunk({ content: 'Hi' }),
      'data: [DON',
      'E]\n\n',
    ]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      })
    );

    const service = new AIService(baseConfig(), baseSampler());
    const result = await service.askAIWithConversation('hello', [], [], undefined, () => {});
    expect(result.content).toContain('Hi');
  });

  it('abort before stream starts rejects as cancelled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          throw err;
        }
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      })
    );

    const service = new AIService(baseConfig(), baseSampler());
    const pending = service.askAIWithConversation('hello', [], [], undefined, () => {});
    await Promise.resolve();
    service.abort();

    await expect(pending).rejects.toMatchObject({
      message: 'Request was cancelled',
    });
  });
});
