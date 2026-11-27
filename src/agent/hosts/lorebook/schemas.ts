import type { AgentToolSpec } from '../../core/types';
import { SUGGEST_NAMES_TOOL_SPEC } from '../names/suggestNames';
import { SUGGEST_PLACES_TOOL_SPEC } from '../names/suggestPlaces';

const ENTRY_ID = { type: 'integer', description: 'Entry id' };

const ACTIVATION_PROPERTIES = {
  name: { type: 'string' },
  keys: { type: 'string', description: 'Comma-separated' },
  constant: { type: 'boolean' },
  enabled: { type: 'boolean', description: 'false: never activates (default true)' },
  position: {
    type: 'string',
    description: 'before_char (default), after_char, before_example, after_example, or at_depth',
  },
  depth: { type: 'integer', description: 'Chat depth for at_depth (default 4)' },
  insertion_order: { type: 'integer', description: 'Higher inserts later and usually weighs more' },
  secondary_keys: { type: 'string', description: 'Comma-separated filter keys; sets selective' },
  selective: { type: 'boolean' },
  probability: { type: 'integer', description: '0–100 chance to insert once activated' },
  excludeRecursion: { type: 'boolean', description: 'Other entries cannot unlock this one' },
  preventRecursion: { type: 'boolean', description: 'This entry does not unlock others' },
  delayUntilRecursion: { type: 'boolean', description: 'Activates only on recursive passes' },
};

const REPLACE_PROPERTIES = {
  new: { type: 'string', description: 'Replacement; empty deletes' },
  replace_all: { type: 'boolean', description: 'Replace every match instead of failing when old is not unique' },
};

export const LOREBOOK_TOOL_SPECS: readonly AgentToolSpec[] = [
  {
    name: 'list_entries',
    description: 'Id, name, keys, tokens, and flags of every entry, plus book settings. Skip if the catalog in context is enough.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'read_entry',
    description: "One entry's name, keys, activation fields, and content. Read before editing it.",
    parameters: { type: 'object', properties: { id: ENTRY_ID }, required: ['id'] },
  },
  {
    name: 'add_entry',
    description: 'Add a world-info entry, one per name. Non-constant entries need keys.',
    parameters: {
      type: 'object',
      properties: { ...ACTIVATION_PROPERTIES, content: { type: 'string', description: 'Entry body' } },
      required: ['content'],
    },
  },
  {
    name: 'update_entry',
    description: 'Change an entry. Omitted fields stay as they are; content replaces the whole body.',
    parameters: {
      type: 'object',
      properties: { id: ENTRY_ID, ...ACTIVATION_PROPERTIES, content: { type: 'string', description: 'Full new body' } },
      required: ['id'],
    },
  },
  {
    name: 'replace_in_entry',
    description:
      'Replace a unique snippet in one entry body, copied from your latest read_entry (quotes and dashes match loosely). To delete a section, old can run from its first line to its last unique line. read_entry again before another replace; if a large delete fails, use update_entry.',
    parameters: {
      type: 'object',
      properties: { id: ENTRY_ID, old: { type: 'string', description: 'Unique snippet' }, ...REPLACE_PROPERTIES },
      required: ['id', 'old'],
    },
  },
  {
    name: 'delete_entry',
    description: 'Remove an entry. No need to read it first.',
    parameters: { type: 'object', properties: { id: ENTRY_ID }, required: ['id'] },
  },
  {
    name: 'search',
    description: 'Case-insensitive search of entry names, keys, filters, and content. Returns places and short snippets.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'replace_across',
    description:
      'Replace a snippet in every entry name, keys, filters, and content, and the book name and description. Fails if any one place matches more than once, unless replace_all.',
    parameters: {
      type: 'object',
      properties: {
        old: { type: 'string', description: 'Copied from a search or read; quotes and dashes match loosely' },
        ...REPLACE_PROPERTIES,
      },
      required: ['old'],
    },
  },
  {
    name: 'audit_book',
    description: 'Read-only report: entry counts, tokens, duplicate keys, empty entries, and recursion edges and cycles.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'read_recursion',
    description: 'Recursion map: which entries can unlock which through primary keys, as in the editor. id narrows it to one entry.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'integer', description: 'Optional entry id' } },
    },
  },
  {
    name: 'test_keys',
    description:
      'Which entries some sample chat text would activate and the key that matched, including constants, secondary keys, and recursive passes when recursive_scanning is on. Also lists key hits that stay inactive and why.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'A message or two a user might write' } },
      required: ['text'],
    },
  },
  {
    name: 'update_book_settings',
    description: 'Change the book name, description, scan_depth, token_budget, or recursive_scanning. Omitted fields stay.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        scan_depth: { type: 'integer', description: 'Recent messages scanned for keys; 0 = recursion and Author’s Note only' },
        token_budget: { type: 'integer', description: 'Max tokens World Info may use at once' },
        recursive_scanning: { type: 'boolean', description: 'Activated entries can unlock others by naming their keys' },
      },
    },
  },
  SUGGEST_NAMES_TOOL_SPEC,
  SUGGEST_PLACES_TOOL_SPEC,
];
