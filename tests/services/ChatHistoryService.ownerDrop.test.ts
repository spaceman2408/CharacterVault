import { describe, expect, it, vi } from 'vitest';
import type { StoredChatMessage } from '../../src/db/characterTypes';

const gate = vi.hoisted(() => ({
  waiters: [] as Array<() => void>,
  puts: [] as StoredChatMessage[],
}));

vi.mock('../../src/db', () => ({
  characterDb: {
    chatMessages: {
      put: async (row: StoredChatMessage) => {
        gate.puts.push(row);
        await new Promise<void>((resolve) => {
          gate.waiters.push(resolve);
        });
      },
      where: () => ({
        between: () => ({
          count: async () => 0,
        }),
      }),
    },
  },
}));

vi.mock('../../src/utils/ephemeralToast', () => ({
  showEphemeralToast: vi.fn(),
}));

import {
  ChatHistoryService,
  chatWriteQueuePendingCount,
  dropPendingChatWritesForOwner,
  pendingChatWritesForOwner,
} from '../../src/services/ChatHistoryService';

function msg(id: string, ownerId: string, panel: 'orion' | 'agent' = 'orion'): StoredChatMessage {
  return {
    id,
    ownerType: 'character',
    ownerId,
    panel,
    seq: 1,
    role: 'user',
    content: id,
    timestamp: 1,
  };
}

function releaseGate() {
  gate.waiters.splice(0).forEach((resolve) => resolve());
}

async function waitForWaiters(count: number): Promise<void> {
  for (let i = 0; i < 50 && gate.waiters.length < count; i += 1) {
    await Promise.resolve();
  }
  expect(gate.waiters.length).toBe(count);
}

describe('pendingChatWritesForOwner', () => {
  it('resolves once in-flight writes settle', async () => {
    const service = new ChatHistoryService();
    const pending = service.put(msg('a', 'char-1'));
    const drain = pendingChatWritesForOwner('character', 'char-1');
    let drained = false;
    void drain.then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    releaseGate();
    await pending;
    await drain;
    expect(drained).toBe(true);
    releaseGate();
  });

  it('resolves immediately when nothing is queued', async () => {
    await expect(pendingChatWritesForOwner('character', 'nobody')).resolves.toBeUndefined();
  });
});

describe('dropPendingChatWritesForOwner', () => {
  it('drops only the matching owner queues', async () => {
    const service = new ChatHistoryService();
    const victim = service.put(msg('v', 'char-victim'));
    const survivor = service.put(msg('s', 'char-survivor'));
    expect(chatWriteQueuePendingCount()).toBe(2);
    await waitForWaiters(2);
    dropPendingChatWritesForOwner('character', 'char-victim');
    expect(chatWriteQueuePendingCount()).toBe(1);
    releaseGate();
    await victim;
    releaseGate();
    await survivor;
    releaseGate();
    expect(chatWriteQueuePendingCount()).toBe(0);
  });
});
