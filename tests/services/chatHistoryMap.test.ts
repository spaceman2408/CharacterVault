import { describe, expect, it } from 'vitest';
import type { StoredChatMessage } from '../../src/db/characterTypes';
import {
  allocateSeq,
  chatMessageToStored,
  clipVisibleHistory,
  pruneSeqById,
  storedToAgentThread,
  storedToChatMessage,
} from '../../src/services/chatHistoryMap';
import { CHAT_UI_MAX_WINDOW } from '../../src/services/ChatHistoryService';
import type { ChatMessage } from '../../src/components/ai/types';

function row(overrides: Partial<StoredChatMessage> = {}): StoredChatMessage {
  return {
    id: 'm1',
    ownerType: 'character',
    ownerId: 'c1',
    panel: 'agent',
    seq: 1,
    role: 'assistant',
    content: 'hello',
    timestamp: 10,
    ...overrides,
  };
}

describe('chatHistoryMap', () => {
  it('maps stored rows to UI messages without tool extras', () => {
    const message = storedToChatMessage(
      row({ reasoning: 'think', stats: { modelId: 'm' }, toolEvents: [{ toolName: 'x', ok: true, message: 'ok' }] }),
    );
    expect(message).toEqual({
      id: 'm1',
      role: 'assistant',
      content: 'hello',
      reasoning: 'think',
      timestamp: 10,
      stats: { modelId: 'm' },
    });
  });

  it('rebuilds agent maps and seq from stored rows', () => {
    const { history, toolEventsByMessageId, errorByMessageId, seqById } = storedToAgentThread([
      row({ id: 'u1', role: 'user', seq: 1, content: 'hi' }),
      row({
        id: 'a1',
        seq: 2,
        toolEvents: [{ toolName: 'update_entry', ok: true, message: 'ok' }],
        error: 'later',
      }),
    ]);
    expect(history.map((m) => m.id)).toEqual(['u1', 'a1']);
    expect(toolEventsByMessageId.a1[0].toolName).toBe('update_entry');
    expect(errorByMessageId.a1).toBe('later');
    expect(seqById.get('a1')).toBe(2);
  });

  it('round-trips a UI message into a stored row', () => {
    const message: ChatMessage = {
      id: 'u1',
      role: 'user',
      content: 'hi',
      timestamp: 5,
    };
    expect(
      chatMessageToStored(message, {
        ownerType: 'lorebook',
        ownerId: 'b1',
        panel: 'orion',
        seq: 4,
      }),
    ).toEqual({
      id: 'u1',
      ownerType: 'lorebook',
      ownerId: 'b1',
      panel: 'orion',
      seq: 4,
      role: 'user',
      content: 'hi',
      timestamp: 5,
    });
  });

  it('allocates monotonic seq and reuses ids', () => {
    const seqById = new Map<string, number>();
    const maxSeq = { current: 2 };
    expect(allocateSeq(seqById, maxSeq, 'n1')).toBe(3);
    expect(allocateSeq(seqById, maxSeq, 'n1')).toBe(3);
    expect(allocateSeq(seqById, maxSeq, 'n2')).toBe(4);
  });

  it('pruneSeqById drops ids that are no longer visible', () => {
    const seqById = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    pruneSeqById(seqById, ['b', 'c']);
    expect([...seqById.keys()]).toEqual(['b', 'c']);
  });

  it('clipVisibleHistory only slices past the RAM window', () => {
    const items = Array.from({ length: CHAT_UI_MAX_WINDOW }, (_, i) => i);
    expect(clipVisibleHistory(items).clipped).toBe(false);
    const over = [...items, 'x', 'y'];
    const result = clipVisibleHistory(over);
    expect(result.clipped).toBe(true);
    expect(result.history).toHaveLength(CHAT_UI_MAX_WINDOW);
    expect(result.history[0]).toBe(2);
  });
});
