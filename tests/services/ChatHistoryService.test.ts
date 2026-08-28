import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import type { StoredChatMessage } from '../../src/db/characterTypes';

type Compound = [string, string, string, unknown];

const rows: StoredChatMessage[] = [];

function normalizePart(value: unknown): string | number {
  if (value === Dexie.minKey) return Number.NEGATIVE_INFINITY;
  if (value === Dexie.maxKey) return Number.POSITIVE_INFINITY;
  if (typeof value === 'number') return value;
  return String(value);
}

function cmpTuple(a: unknown[], b: unknown[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const left = normalizePart(a[i]);
    const right = normalizePart(b[i]);
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}

function rowTuple(row: StoredChatMessage, index: string): unknown[] {
  if (index === '[ownerType+ownerId+panel+seq]') {
    return [row.ownerType, row.ownerId, row.panel, row.seq];
  }
  if (index === '[ownerType+ownerId+panel]') {
    return [row.ownerType, row.ownerId, row.panel];
  }
  if (index === '[ownerType+ownerId]') {
    return [row.ownerType, row.ownerId];
  }
  return [row.id];
}

function betweenRows(
  index: string,
  lower: unknown[],
  upper: unknown[],
  includeLower: boolean,
  includeUpper: boolean,
): StoredChatMessage[] {
  return rows.filter((row) => {
    const tuple = rowTuple(row, index);
    const vsLower = cmpTuple(tuple, lower);
    const vsUpper = cmpTuple(tuple, upper);
    const okLower = includeLower ? vsLower >= 0 : vsLower > 0;
    const okUpper = includeUpper ? vsUpper <= 0 : vsUpper < 0;
    return okLower && okUpper;
  });
}

vi.mock('../../src/db', () => ({
  characterDb: {
    chatMessages: {
      put: async (row: StoredChatMessage) => {
        const index = rows.findIndex((existing) => existing.id === row.id);
        if (index === -1) rows.push({ ...row });
        else rows[index] = { ...row };
      },
      delete: async (id: string) => {
        const index = rows.findIndex((row) => row.id === id);
        if (index !== -1) rows.splice(index, 1);
      },
      where: (index: string) => ({
        between: (
          lower: Compound,
          upper: Compound,
          includeLower = true,
          includeUpper = true,
        ) => {
          const collection = () => betweenRows(index, lower, upper, includeLower, includeUpper);
          const api = {
            reverse: () => ({
              limit: (n: number) => ({
                toArray: async () =>
                  collection()
                    .sort((a, b) => b.seq - a.seq)
                    .slice(0, n),
              }),
            }),
            last: async () => {
              const matched = collection().sort((a, b) => a.seq - b.seq);
              return matched[matched.length - 1];
            },
            delete: async () => {
              const ids = new Set(collection().map((row) => row.id));
              for (let i = rows.length - 1; i >= 0; i -= 1) {
                if (ids.has(rows[i].id)) rows.splice(i, 1);
              }
            },
          };
          return api;
        },
        equals: (key: unknown[]) => ({
          delete: async () => {
            const ids = new Set(
              rows
                .filter((row) => cmpTuple(rowTuple(row, index), key) === 0)
                .map((row) => row.id),
            );
            for (let i = rows.length - 1; i >= 0; i -= 1) {
              if (ids.has(rows[i].id)) rows.splice(i, 1);
            }
          },
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
  CHAT_UI_PAGE_SIZE,
  chatWriteQueuePendingCount,
  clipChatHistoryWindow,
  type ChatThreadRef,
} from '../../src/services/ChatHistoryService';

const thread: ChatThreadRef = { ownerType: 'character', ownerId: 'char-1', panel: 'orion' };
const other: ChatThreadRef = { ownerType: 'character', ownerId: 'char-2', panel: 'orion' };
const agent: ChatThreadRef = { ownerType: 'character', ownerId: 'char-1', panel: 'agent' };

function msg(
  id: string,
  seq: number,
  owner = thread,
): StoredChatMessage {
  return {
    id,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    panel: owner.panel,
    seq,
    role: seq % 2 === 1 ? 'user' : 'assistant',
    content: id,
    timestamp: seq,
  };
}

describe('clipChatHistoryWindow', () => {
  it('returns the same array when at or under the max', () => {
    const items = [1, 2, 3];
    expect(clipChatHistoryWindow(items, 5)).toBe(items);
  });

  it('keeps the newest items', () => {
    const items = [1, 2, 3, 4, 5];
    expect(clipChatHistoryWindow(items, 3)).toEqual([3, 4, 5]);
  });
});

describe('ChatHistoryService', () => {
  let service: ChatHistoryService;

  beforeEach(() => {
    rows.length = 0;
    service = new ChatHistoryService();
  });

  it('assigns isolation per owner and panel', async () => {
    await service.put(msg('a', 1));
    await service.put(msg('b', 1, other));
    await service.put(msg('c', 1, agent));

    const page = await service.loadTail(thread, 10);
    expect(page.messages.map((row) => row.id)).toEqual(['a']);
    expect(page.hasMore).toBe(false);
  });

  it('loads the newest tail and reports hasMore', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await service.put(msg(`m${i}`, i));
    }
    const page = await service.loadTail(thread, 3);
    expect(page.messages.map((row) => row.id)).toEqual(['m3', 'm4', 'm5']);
    expect(page.hasMore).toBe(true);
    expect(await service.maxSeq(thread)).toBe(5);
  });

  it('loadBefore pages older rows exclusive of beforeSeq', async () => {
    for (let i = 1; i <= 6; i += 1) {
      await service.put(msg(`m${i}`, i));
    }
    const page = await service.loadBefore(thread, 5, 2);
    expect(page.messages.map((row) => row.id)).toEqual(['m3', 'm4']);
    expect(page.hasMore).toBe(true);

    const rest = await service.loadBefore(thread, 3, 10);
    expect(rest.messages.map((row) => row.id)).toEqual(['m1', 'm2']);
    expect(rest.hasMore).toBe(false);
  });

  it('deleteFrom removes that seq and everything after', async () => {
    for (let i = 1; i <= 4; i += 1) {
      await service.put(msg(`m${i}`, i));
    }
    await service.deleteFrom(thread, 3);
    const page = await service.loadTail(thread, 10);
    expect(page.messages.map((row) => row.id)).toEqual(['m1', 'm2']);
  });

  it('deleteById removes one row', async () => {
    await service.put(msg('keep', 1));
    await service.put(msg('drop', 2));
    await service.deleteById(thread, 'drop');
    const page = await service.loadTail(thread, 10);
    expect(page.messages.map((row) => row.id)).toEqual(['keep']);
  });

  it('clear removes only that panel', async () => {
    await service.put(msg('orion', 1));
    await service.put(msg('agent', 1, agent));
    await service.clear(thread);
    expect((await service.loadTail(thread, 10)).messages).toEqual([]);
    expect((await service.loadTail(agent, 10)).messages.map((row) => row.id)).toEqual(['agent']);
  });

  it('put overwrites the same id', async () => {
    await service.put(msg('m1', 1));
    await service.put({ ...msg('m1', 1), content: 'updated' });
    const page = await service.loadTail(thread, 10);
    expect(page.messages).toHaveLength(1);
    expect(page.messages[0].content).toBe('updated');
  });

  it('serializes writes on the same thread', async () => {
    const first = service.put(msg('m1', 1));
    const second = service.put(msg('m2', 2));
    await Promise.all([first, second]);
    expect((await service.loadTail(thread, 10)).messages.map((row) => row.id)).toEqual([
      'm1',
      'm2',
    ]);
  });

  it('drops settled write-queue keys so the map cannot grow without bound', async () => {
    expect(chatWriteQueuePendingCount()).toBe(0);
    await service.put(msg('m1', 1));
    await service.put(msg('m2', 1, other));
    await service.put(msg('m3', 1, agent));
    expect(chatWriteQueuePendingCount()).toBe(0);
  });

  it('uses the UI page size by default', () => {
    expect(CHAT_UI_PAGE_SIZE).toBe(80);
  });
});
