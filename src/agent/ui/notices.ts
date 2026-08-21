import type { AgentToolEvent } from './types';

function addEntryId(event: AgentToolEvent): string | null {
  if (event.toolName !== 'add_entry' || !event.ok) return null;
  const match = /^ok #(\d+)\s/.exec(event.message);
  return match?.[1] ?? null;
}

export function visibleToolEvents(events: AgentToolEvent[]): AgentToolEvent[] {
  const visible: AgentToolEvent[] = [];
  const addIndexById = new Map<string, number>();

  for (const event of events) {
    if (!event.ok) continue;
    if (event.toolName === 'list_entries') continue;

    const id = addEntryId(event);
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
  if (toolName !== 'list_entries') return message;
  const line = message.split('\n', 1)[0]?.trim();
  return line || 'listed entries';
}

export function isLookupOnlyTurn(events: AgentToolEvent[]): boolean {
  return events.length > 0 && events.every((event) => event.ok && event.toolName === 'list_entries');
}
