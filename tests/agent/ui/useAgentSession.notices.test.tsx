// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentHost } from '../../../src/agent/core/types';
import { TURN_LIMIT_NOTICE } from '../../../src/agent/ui/notices';
import { useAgentSession } from '../../../src/agent/ui/useAgentSession';
import { DEFAULT_SETTINGS, type StoredChatMessage } from '../../../src/db/characterTypes';
import { AIService } from '../../../src/services/AIService';
import { chatHistoryService } from '../../../src/services/ChatHistoryService';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stored(id: string, seq: number, role: 'user' | 'assistant', content: string, error?: string): StoredChatMessage {
  return { id, ownerType: 'lorebook', ownerId: 'book-1', panel: 'agent', seq, role, content, timestamp: seq, error };
}

const host = (): AgentHost => ({
  toolNames: [],
  buildSystemPrompt: () => 'sys',
  extraContextChunks: async () => [],
  execute: async (action) => ({ ok: false, toolName: action.name, message: 'unused' }),
  flush: async () => undefined,
});

describe('useAgentSession notices', () => {
  it('clears earlier notices on disk too when a new run starts', async () => {
    vi.spyOn(chatHistoryService, 'loadTail').mockResolvedValue({
      messages: [stored('u1', 1, 'user', 'Go'), stored('a1', 2, 'assistant', '', TURN_LIMIT_NOTICE)],
      hasMore: false,
    });
    const puts: StoredChatMessage[] = [];
    vi.spyOn(chatHistoryService, 'put').mockImplementation(async (row) => {
      puts.push(row);
    });
    vi.spyOn(AIService.prototype, 'chat').mockResolvedValue({ content: 'Done.' });
    const { result } = renderHook(() =>
      useAgentSession({
        aiConfig: { ...DEFAULT_SETTINGS.ai, baseUrl: 'http://notices.test/v1', modelId: 'mock', enableStreaming: false },
        samplerSettings: DEFAULT_SETTINGS.sampler,
        promptSettings: DEFAULT_SETTINGS.prompts,
        createHost: host,
        flushDraft: () => undefined,
        lookupToolNames: new Set(),
        chatOwnerType: 'lorebook',
        chatOwnerId: 'book-1',
      }),
    );
    await waitFor(() => expect(result.current.errorByMessageId).toEqual({ a1: TURN_LIMIT_NOTICE }));

    await act(async () => {
      await result.current.handleAsk('Next');
    });
    expect(result.current.errorByMessageId).toEqual({});
    const saved = puts.filter((row) => row.id === 'a1').at(-1);
    expect(saved).toBeDefined();
    expect(saved?.error).toBeUndefined();
  });
});
