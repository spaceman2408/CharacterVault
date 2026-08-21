import type { AgentToolEvent } from './types';

const LOOKUP_TOOLS = new Set(['list_entries', 'read_entry']);
const WRITE_TOOLS = new Set(['add_entry', 'update_entry', 'delete_entry']);

function writeEntryId(event: AgentToolEvent): string | null {
  if (!event.ok || !WRITE_TOOLS.has(event.toolName)) return null;
  const match = /^ok #(\d+)\s/.exec(event.message);
  return match?.[1] ?? null;
}

export function visibleToolEvents(events: AgentToolEvent[]): AgentToolEvent[] {
  const visible: AgentToolEvent[] = [];
  const addIndexById = new Map<string, number>();

  for (const event of events) {
    if (!event.ok) continue;
    if (LOOKUP_TOOLS.has(event.toolName)) continue;

    const id = writeEntryId(event);
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

export function compactToolResultMessage(toolName: string, message: string): string {
  if (!LOOKUP_TOOLS.has(toolName)) return message;
  const line = message.split('\n', 1)[0]?.trim();
  return line || (toolName === 'read_entry' ? 'read entry' : 'listed entries');
}

export function isLookupOnlyTurn(events: AgentToolEvent[]): boolean {
  return events.length > 0 && events.every((event) => event.ok && LOOKUP_TOOLS.has(event.toolName));
}
