import type { CharacterSpec } from '../../../db/characterTypes';
import {
  CHARACTER_AGENT_FIELD_IDS,
  fieldLabel,
  getFieldValue,
  greetingNumber,
  type CharacterAgentFieldId,
} from './fields';

function fieldChars(spec: CharacterSpec, id: CharacterAgentFieldId): number {
  if (id === 'tags') return spec.tags?.length ?? 0;
  return getFieldValue(spec, id).length;
}

function fieldCatalogLine(spec: CharacterSpec, id: CharacterAgentFieldId): string {
  if (id === 'tags') {
    const count = spec.tags?.length ?? 0;
    return `${id} (${fieldLabel(id)}) — ${count} tag${count === 1 ? '' : 's'}`;
  }
  return `${id} (${fieldLabel(id)}) — ${fieldChars(spec, id)} chars`;
}

export function formatFieldCatalog(spec: CharacterSpec): string {
  const greetings = spec.alternate_greetings ?? [];
  const lines = CHARACTER_AGENT_FIELD_IDS.map((id) => fieldCatalogLine(spec, id));
  lines.push(
    `alternate_greetings — ${greetings.length} greeting${greetings.length === 1 ? '' : 's'} (use greeting tools; first_mes is a separate field)`,
  );
  return `Current card fields (id, size; bodies omitted):\n${lines.join('\n')}`;
}

export function formatGreetingCatalog(spec: CharacterSpec): string {
  const greetings = spec.alternate_greetings ?? [];
  if (greetings.length === 0) {
    return 'Alternate greetings:\n(none)';
  }
  const lines = greetings.map(
    (greeting, index) => `${greetingNumber(index)} — ${greeting.length} chars`,
  );
  return `Alternate greetings (${greetings.length}):\n${lines.join('\n')}`;
}

export function formatFieldRead(spec: CharacterSpec, id: CharacterAgentFieldId): string {
  const value = getFieldValue(spec, id);
  return `${id} (${fieldLabel(id)}) — ${value.length} chars\n---\n${value}`;
}

export function formatGreetingRead(
  greetings: string[],
  index: number,
): string {
  const body = greetings[index] ?? '';
  return `greeting ${greetingNumber(index)}/${greetings.length}\n---\n${body}`;
}
