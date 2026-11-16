import { describe, expect, it } from 'vitest';
import { AGENT_TOOL_REFERENCE, type AgentKind } from '../../../src/agent';
import { createCharacterHost } from '../../../src/agent/hosts/character/createHost';
import { createLorebookHost } from '../../../src/agent/hosts/lorebook/createHost';
import type { AgentSkill, CharacterSpec } from '../../../src/db/characterTypes';
import { createEmptyCharacterBook } from '../../../src/db/characterTypes';

const skills: AgentSkill[] = [{ id: 'a', name: 'A', description: '', content: 'x' }];

const hosts: Record<AgentKind, { toolNames: readonly string[] }> = {
  card: createCharacterHost({
    getSpec: () => ({ name: 'Aria' }) as CharacterSpec,
    getBook: () => createEmptyCharacterBook(),
    persist: async () => undefined,
    getCustomContext: async () => null,
    skills,
  }),
  lorebook: createLorebookHost({
    getBook: () => createEmptyCharacterBook('World'),
    setBook: async () => undefined,
    getCustomContext: async () => null,
    skills,
  }),
};

const tools = AGENT_TOOL_REFERENCE.flatMap((group) => group.tools);
const byName = new Map(tools.map((tool) => [tool.name, tool]));

describe('agent tool reference', () => {
  it('lists every tool each agent can call, and no others', () => {
    for (const agent of ['card', 'lorebook'] as const) {
      const listed = tools.filter((tool) => tool.agents.includes(agent)).map((tool) => tool.name);
      expect(listed.sort()).toEqual([...hosts[agent].toolNames].sort());
    }
    expect(byName.size).toBe(tools.length);
  });

  it('gives each tool a summary and leaves no group empty', () => {
    for (const group of AGENT_TOOL_REFERENCE) expect(group.tools.length).toBeGreaterThan(0);
    for (const tool of tools) expect(tool.summary.trim()).not.toBe('');
  });

  it('marks tools only one agent has', () => {
    expect(byName.get('read_field')?.agents).toEqual(['card']);
    expect(byName.get('audit_book')?.agents).toEqual(['lorebook']);
    expect(byName.get('add_entry')?.agents).toEqual(['card', 'lorebook']);
  });
});
