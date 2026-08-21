import type { AgentToolSpec } from '../../core/types';

export const CHARACTER_TOOL_SPECS: readonly AgentToolSpec[] = [
  {
    name: 'list_fields',
    description:
      'Return id, label, and size for every writable card field. Skip if the catalog in context is enough.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_field',
    description: "Return one field's full current value. Use before update_field.",
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Field id: name, description, personality, scenario, first_mes, mes_example, system_prompt, post_history_instructions, physical_description, creator_notes, creator, character_version, tags, avatar',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_field',
    description:
      'Replace one field with content. Full replace. tags is a comma-separated string. Do not use this for alternate greetings.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Field id' },
        content: { type: 'string', description: 'Full new field value' },
      },
      required: ['id', 'content'],
    },
  },
  {
    name: 'replace_in_field',
    description:
      'Replace a unique snippet. Quotes and dashes are matched flexibly. For a section delete, old can be the first line through the last unique line; empty new deletes that span. After a replace, read_field before another. Prefer update_field if a large delete fails. Copy old from the latest read. Do not use this for alternate greetings.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Field id' },
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
    name: 'list_greetings',
    description:
      'Return 1-based index and length for each alternate greeting. Greeting 1 is the first alternate. first_mes is a separate field.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_greeting',
    description: 'Return one alternate greeting by 1-based index. Greeting 1 is the first alternate.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: '1-based greeting index. Greeting 1 is the first alternate.' },
      },
      required: ['index'],
    },
  },
  {
    name: 'add_greeting',
    description: 'Append an alternate greeting.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Greeting body' },
      },
      required: ['content'],
    },
  },
  {
    name: 'update_greeting',
    description: 'Replace one alternate greeting. content is the full new body.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: '1-based greeting index. Greeting 1 is the first alternate.' },
        content: { type: 'string', description: 'Full new greeting body' },
      },
      required: ['index', 'content'],
    },
  },
  {
    name: 'replace_in_greeting',
    description:
      'Replace a unique snippet in one alternate greeting. Quotes and dashes are matched flexibly. Copy old from the latest read_greeting.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: '1-based greeting index. Greeting 1 is the first alternate.' },
        old: {
          type: 'string',
          description: 'Unique snippet to find. Quotes and dashes need not match exactly.',
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
      required: ['index', 'old'],
    },
  },
  {
    name: 'delete_greeting',
    description:
      'Remove one alternate greeting by 1-based index. Greeting 1 is the first alternate. Later indexes shift down.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: '1-based greeting index. Greeting 1 is the first alternate.' },
      },
      required: ['index'],
    },
  },
];
