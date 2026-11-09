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

describe('useAgentSession busy label', () => {
  it('drops the last tool label while the model writes its next reply', async () => {
    let finishSecond: (value: Awaited<ReturnType<AIService['chat']>>) => void = () => {};
    const chat = vi
      .spyOn(AIService.prototype, 'chat')
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'call_read', name: 'read_entry', arguments: '{"id":4}' }],
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSecond = resolve;
          }),
      );
    const { result } = renderHook(() =>
      useAgentSession({
        aiConfig: {
          ...DEFAULT_SETTINGS.ai,
          baseUrl: 'http://busy.test/v1',
          modelId: 'mock',
          enableStreaming: false,
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

    let run: Promise<void> = Promise.resolve();
    await act(async () => {
      run = result.current.handleAsk('Check Harbor');
      await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(2));
    });
    expect(result.current.isProcessing).toBe(true);
    expect(result.current.busyAction).toBeNull();

    await act(async () => {
      finishSecond({ content: 'Done.' });
      await run;
    });
  });
});
