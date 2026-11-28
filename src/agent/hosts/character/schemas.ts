import type { AgentToolSpec } from '../../core/types';
import { SUGGEST_NAMES_TOOL_SPEC } from '../names/suggestNames';
import { SUGGEST_PLACES_TOOL_SPEC } from '../names/suggestPlaces';

const FIELD_ID = { type: 'string', description: 'Field id' };
const GREETING_INDEX = { type: 'integer', description: '1-based; 1 is the first alternate (first_mes is a field)' };

const REPLACE_PROPERTIES = {
  new: { type: 'string', description: 'Replacement; empty deletes' },
  replace_all: { type: 'boolean', description: 'Replace every match instead of failing when old is not unique' },
};

export const CHARACTER_TOOL_SPECS: readonly AgentToolSpec[] = [
  {
    name: 'list_fields',
    description: 'Id, label, and tokens of every writable card field. Skip if the catalog in context is enough.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'read_field',
    description: "One field's full value. Read before editing it.",
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'name, description, personality, scenario, first_mes, mes_example, system_prompt, post_history_instructions, physical_description, creator_notes, creator, character_version, tags, or avatar',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_field',
    description: 'Replace a whole field. tags is a comma-separated string. Not for alternate greetings.',
    parameters: {
      type: 'object',
      properties: { id: FIELD_ID, content: { type: 'string', description: 'Full new value' } },
      required: ['id', 'content'],
    },
  },
  {
    name: 'replace_in_field',
    description:
      'Replace a unique snippet in one field, copied from your latest read_field (quotes and dashes match loosely). To delete a section, old can run from its first line to its last unique line. read_field again before another replace; if a large delete fails, use update_field. Not for alternate greetings.',
    parameters: {
      type: 'object',
      properties: { id: FIELD_ID, old: { type: 'string', description: 'Unique snippet' }, ...REPLACE_PROPERTIES },
      required: ['id', 'old'],
    },
  },
  {
    name: 'append_to_field',
    description: 'Append to a field after a blank line; tags are merged. Not for alternate greetings.',
    parameters: {
      type: 'object',
      properties: { id: FIELD_ID, content: { type: 'string' } },
      required: ['id', 'content'],
    },
  },
  {
    name: 'list_greetings',
    description: 'Index and tokens of each alternate greeting (1 is the first alternate; first_mes is a field).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'read_greeting',
    description: 'One alternate greeting.',
    parameters: { type: 'object', properties: { index: GREETING_INDEX }, required: ['index'] },
  },
  {
    name: 'add_greeting',
    description: 'Append an alternate greeting.',
    parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
  },
  {
    name: 'update_greeting',
    description: 'Replace one alternate greeting with content.',
    parameters: {
      type: 'object',
      properties: { index: GREETING_INDEX, content: { type: 'string', description: 'Full new greeting' } },
      required: ['index', 'content'],
    },
  },
  {
    name: 'replace_in_greeting',
    description:
      'Replace a unique snippet in one alternate greeting, copied from your latest read_greeting (quotes and dashes match loosely).',
    parameters: {
      type: 'object',
      properties: { index: GREETING_INDEX, old: { type: 'string', description: 'Unique snippet' }, ...REPLACE_PROPERTIES },
      required: ['index', 'old'],
    },
  },
  {
    name: 'delete_greeting',
    description: 'Remove one alternate greeting. Later ones shift down.',
    parameters: { type: 'object', properties: { index: GREETING_INDEX }, required: ['index'] },
  },
  {
    name: 'move_greeting',
    description: 'Move one alternate greeting to a new index. Others shift.',
    parameters: {
      type: 'object',
      properties: { index: GREETING_INDEX, to: { type: 'integer', description: '1-based destination' } },
      required: ['index', 'to'],
    },
  },
  {
    name: 'search',
    description:
      'Case-insensitive search of spec fields, alternate greetings, and the lorebook (names, keys, content). Returns places and short snippets.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'replace_across',
    description:
      'Replace a snippet in every spec field, alternate greeting, and lorebook name, keys, and content. Fails if any one place matches more than once, unless replace_all.',
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
    name: 'audit_card',
    description:
      'Read-only report: active tokens (in the SillyTavern character prompt) vs inactive (first_mes, alternate greetings, lorebook), plus duplicate keys, recursion, macros, and example dialogue blocks. Skips name, creator, creator_notes, character_version, and avatar.',
    parameters: { type: 'object', properties: {} },
  },
  SUGGEST_NAMES_TOOL_SPEC,
  SUGGEST_PLACES_TOOL_SPEC,
];
