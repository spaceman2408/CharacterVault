// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAIChat, type UseAIChatOptions } from '../../../src/components/ai/hooks/useAIChat';
import type { StoredChatMessage } from '../../../src/db/characterTypes';
import { chatHistoryService } from '../../../src/services/ChatHistoryService';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stored(seq: number, role: 'user' | 'assistant'): StoredChatMessage {
  return { id: `m${seq}`, ownerType: 'character', ownerId: 'card-1', panel: 'orion', seq, role, content: `Row ${seq}`, timestamp: seq };
}

const options: UseAIChatOptions = {
  aiConfig: { modelId: 'mock' } as UseAIChatOptions['aiConfig'],
  samplerSettings: {} as UseAIChatOptions['samplerSettings'],
  promptSettings: {} as UseAIChatOptions['promptSettings'],
  enableStreaming: false,
  showReasoning: false,
  contextEntryIds: [],
  chatOwnerType: 'character',
  chatOwnerId: 'card-1',
};

describe('useAIChat paging', () => {
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
    const { result } = renderHook(() => useAIChat(options));
    await waitFor(() => expect(result.current.chatHistory.map((message) => message.id)).toEqual(['m41', 'm42']));

    act(() => {
      result.current.handleDeleteMessage('m41');
    });
    await waitFor(() => expect(result.current.chatHistory.map((message) => message.id)).toEqual(['m39', 'm40']));
    expect(loadBefore).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'card-1' }), 41);
    expect(result.current.hasOlderMessages).toBe(true);
  });
});
