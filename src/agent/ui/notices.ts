import type { AgentToolEvent } from './types';

export const LOREBOOK_LOOKUP_TOOLS = new Set([
  'list_entries',
  'read_entry',
  'search',
  'audit_book',
  'read_recursion',
]);
export const LOREBOOK_WRITE_TOOLS = new Set([
  'add_entry',
  'update_entry',
  'replace_in_entry',
  'delete_entry',
  'replace_across',
  'update_book_settings',
]);

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

export function messageNotices(runError: string | undefined): string[] {
  return runError ? [runError] : [];
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

export function writeRecapLine(events: AgentToolEvent[]): string | null {
  const n = events.filter((event) => event.ok).length;
  if (n === 0) return null;
  return n === 1 ? 'Applied 1 write' : `Applied ${n} writes`;
}
