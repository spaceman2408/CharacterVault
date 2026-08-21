import type { AgentToolEvent } from './types';

export const LOREBOOK_LOOKUP_TOOLS = new Set(['list_entries', 'read_entry']);
export const LOREBOOK_WRITE_TOOLS = new Set(['add_entry', 'update_entry', 'delete_entry']);

export const CHARACTER_LOOKUP_TOOLS = new Set([
  'list_fields',
  'read_field',
  'list_greetings',
  'read_greeting',
  'list_entries',
  'read_entry',
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
    if (!event.ok) continue;
    if (lookupTools.has(event.toolName)) continue;

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

export function messageNotices(
  runError: string | undefined,
  events: AgentToolEvent[],
): string[] {
  const notices: string[] = [];
  if (runError) notices.push(runError);
  for (const event of events) {
    if (!event.ok) notices.push(event.message);
  }
  return notices;
}

export function shouldRenderAgentMessage(
  role: string,
  speech: string,
  visible: AgentToolEvent[],
  notices: string[],
): boolean {
  if (role !== 'assistant') return true;
  return speech.trim().length > 0 || visible.length > 0 || notices.length > 0;
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
