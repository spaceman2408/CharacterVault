// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentHost } from '../../../src/agent/core/types';
import { useAgentSession } from '../../../src/agent/ui/useAgentSession';
import { DEFAULT_SETTINGS } from '../../../src/db/characterTypes';
import { AIService } from '../../../src/services/AIService';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const host = (): AgentHost => ({
  toolNames: ['read_entry'],
  tools: [{ name: 'read_entry', description: 'Read an entry', parameters: { type: 'object' } }],
  buildSystemPrompt: () => 'sys',
  extraContextChunks: async () => [],
  execute: async (action) => ({ ok: true, toolName: action.name, message: '#4 Harbor\n---\nBody' }),
  flush: async () => undefined,
});

async function runLookupWithThinking(showReasoning: boolean) {
  vi.spyOn(AIService.prototype, 'chat')
    .mockResolvedValueOnce({
      content: '',
      reasoning: 'Let me look at Harbor.',
      toolCalls: [{ id: 'call_read', name: 'read_entry', arguments: '{"id":4}' }],
    })
    .mockResolvedValueOnce({ content: 'Done.' });
  const { result } = renderHook(() =>
    useAgentSession({
      aiConfig: {
        ...DEFAULT_SETTINGS.ai,
        baseUrl: 'http://lookup.test/v1',
        modelId: 'mock',
        enableStreaming: false,
        showReasoning,
      },
      samplerSettings: DEFAULT_SETTINGS.sampler,
      promptSettings: DEFAULT_SETTINGS.prompts,
      createHost: host,
      flushDraft: () => undefined,
      lookupToolNames: new Set(['read_entry']),
      chatOwnerType: 'lorebook',
      chatOwnerId: '',
    }),
  );
  await act(async () => {
    await result.current.handleAsk('Check Harbor');
  });
  return result.current.chatHistory;
}

describe('useAgentSession lookup turns', () => {
  it('keeps a lookup turn whose thinking is shown', async () => {
    const history = await runLookupWithThinking(true);
    expect(history.map((message) => message.reasoning ?? message.content)).toEqual([
      'Check Harbor',
      'Let me look at Harbor.',
      'Done.',
    ]);
  });

  it('drops a lookup turn whose only content is hidden thinking', async () => {
    const history = await runLookupWithThinking(false);
    expect(history.map((message) => message.content)).toEqual(['Check Harbor', 'Done.']);
  });
});
