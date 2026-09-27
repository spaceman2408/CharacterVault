import type { LorebookEntry } from '../../db/characterTypes';
import { fieldLabel, isCharacterAgentFieldId } from '../hosts/character/fields';
import { parseCommaList } from '../hosts/commaList';
import { findEntryById, parseEntryId } from '../hosts/lorebook/tools';
import type { AgentBusyAction } from './types';

const BUSY_LABELS: Record<string, string> = {
  list_fields: 'Listing fields',
  list_greetings: 'Listing greetings',
  add_greeting: 'Adding greeting',
  list_entries: 'Listing entries',
  search: 'Searching',
  replace_across: 'Replacing across',
  audit_card: 'Auditing card',
  audit_book: 'Auditing book',
  read_recursion: 'Reading recursion',
  update_book_settings: 'Updating book settings',
};

const FIELD_VERBS: Record<string, string> = {
  read_field: 'Reading',
  update_field: 'Updating',
  replace_in_field: 'Replacing in',
  append_to_field: 'Appending to',
};

const GREETING_VERBS: Record<string, string> = {
  read_greeting: 'Reading',
  update_greeting: 'Updating',
  replace_in_greeting: 'Replacing in',
  delete_greeting: 'Deleting',
};

const ENTRY_VERBS: Record<string, string> = {
  read_entry: 'Reading',
  update_entry: 'Updating',
  replace_in_entry: 'Replacing in',
  delete_entry: 'Deleting',
};

const QUOTE_MAX = 40;

function quoted(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return `“${flat.length > QUOTE_MAX ? `${flat.slice(0, QUOTE_MAX - 1)}…` : flat}”`;
}

function fieldTarget(raw: string | undefined): string {
  const id = (raw ?? '').trim();
  return isCharacterAgentFieldId(id) ? fieldLabel(id) : 'field';
}

function greetingIndex(raw: string | undefined): string | null {
  const index = (raw ?? '').trim();
  return /^[1-9]\d*$/.test(index) ? index : null;
}

function greetingTarget(raw: string | undefined): string {
  const index = greetingIndex(raw);
  return index ? `greeting ${index}` : 'greeting';
}

function entryTarget(raw: string | undefined, entries: LorebookEntry[]): string {
  const id = parseEntryId(raw);
  if (id == null) return 'entry';
  const entry = findEntryById(entries, id);
  const name = entry?.name?.trim() || entry?.keys?.[0]?.trim();
  return name ? `entry ${quoted(name)}` : `entry #${id}`;
}

export function formatAgentBusyLabel(action: AgentBusyAction, entries: LorebookEntry[] = []): string {
  const { toolName, headers } = action;
  if (FIELD_VERBS[toolName]) return `${FIELD_VERBS[toolName]} ${fieldTarget(headers.id)}`;
  if (GREETING_VERBS[toolName]) return `${GREETING_VERBS[toolName]} ${greetingTarget(headers.index)}`;
  if (ENTRY_VERBS[toolName]) return `${ENTRY_VERBS[toolName]} ${entryTarget(headers.id, entries)}`;

  if (toolName === 'move_greeting') {
    const to = greetingIndex(headers.to);
    const from = greetingTarget(headers.index);
    return to ? `Moving ${from} to ${to}` : `Moving ${from}`;
  }
  if (toolName === 'add_entry') {
    const name = (headers.name ?? '').trim() || parseCommaList(headers.keys)[0] || '';
    return name ? `Adding entry ${quoted(name)}` : 'Adding entry';
  }
  if (toolName === 'search' && headers.query?.trim()) {
    return `Searching ${quoted(headers.query)}`;
  }

  return BUSY_LABELS[toolName] ?? toolName.replace(/_/g, ' ');
}
