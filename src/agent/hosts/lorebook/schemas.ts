import type { AgentToolSpec } from '../../core/types';

export const LOREBOOK_TOOL_SPECS: readonly AgentToolSpec[] = [
  {
    name: 'list_entries',
    description:
      'Return id, name, and keys for every entry. Skip if the catalog in context is enough.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_entry',
    description: "Return one entry's name, keys, and content. Use before update_entry.",
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
      'Append a new world-info entry. One add_entry per name. Non-constant entries need at least one key.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        keys: {
          type: 'string',
          description: 'Comma-separated keys',
        },
        constant: { type: 'boolean' },
        content: { type: 'string', description: 'Entry body' },
      },
      required: ['content'],
    },
  },
  {
    name: 'update_entry',
    description:
      'Replace fields on an existing entry. Omit a field to leave it unchanged. Body in content is the full new content.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Entry id' },
        name: { type: 'string' },
        keys: { type: 'string', description: 'Comma-separated keys' },
        constant: { type: 'boolean' },
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
          description: 'Replacement text if new is omitted (XML body).',
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
];
