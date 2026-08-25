import type { AgentToolSpec } from '../../core/types';

export const LOREBOOK_TOOL_SPECS: readonly AgentToolSpec[] = [
  {
    name: 'list_entries',
    description:
      'Return id, name, keys, token size, and notable flags for every entry, plus book settings. Skip if the catalog in context is enough.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_entry',
    description:
      "Return one entry's name, keys, common activation fields, and content. Use before update_entry.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Entry id' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_entry',
    description:
      'Append a new world-info entry. One add_entry per name. Non-constant entries need at least one key. Optional activation: enabled, position, depth, insertion_order, secondary_keys, selective, probability, excludeRecursion, preventRecursion, delayUntilRecursion.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        keys: {
          type: 'string',
          description: 'Comma-separated keys',
        },
        constant: { type: 'boolean' },
        enabled: { type: 'boolean', description: 'When false, the entry never activates. Default true.' },
        position: {
          type: 'string',
          description:
            'before_char, after_char, before_example, after_example, or at_depth. Default before_char.',
        },
        depth: {
          type: 'integer',
          description: 'Chat depth when position is at_depth. Default 4.',
        },
        insertion_order: {
          type: 'integer',
          description: 'Higher numbers insert later and usually weigh more.',
        },
        secondary_keys: {
          type: 'string',
          description: 'Comma-separated optional filter keys. Sets selective true if omitted.',
        },
        selective: {
          type: 'boolean',
          description: 'Require secondary_keys logic. Default true when secondary_keys is set.',
        },
        probability: {
          type: 'integer',
          description: '0–100 chance the entry inserts after it would activate.',
        },
        excludeRecursion: {
          type: 'boolean',
          description: 'Non-recursable: other entries cannot unlock this one by naming its keys.',
        },
        preventRecursion: {
          type: 'boolean',
          description: 'Once this entry activates, it will not unlock further entries.',
        },
        delayUntilRecursion: {
          type: 'boolean',
          description: 'Only activates on recursive passes, not the initial chat scan.',
        },
        content: { type: 'string', description: 'Entry body' },
      },
      required: ['content'],
    },
  },
  {
    name: 'update_entry',
    description:
      'Replace fields on an existing entry. Omit a field to leave it unchanged. Body in content is the full new content. Optional activation: enabled, position, depth, insertion_order, secondary_keys, selective, probability, excludeRecursion, preventRecursion, delayUntilRecursion.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Entry id' },
        name: { type: 'string' },
        keys: { type: 'string', description: 'Comma-separated keys' },
        constant: { type: 'boolean' },
        enabled: { type: 'boolean' },
        position: {
          type: 'string',
          description: 'before_char, after_char, before_example, after_example, or at_depth',
        },
        depth: { type: 'integer', description: 'Chat depth when position is at_depth' },
        insertion_order: { type: 'integer' },
        secondary_keys: { type: 'string', description: 'Comma-separated optional filter keys' },
        selective: { type: 'boolean' },
        probability: { type: 'integer', description: '0–100' },
        excludeRecursion: {
          type: 'boolean',
          description: 'Non-recursable: other entries cannot unlock this one by naming its keys.',
        },
        preventRecursion: {
          type: 'boolean',
          description: 'Once this entry activates, it will not unlock further entries.',
        },
        delayUntilRecursion: {
          type: 'boolean',
          description: 'Only activates on recursive passes, not the initial chat scan.',
        },
        content: { type: 'string', description: 'Full new entry body' },
      },
      required: ['id'],
    },
  },
  {
    name: 'replace_in_entry',
    description:
      'Replace a unique snippet in one entry body. Quotes and dashes are matched flexibly. For a section delete, old can be the first line through the last unique line; empty new deletes that span. After a replace, read_entry before another. Prefer update_entry if a large delete fails. Copy old from the latest read.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Entry id' },
        old: {
          type: 'string',
          description:
            'Unique snippet to find. For a section delete, first line through last unique line is enough.',
        },
        new: { type: 'string', description: 'Replacement text. Empty deletes the snippet.' },
        content: {
          type: 'string',
          description: 'Replacement text if new is omitted.',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace every match. Default false (fail if old is not unique).',
        },
      },
      required: ['id', 'old'],
    },
  },
  {
    name: 'delete_entry',
    description: 'Remove an entry by id. No need to read it first unless unsure.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Entry id' },
      },
      required: ['id'],
    },
  },
  {
    name: 'search',
    description:
      'Find text in entry names, keys, filters, and content. Case-insensitive. Returns locations and short snippets, not full bodies.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to find' },
      },
      required: ['query'],
    },
  },
  {
    name: 'replace_across',
    description:
      'Replace a snippet in every matching entry name, keys, filters, and content (and book name/description). Same unique-match rules as replace_in_entry. Fail if any one place matches more than once unless replace_all is true. Copy old from a search or read.',
    parameters: {
      type: 'object',
      properties: {
        old: { type: 'string', description: 'Snippet to find. Quotes and dashes need not match exactly.' },
        new: { type: 'string', description: 'Replacement text. Empty deletes the snippet.' },
        content: {
          type: 'string',
          description: 'Replacement text if new is omitted.',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace every match in each place. Default false (fail if a place is not unique).',
        },
      },
      required: ['old'],
    },
  },
  {
    name: 'audit_book',
    description:
      'Read-only report: entry counts, token size, duplicate keys, empty entries, and recursion edges/cycles. No bodies.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_recursion',
    description:
      'Return the lorebook recursion map (who can unlock whom via primary keys). Same graph as the editor. Optional id focuses on one entry’s incoming and outgoing edges. No bodies.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
          description: 'Optional entry id. Omit for the whole-book map.',
        },
      },
    },
  },
  {
    name: 'update_book_settings',
    description:
      'Update lorebook scan_depth, token_budget, recursive_scanning, name, or description. Omit a field to leave it unchanged.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        scan_depth: {
          type: 'integer',
          description: 'How many recent chat messages are scanned for keys. 0 = recursion / Author’s Note only.',
        },
        token_budget: {
          type: 'integer',
          description: 'Max tokens World Info may consume at once.',
        },
        recursive_scanning: {
          type: 'boolean',
          description: 'When true, activated entries can unlock others by naming their keys.',
        },
      },
    },
  },
];
