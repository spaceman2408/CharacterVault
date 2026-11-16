import { DEFAULT_MAX_TURNS } from '../core/runLoop';
import type { ActionResult, ParsedAction } from '../core/types';
import { stripFences } from '../core/stripFences';
import { formatToolEvent, isNoChangeWrite } from './formatToolEvent';
import { parseToolTarget } from './toolTarget';
import type { AgentToolEvent } from './types';

export const TURN_LIMIT_NOTICE = `Stopped at the ${DEFAULT_MAX_TURNS}-turn limit for one run.`;
export const CONTINUE_MESSAGE = 'Continue where you left off.';

export const LOREBOOK_LOOKUP_TOOLS = new Set([
  'list_entries',
  'read_entry',
  'search',
  'audit_book',
  'read_recursion',
  'test_keys',
  'suggest_names',
  'read_skill',
]);
export const LOREBOOK_WRITE_TOOLS = new Set([
  'add_entry',
  'update_entry',
  'replace_in_entry',
  'delete_entry',
  'replace_across',
  'update_book_settings',
]);

/** Stored on a run's last message after review; sent to the model, never shown. */
export const REVIEW_NOTE_TOOL = 'review_outcome';

/** Stored on a run's last message when the page was left or refreshed before its writes were saved. */
export const RUN_INTERRUPTED_TOOL = 'run_interrupted';
export const RUN_INTERRUPTED_NOTE =
  'this run was interrupted by leaving or refreshing the page; none of its edits were saved.';

export function interruptedRunNotice(wrote: boolean, reviewWaiting: boolean): string {
  if (!wrote) return 'Interrupted by leaving or refreshing the page. Nothing was changed.';
  return reviewWaiting
    ? 'Interrupted by leaving or refreshing the page before review. These edits were not saved.'
    : 'Interrupted by leaving or refreshing the page. These edits were not saved.';
}

export const CHARACTER_LOOKUP_TOOLS = new Set([
  'list_fields',
  'read_field',
  'list_greetings',
  'read_greeting',
  'list_entries',
  'read_entry',
  'search',
  'audit_card',
  'read_recursion',
  'test_keys',
  'suggest_names',
  'read_skill',
]);

function writeEntryId(
  event: AgentToolEvent,
  writeTools: ReadonlySet<string>,
): string | null {
  if (!event.ok || !writeTools.has(event.toolName)) return null;
  const match = /^ok #(\d+)\s/.exec(event.message);
  return match?.[1] ?? null;
}

/** Successful lookups (reads, searches, checks) as opposed to writes, in either Agent. */
export function isLookupEvent(event: AgentToolEvent): boolean {
  return event.ok && (CHARACTER_LOOKUP_TOOLS.has(event.toolName) || LOREBOOK_LOOKUP_TOOLS.has(event.toolName));
}

/** Writes and failed calls of a turn, with an entry's later writes folded into its first row. */
export function visibleToolEvents(
  events: AgentToolEvent[],
  lookupTools: ReadonlySet<string> = LOREBOOK_LOOKUP_TOOLS,
  writeTools: ReadonlySet<string> = LOREBOOK_WRITE_TOOLS,
): AgentToolEvent[] {
  return toolRows(events, lookupTools, writeTools, false);
}

/** The rows a turn shows in chat: its writes and failed calls plus the lookups it made, in order. */
export function shownToolEvents(
  events: AgentToolEvent[],
  lookupTools: ReadonlySet<string> = LOREBOOK_LOOKUP_TOOLS,
  writeTools: ReadonlySet<string> = LOREBOOK_WRITE_TOOLS,
): AgentToolEvent[] {
  return toolRows(events, lookupTools, writeTools, true);
}

function toolRows(
  events: AgentToolEvent[],
  lookupTools: ReadonlySet<string>,
  writeTools: ReadonlySet<string>,
  withLookups: boolean,
): AgentToolEvent[] {
  const visible: AgentToolEvent[] = [];
  const addIndexById = new Map<string, number>();

  for (const event of events) {
    if (event.ok && lookupTools.has(event.toolName)) {
      if (withLookups) visible.push(event);
      continue;
    }
    if (event.toolName === REVIEW_NOTE_TOOL || event.toolName === RUN_INTERRUPTED_TOOL) continue;

    const id = writeEntryId(event, writeTools);
    if (id && addIndexById.has(id)) {
      visible[addIndexById.get(id)!] = event;
      continue;
    }
    if (id) addIndexById.set(id, visible.length);
    visible.push(event);
  }

  return visible;
}

export interface ToolRow {
  event: AgentToolEvent;
  count: number;
}

