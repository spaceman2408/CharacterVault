import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/db/characterTypes';
import { AIService } from '../../src/services/AIService';

function stubReply(message: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'gen',
          object: 'chat.completion',
          created: 0,
          model: 'test-model',
          choices: [{ index: 0, message: { role: 'assistant', ...message }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  );
}

function chat() {
  return new AIService(
    { ...DEFAULT_SETTINGS.ai, baseUrl: 'https://example.com/v1', apiKey: 'k', modelId: 'test-model', enableStreaming: false },
    DEFAULT_SETTINGS.sampler,
  ).chat([{ role: 'user', content: 'hi' }]);
}

describe('AIService non-streamed think tags', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('moves inline think blocks out of the reply, like the stream does', async () => {
    stubReply({ content: '<think>Plan <tool_call>x</tool_call></think>\nHello' });
    const response = await chat();
    expect(response.content).toBe('\nHello');
    expect(response.reasoning).toBe('Plan <tool_call>x</tool_call>');
  });

  it('keeps the reasoning field and still strips tags from the reply', async () => {
    stubReply({ content: '<think>copy</think>Hello', reasoning_content: 'field' });
    const response = await chat();
    expect(response.content).toBe('Hello');
    expect(response.reasoning).toBe('field');
  });

  it('treats an unclosed think block as thinking', async () => {
    stubReply({ content: '<think>still going' });
    const response = await chat();
    expect(response.content).toBe('');
    expect(response.reasoning).toBe('still going');
  });
});
