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
    name: 'list_greetings',
    description:
      'Return index and length for each alternate greeting. first_mes is a separate field.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_greeting',
    description: 'Return one alternate greeting by 0-based index.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: '0-based greeting index' },
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
        index: { type: 'integer', description: '0-based greeting index' },
        content: { type: 'string', description: 'Full new greeting body' },
      },
      required: ['index', 'content'],
    },
  },
  {
    name: 'delete_greeting',
    description: 'Remove one alternate greeting by 0-based index. Later indexes shift down.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: '0-based greeting index' },
      },
      required: ['index'],
    },
  },
];
