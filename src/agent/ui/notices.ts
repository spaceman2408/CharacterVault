import { DEFAULT_MAX_TURNS } from '../core/runLoop';
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
]);

function writeEntryId(
  event: AgentToolEvent,
  writeTools: ReadonlySet<string>,
): string | null {
  if (!event.ok || !writeTools.has(event.toolName)) return null;
  const match = /^ok #(\d+)\s/.exec(event.message);
  return match?.[1] ?? null;
}

export function visibleToolEvents(
  events: AgentToolEvent[],
  lookupTools: ReadonlySet<string> = LOREBOOK_LOOKUP_TOOLS,
  writeTools: ReadonlySet<string> = LOREBOOK_WRITE_TOOLS,
): AgentToolEvent[] {
  const visible: AgentToolEvent[] = [];
  const addIndexById = new Map<string, number>();

  for (const event of events) {
    if (event.ok && lookupTools.has(event.toolName)) continue;
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

export function isLookupOnlyTurn(
  events: AgentToolEvent[],
  lookupTools: ReadonlySet<string> = LOREBOOK_LOOKUP_TOOLS,
): boolean {
  return events.length > 0 && events.every((event) => event.ok && lookupTools.has(event.toolName));
}

export function writeRecapLine(events: AgentToolEvent[], lost = false): string | null {
  const n = events.filter((event) => event.ok).length;
  if (n === 0) return null;
  if (lost) return 'Not saved';
  return n === 1 ? 'Applied 1 write' : `Applied ${n} writes`;
}