/** Identical rows (same tool, text, outcome, and link) shown once with a count, in order of first appearance. */
export function foldToolRows(events: AgentToolEvent[]): ToolRow[] {
  const rows: ToolRow[] = [];
  const byKey = new Map<string, ToolRow>();
  for (const event of events) {
    const key = JSON.stringify([event.toolName, event.ok, formatToolEvent(event), event.target ?? null]);
    const row = byKey.get(key);
    if (row) {
      row.count += 1;
      continue;
    }
    const next = { event, count: 1 };
    byKey.set(key, next);
    rows.push(next);
  }
  return rows;
}

export interface TurnBlock {
  /** Every turn in the block, in order; the first one renders it. */
  ids: string[];
  /** History index of the block's last turn. */
  lastIndex: number;
}

/**
 * Back-to-back agent turns that only ran tools (no speech, no shown thinking) render as one block on
 * their first turn. A turn with a notice closes its block. Turns folded into an earlier one map to null;
 * turns on their own have no entry.
 */
export function silentTurnBlocks(
  history: { id: string; role: string; content: string; reasoning?: string }[],
  toolEventsByMessageId: Record<string, AgentToolEvent[]>,
  errorByMessageId: Record<string, string>,
  showReasoning: boolean,
): Map<string, TurnBlock | null> {
  const blocks = new Map<string, TurnBlock | null>();
  let start = -1;
  const close = (end: number) => {
    if (start >= 0 && end > start) {
      const ids = history.slice(start, end + 1).map((message) => message.id);
      blocks.set(ids[0], { ids, lastIndex: end });
      for (const id of ids.slice(1)) blocks.set(id, null);
    }
    start = -1;
  };
  history.forEach((message, index) => {
    const silent =
      message.role === 'assistant' &&
      !stripFences(message.content).trim() &&
      !(showReasoning && message.reasoning?.trim());
    if (!silent) {
      close(index - 1);
      return;
    }
    if (start < 0) start = index;
    const events = toolEventsByMessageId[message.id] ?? [];
    if (messageNotices(errorByMessageId[message.id], events).length > 0) close(index);
  });
  close(history.length - 1);
  return blocks;
}

export function messageNotices(runError: string | undefined, events: AgentToolEvent[] = []): string[] {
  const notices = runError ? [runError] : [];
  for (const event of events) {
    if (event.toolName === RUN_INTERRUPTED_TOOL) notices.push(event.message);
  }
  return notices;
}

/** Messages of runs whose writes never landed, so their write rows must not read as applied. */
export function interruptedRunMessageIds(
  history: { id: string; role: string }[],
  toolEventsByMessageId: Record<string, AgentToolEvent[]>,
): Set<string> {
  const ids = new Set<string>();
  let run: string[] = [];
  let interrupted = false;
  const endRun = () => {
    if (interrupted) for (const id of run) ids.add(id);
    run = [];
    interrupted = false;
  };
  for (const message of history) {
    if (message.role === 'user') {
      endRun();
      continue;
    }
    run.push(message.id);
    const events = toolEventsByMessageId[message.id] ?? [];
    if (events.some((event) => event.toolName === RUN_INTERRUPTED_TOOL)) interrupted = true;
  }
  endRun();
  return ids;
}

export function shouldRenderAgentMessage(
  role: string,
  speech: string,
  visible: AgentToolEvent[],
  notices: string[],
  reasoning = '',
): boolean {
  if (role !== 'assistant') return true;
  return (
    speech.trim().length > 0 ||
    reasoning.trim().length > 0 ||
    visible.length > 0 ||
    notices.length > 0
  );
}

export function compactToolResultMessage(
  toolName: string,
  message: string,
  lookupTools: ReadonlySet<string> = LOREBOOK_LOOKUP_TOOLS,
): string {
  if (!lookupTools.has(toolName)) return message;
  const line = message.split('\n', 1)[0]?.trim();
  return line || toolName;
}

/** Transcript row for one tool result. Successful writes keep their arguments; lookups keep a header only. */
export function toAgentToolEvent(
  result: ActionResult,
  action: ParsedAction | undefined,
  lookupTools: ReadonlySet<string>,
): AgentToolEvent {
  const event: AgentToolEvent = {
    toolName: result.toolName,
    ok: result.ok,
    message: compactToolResultMessage(result.toolName, result.message, lookupTools),
    target: parseToolTarget(result.toolName, result.ok, result.message),
  };
  if (result.ok && action && !lookupTools.has(result.toolName)) {
    event.call = { headers: { ...action.headers }, body: action.body };
  }
  return event;
}

export function writeRecapLine(events: AgentToolEvent[], lost = false): string | null {
  const n = events.filter((event) => event.ok && !isNoChangeWrite(event)).length;
  if (n === 0) return null;
  if (lost) return 'Not saved';
  return n === 1 ? 'Applied 1 write' : `Applied ${n} writes`;
}
