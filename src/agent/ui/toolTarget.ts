import { isCharacterAgentFieldId } from '../hosts/character/fields';
import type { AgentToolEvent, AgentToolTarget } from './types';

const FIELD_TOOLS = new Set(['update_field', 'replace_in_field', 'append_to_field']);
const GREETING_TOOLS = new Set([
  'add_greeting',
  'update_greeting',
  'replace_in_greeting',
  'delete_greeting',
  'move_greeting',
]);
const ENTRY_TOOLS = new Set(['add_entry', 'update_entry', 'replace_in_entry', 'delete_entry']);

export function parseToolTarget(toolName: string, ok: boolean, message: string): AgentToolTarget | undefined {
  if (!ok) return undefined;

  if (FIELD_TOOLS.has(toolName)) {
    const match = /^ok (\S+) \(/.exec(message);
    const id = match?.[1];
    if (id && isCharacterAgentFieldId(id)) return { type: 'field', id };
    return undefined;
  }

  if (GREETING_TOOLS.has(toolName)) {
    const deleted = /^ok deleted greeting (\d+)/.exec(message);
    if (deleted) return { type: 'greeting', index: Number(deleted[1]) };
    const moved = /^ok moved greeting \d+ → (\d+)/.exec(message);
    if (moved) return { type: 'greeting', index: Number(moved[1]) };
    const slot = /^ok greeting (\d+)\//.exec(message);
    if (slot) return { type: 'greeting', index: Number(slot[1]) };
    return undefined;
  }

  if (ENTRY_TOOLS.has(toolName)) {
    const match = /^ok #(\d+)\s/.exec(message);
    if (match) return { type: 'entry', id: Number(match[1]) };
  }

  return undefined;
}

/** Points a run's entry rows (text, link, and call id) at the ids its added entries were saved under. */
export function renumberEntryEvents(
  events: AgentToolEvent[],
  renumbered: ReadonlyMap<number, number>,
): AgentToolEvent[] {
  let changed = false;
  const next = events.map((event) => {
    if (event.target?.type !== 'entry') return event;
    const from = event.target.id;
    const id = renumbered.get(from);
    if (id == null) return event;
    changed = true;
    const call = event.call?.headers.id === String(from)
      ? { ...event.call, headers: { ...event.call.headers, id: String(id) } }
      : event.call;
    return { ...event, message: event.message.replace(/^ok #\d+/, `ok #${id}`), target: { type: 'entry' as const, id }, call };
  });
  return changed ? next : events;
}
