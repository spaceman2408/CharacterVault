import Dexie from 'dexie';
import type {
  ChatOwnerType,
  ChatPanel,
  StoredChatMessage,
} from '../db/characterTypes';
import { characterDb } from '../db';
import { showEphemeralToast } from '../utils/ephemeralToast';

export const CHAT_UI_PAGE_SIZE = 80;
export const CHAT_UI_OLDER_PAGE_SIZE = 40;
export const CHAT_UI_MAX_WINDOW = 160;
/** Absolute in-memory cap including “load earlier” pages. */
export const CHAT_UI_HARD_WINDOW = 320;

export interface ChatThreadRef {
  ownerType: ChatOwnerType;
  ownerId: string;
  panel: ChatPanel;
}

export interface ChatPage {
  messages: StoredChatMessage[];
  hasMore: boolean;
}

const writeQueues = new Map<string, Promise<void>>();

export function chatThreadKey(thread: ChatThreadRef): string {
  return `${thread.ownerType}:${thread.ownerId}:${thread.panel}`;
}

function isQuotaExceeded(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i += 1) {
    if (typeof current === 'object' && current && 'name' in current) {
      const name = (current as { name?: string }).name;
      if (name === 'QuotaExceededError') return true;
    }
    if (typeof current === 'object' && current && 'inner' in current) {
      current = (current as { inner: unknown }).inner;
    } else {
      break;
    }
  }
  return false;
}

function notifyPersistFailure(error: unknown): void {
  if (isQuotaExceeded(error)) {
    showEphemeralToast({
      type: 'error',
      title: 'Chat not saved',
      message: 'Browser storage is full.',
      durationMs: 5000,
    });
    return;
  }
  showEphemeralToast({
    type: 'error',
    title: 'Chat not saved',
    message: 'Could not write chat history.',
    durationMs: 4000,
  });
}

function pendingWrites(thread: ChatThreadRef): Promise<void> {
  return writeQueues.get(chatThreadKey(thread)) ?? Promise.resolve();
}

function enqueue(thread: ChatThreadRef, op: () => Promise<void>): Promise<void> {
  const key = chatThreadKey(thread);
  const next: Promise<void> = (writeQueues.get(key) ?? Promise.resolve())
    .then(op, op)
    .catch((error: unknown) => {
      notifyPersistFailure(error);
    })
    .finally(() => {
      if (writeQueues.get(key) === next) {
        writeQueues.delete(key);
      }
    });
  writeQueues.set(key, next);
  return next;
}

/** Test helper: pending per-thread write chains. Settled keys are dropped. */
export function chatWriteQueuePendingCount(): number {
  return writeQueues.size;
}

function seqRange(
  thread: ChatThreadRef,
  seqLo: unknown,
  seqHi: unknown,
  includeLower = true,
  includeUpper = true,
) {
  return characterDb.chatMessages
    .where('[ownerType+ownerId+panel+seq]')
    .between(
      [thread.ownerType, thread.ownerId, thread.panel, seqLo],
      [thread.ownerType, thread.ownerId, thread.panel, seqHi],
      includeLower,
      includeUpper,
    );
}

function chronological(rows: StoredChatMessage[]): StoredChatMessage[] {
  return [...rows].sort((a, b) => a.seq - b.seq);
}

export function clipChatHistoryWindow<T>(items: T[], max = CHAT_UI_MAX_WINDOW): T[] {
  if (items.length <= max) return items;
  return items.slice(items.length - max);
}

export class ChatHistoryService {
  async loadTail(
    thread: ChatThreadRef,
    limit: number = CHAT_UI_PAGE_SIZE,
  ): Promise<ChatPage> {
    if (!thread.ownerId || limit <= 0) {
      return { messages: [], hasMore: false };
    }
    await pendingWrites(thread);
    const rows = await seqRange(thread, Dexie.minKey, Dexie.maxKey)
      .reverse()
      .limit(limit + 1)
      .toArray();
    const hasMore = rows.length > limit;
    const page = chronological(hasMore ? rows.slice(0, limit) : rows);
    return { messages: page, hasMore };
  }

  async loadBefore(
    thread: ChatThreadRef,
    beforeSeq: number,
    limit: number = CHAT_UI_OLDER_PAGE_SIZE,
  ): Promise<ChatPage> {
    if (!thread.ownerId || limit <= 0) {
      return { messages: [], hasMore: false };
    }
    await pendingWrites(thread);
    const rows = await seqRange(thread, Dexie.minKey, beforeSeq, true, false)
      .reverse()
      .limit(limit + 1)
      .toArray();
    const hasMore = rows.length > limit;
    const page = chronological(hasMore ? rows.slice(0, limit) : rows);
    return { messages: page, hasMore };
  }

  async maxSeq(thread: ChatThreadRef): Promise<number> {
    if (!thread.ownerId) return 0;
    await pendingWrites(thread);
    const last = await seqRange(thread, Dexie.minKey, Dexie.maxKey).last();
    return last?.seq ?? 0;
  }

  put(row: StoredChatMessage): Promise<void> {
    return enqueue(
      { ownerType: row.ownerType, ownerId: row.ownerId, panel: row.panel },
      async () => {
        await characterDb.chatMessages.put(row);
      },
    );
  }

  deleteById(thread: ChatThreadRef, id: string): Promise<void> {
    return enqueue(thread, async () => {
      await characterDb.chatMessages.delete(id);
    });
  }

  deleteFrom(thread: ChatThreadRef, fromSeq: number): Promise<void> {
    return enqueue(thread, async () => {
      await seqRange(thread, fromSeq, Dexie.maxKey).delete();
    });
  }

  clear(thread: ChatThreadRef): Promise<void> {
    return enqueue(thread, async () => {
      await characterDb.chatMessages
        .where('[ownerType+ownerId+panel]')
        .equals([thread.ownerType, thread.ownerId, thread.panel])
        .delete();
    });
  }
}

export const chatHistoryService = new ChatHistoryService();
