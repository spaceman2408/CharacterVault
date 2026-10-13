// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentHost } from '../../../src/agent/core/types';
import { useAgentSession } from '../../../src/agent/ui/useAgentSession';
import { DEFAULT_SETTINGS, type StoredChatMessage } from '../../../src/db/characterTypes';
import { chatHistoryService } from '../../../src/services/ChatHistoryService';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stored(seq: number, role: 'user' | 'assistant'): StoredChatMessage {
  return { id: `m${seq}`, ownerType: 'lorebook', ownerId: 'book-1', panel: 'agent', seq, role, content: `Row ${seq}`, timestamp: seq };
}

const host = (): AgentHost => ({
  toolNames: [],
  buildSystemPrompt: () => 'sys',
  extraContextChunks: async () => [],
  execute: async (action) => ({ ok: false, toolName: action.name, message: 'unused' }),
  flush: async () => undefined,
});

describe('useAgentSession paging', () => {
  it('shows the older saved rows after deleting from the oldest visible message', async () => {
    vi.spyOn(chatHistoryService, 'loadTail').mockResolvedValue({
      messages: [stored(41, 'user'), stored(42, 'assistant')],
      hasMore: true,
    });
    const loadBefore = vi.spyOn(chatHistoryService, 'loadBefore').mockResolvedValue({
      messages: [stored(39, 'user'), stored(40, 'assistant')],
      hasMore: true,
    });
    vi.spyOn(chatHistoryService, 'deleteFrom').mockResolvedValue();
    const { result } = renderHook(() =>
      useAgentSession({
        aiConfig: { ...DEFAULT_SETTINGS.ai, baseUrl: 'http://paging.test/v1', modelId: 'mock' },
        samplerSettings: DEFAULT_SETTINGS.sampler,
        promptSettings: DEFAULT_SETTINGS.prompts,
        createHost: host,
        flushDraft: () => undefined,
        lookupToolNames: new Set(),
        chatOwnerType: 'lorebook',
        chatOwnerId: 'book-1',
      }),
    );
    await waitFor(() => expect(result.current.chatHistory.map((message) => message.id)).toEqual(['m41', 'm42']));

    act(() => {
      result.current.handleDeleteMessage('m41');
    });
    await waitFor(() => expect(result.current.chatHistory.map((message) => message.id)).toEqual(['m39', 'm40']));
    expect(loadBefore).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'book-1' }), 41);
    expect(result.current.hasOlderMessages).toBe(true);
  });
});
