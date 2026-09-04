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
/** Per-thread IndexedDB cap. Oldest rows are dropped past this. */
export const CHAT_DISK_MAX_PER_THREAD = 500;

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

function queueKeysForOwner(ownerType: ChatOwnerType, ownerId: string): string[] {
  const prefix = `${ownerType}:${ownerId}:`;
  return [...writeQueues.keys()].filter((key) => key.startsWith(prefix));
}

/** Await in-flight per-thread writes for an owner (both panels). */
export function pendingChatWritesForOwner(
  ownerType: ChatOwnerType,
  ownerId: string,
): Promise<void> {
  return Promise.all(queueKeysForOwner(ownerType, ownerId).map((key) => writeQueues.get(key))).then(() => undefined);
}

/** Drop queued (not yet started) write chains for an owner so post-delete puts cannot resurrect rows. */
export function dropPendingChatWritesForOwner(ownerType: ChatOwnerType, ownerId: string): void {
  for (const key of queueKeysForOwner(ownerType, ownerId)) {
    writeQueues.delete(key);
  }
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

function sameThread(row: StoredChatMessage, thread: ChatThreadRef): boolean {
  return (
    row.ownerType === thread.ownerType
    && row.ownerId === thread.ownerId
    && row.panel === thread.panel
  );
}

async function trimOldestRows(
  thread: ChatThreadRef,
  keep: number = CHAT_DISK_MAX_PER_THREAD,
): Promise<void> {
  if (!thread.ownerId) return;
  if (keep <= 0) {
    await seqRange(thread, Dexie.minKey, Dexie.maxKey).delete();
    return;
  }
  const count = await seqRange(thread, Dexie.minKey, Dexie.maxKey).count();
  if (count <= keep) return;
  const newest = await seqRange(thread, Dexie.minKey, Dexie.maxKey)
    .reverse()
    .limit(keep)
    .toArray();
  if (newest.length === 0) return;
  const minKeepSeq = newest.reduce(
    (min, row) => (row.seq < min ? row.seq : min),
    newest[0].seq,
  );
  await seqRange(thread, Dexie.minKey, minKeepSeq, true, false).delete();
}

async function persistRow(row: StoredChatMessage): Promise<void> {
  const thread = { ownerType: row.ownerType, ownerId: row.ownerId, panel: row.panel };
  try {
    await characterDb.chatMessages.put(row);
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
    await trimOldestRows(thread, Math.max(1, Math.floor(CHAT_DISK_MAX_PER_THREAD / 2)));
    await characterDb.chatMessages.put(row);
  }
  await trimOldestRows(thread);
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
        await persistRow(row);
      },
    );
  }

  deleteById(thread: ChatThreadRef, id: string): Promise<void> {
    return enqueue(thread, async () => {
      const existing = await characterDb.chatMessages.get(id);
      if (!existing || !sameThread(existing, thread)) return;
      await characterDb.chatMessages.delete(id);
    });
  }

  trimOldest(
    thread: ChatThreadRef,
    keep: number = CHAT_DISK_MAX_PER_THREAD,
  ): Promise<void> {
    return enqueue(thread, async () => {
      await trimOldestRows(thread, keep);
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
