import type { AgentToolSpec } from '../core/types';
import { CHARACTER_TOOL_SPECS } from './character/schemas';
import { CHARACTER_OVERRIDES_LOREBOOK_TOOLS, type CharacterToolName } from './character/tools';
import { LOREBOOK_TOOL_SPECS } from './lorebook/schemas';
import type { LorebookToolName } from './lorebook/tools';
import { READ_SKILL_TOOL, READ_SKILL_TOOL_SPEC } from './skills';

export type AgentKind = 'card' | 'lorebook';

export interface AgentToolInfo {
  name: string;
  summary: string;
  agents: AgentKind[];
}

export interface AgentToolGroup {
  label: string;
  tools: AgentToolInfo[];
}

const GROUPS = ['Card fields', 'Alternate greetings', 'Lorebook', 'Search and checks', 'Helpers'] as const;
type GroupLabel = (typeof GROUPS)[number];

const NOTES: Record<
  CharacterToolName | LorebookToolName | typeof READ_SKILL_TOOL,
  { group: GroupLabel; summary: string }
> = {
  list_fields: { group: 'Card fields', summary: 'List the card fields and their token sizes.' },
  read_field: { group: 'Card fields', summary: 'Read one field in full, e.g. description or first_mes.' },
  update_field: { group: 'Card fields', summary: "Replace a field's whole text." },
  replace_in_field: { group: 'Card fields', summary: 'Replace a snippet inside a field.' },
  append_to_field: { group: 'Card fields', summary: 'Add text to the end of a field.' },
  list_greetings: { group: 'Alternate greetings', summary: 'List the alternate greetings and their token sizes.' },
  read_greeting: { group: 'Alternate greetings', summary: 'Read one alternate greeting by number.' },
  add_greeting: { group: 'Alternate greetings', summary: 'Add an alternate greeting.' },
  update_greeting: { group: 'Alternate greetings', summary: "Replace an alternate greeting's whole text." },
  replace_in_greeting: { group: 'Alternate greetings', summary: 'Replace a snippet inside an alternate greeting.' },
  delete_greeting: { group: 'Alternate greetings', summary: 'Delete an alternate greeting.' },
  move_greeting: { group: 'Alternate greetings', summary: 'Move an alternate greeting to a new position.' },
  list_entries: { group: 'Lorebook', summary: 'List entries with keys, token sizes, and flags, plus book settings.' },
  read_entry: { group: 'Lorebook', summary: 'Read one entry in full.' },
  add_entry: { group: 'Lorebook', summary: 'Add an entry with keys and content.' },
  update_entry: { group: 'Lorebook', summary: "Change an entry's name, keys, content, or activation settings." },
  replace_in_entry: { group: 'Lorebook', summary: 'Replace a snippet inside an entry.' },
  delete_entry: { group: 'Lorebook', summary: 'Delete an entry.' },
  update_book_settings: {
    group: 'Lorebook',
    summary: 'Change scan depth, token budget, recursive scanning, name, or description.',
  },
  search: { group: 'Search and checks', summary: 'Find text and show where it appears.' },
  replace_across: { group: 'Search and checks', summary: 'Replace a snippet everywhere it appears.' },
  audit_card: {
    group: 'Search and checks',
    summary: 'Report token use, duplicate keys, macros, and other card issues.',
  },
  audit_book: {
    group: 'Search and checks',
    summary: 'Report entry counts, token size, duplicate keys, empty entries, and recursion loops.',
  },
  read_recursion: { group: 'Search and checks', summary: 'Show which entries can trigger which.' },
  test_keys: { group: 'Search and checks', summary: 'Show which entries some sample chat text would trigger.' },
  suggest_names: { group: 'Helpers', summary: 'Suggest names by origin, skipping overused AI names.' },
  read_skill: { group: 'Helpers', summary: "Load a skill's instructions." },
};

const AGENT_SPECS: readonly [AgentKind, readonly AgentToolSpec[]][] = [
  [
    'card',
    [
      ...CHARACTER_TOOL_SPECS,
      ...LOREBOOK_TOOL_SPECS.filter((spec) => !CHARACTER_OVERRIDES_LOREBOOK_TOOLS.has(spec.name)),
      READ_SKILL_TOOL_SPEC,
    ],
  ],
  ['lorebook', [...LOREBOOK_TOOL_SPECS, READ_SKILL_TOOL_SPEC]],
];

function buildReference(): AgentToolGroup[] {
  const tools = new Map<string, AgentToolInfo>();
  for (const [agent, specs] of AGENT_SPECS) {
    for (const spec of specs) {
      const known = tools.get(spec.name);
      if (known) known.agents.push(agent);
      else tools.set(spec.name, { name: spec.name, summary: '', agents: [agent] });
    }
  }
  return GROUPS.map((label) => ({
    label,
    tools: Object.entries(NOTES).flatMap(([name, note]) => {
      const tool = tools.get(name);
      return tool && note.group === label ? [{ ...tool, summary: note.summary }] : [];
    }),
  }));
}

/** Every tool either agent can call, grouped for the Agent Skills glossary. */
export const AGENT_TOOL_REFERENCE: readonly AgentToolGroup[] = buildReference();
