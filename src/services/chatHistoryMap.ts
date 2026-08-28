import type { ChatMessage } from '../components/ai/types';
import type { AgentToolEvent } from '../agent/ui/types';
import type {
  ChatOwnerType,
  ChatPanel,
  StoredChatMessage,
  StoredChatToolEvent,
} from '../db/characterTypes';
import type { ChatPage } from './ChatHistoryService';
import { CHAT_UI_MAX_WINDOW, clipChatHistoryWindow } from './ChatHistoryService';

export function ingestStoredPage(
  page: ChatPage,
  seqById: Map<string, number>,
): { maxSeq: number; seqById: Map<string, number> } {
  for (const row of page.messages) {
    seqById.set(row.id, row.seq);
  }
  let maxSeq = 0;
  for (const seq of seqById.values()) {
    if (seq > maxSeq) maxSeq = seq;
  }
  return { maxSeq, seqById };
}

export function pruneSeqById(seqById: Map<string, number>, keepIds: Iterable<string>): void {
  const keep = keepIds instanceof Set ? keepIds : new Set(keepIds);
  for (const id of [...seqById.keys()]) {
    if (!keep.has(id)) seqById.delete(id);
  }
}

export function allocateSeq(
  seqById: Map<string, number>,
  maxSeqRef: { current: number },
  id: string,
): number {
  const existing = seqById.get(id);
  if (existing != null) return existing;
  const seq = maxSeqRef.current + 1;
  maxSeqRef.current = seq;
  seqById.set(id, seq);
  return seq;
}

export function clipVisibleHistory<T>(history: T[]): { history: T[]; clipped: boolean } {
  if (history.length <= CHAT_UI_MAX_WINDOW) {
    return { history, clipped: false };
  }
  return {
    history: clipChatHistoryWindow(history, CHAT_UI_MAX_WINDOW),
    clipped: true,
  };
}

export function storedToChatMessage(row: StoredChatMessage): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    reasoning: row.reasoning,
    timestamp: row.timestamp,
    stats: row.stats,
  };
}

export function storedToAgentThread(rows: StoredChatMessage[]): {
  history: ChatMessage[];
  toolEventsByMessageId: Record<string, AgentToolEvent[]>;
  errorByMessageId: Record<string, string>;
  seqById: Map<string, number>;
} {
  const history: ChatMessage[] = [];
  const toolEventsByMessageId: Record<string, AgentToolEvent[]> = {};
  const errorByMessageId: Record<string, string> = {};
  const seqById = new Map<string, number>();

  for (const row of rows) {
    history.push(storedToChatMessage(row));
    seqById.set(row.id, row.seq);
    if (row.toolEvents && row.toolEvents.length > 0) {
      toolEventsByMessageId[row.id] = row.toolEvents as AgentToolEvent[];
    }
    if (row.error) {
      errorByMessageId[row.id] = row.error;
    }
  }

  return { history, toolEventsByMessageId, errorByMessageId, seqById };
}

export function chatMessageToStored(
  message: ChatMessage,
  owner: { ownerType: ChatOwnerType; ownerId: string; panel: ChatPanel; seq: number },
  extras?: {
    toolEvents?: AgentToolEvent[] | StoredChatToolEvent[];
    error?: string;
  },
): StoredChatMessage {
  const row: StoredChatMessage = {
    id: message.id,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    panel: owner.panel,
    seq: owner.seq,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  };
  if (message.reasoning) row.reasoning = message.reasoning;
  if (message.stats) row.stats = message.stats;
  if (extras?.toolEvents && extras.toolEvents.length > 0) {
    row.toolEvents = extras.toolEvents;
  }
  if (extras?.error) row.error = extras.error;
  return row;
}
