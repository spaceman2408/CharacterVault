import { describe, expect, it } from 'vitest';
import { createCharacterHost } from '../../../src/agent/hosts/character/createHost';
import { createLorebookHost } from '../../../src/agent/hosts/lorebook/createHost';
import { formatSkillsSection, readSkill, usableSkills } from '../../../src/agent/hosts/skills';
import { skillMentions } from '../../../src/agent/ui/mentions';
import { formatAgentBusyLabel } from '../../../src/agent/ui/busyLabel';
import type { AgentSkill, CharacterSpec } from '../../../src/db/characterTypes';
import { createEmptyCharacterBook } from '../../../src/db/characterTypes';

const SKILLS: AgentSkill[] = [
  { id: 'a', name: 'Greeting Writer', description: 'Use for greetings.', content: 'End on a hook.' },
  { id: 'b', name: 'Blank', description: 'Nothing here.', content: '   ' },
];

function action(headers: Record<string, string>) {
  return { name: 'read_skill', headers, body: '' };
}

function spec(): CharacterSpec {
  return {
    name: 'Aria',
    description: 'A cartographer.',
    personality: '',
    scenario: '',
    first_mes: 'Hello.',
    mes_example: '',
  } as CharacterSpec;
}

function characterHost(skills?: AgentSkill[]) {
  return createCharacterHost({
    getSpec: spec,
    getBook: () => createEmptyCharacterBook(),
    persist: async () => undefined,
    getCustomContext: async () => null,
    skills,
  });
}

function lorebookHost(skills?: AgentSkill[]) {
  return createLorebookHost({
    getBook: () => createEmptyCharacterBook('World'),
    setBook: async () => undefined,
    getCustomContext: async () => null,
    skills,
  });
}

describe('skills', () => {
  it('drops skills with no name or no instructions', () => {
    expect(usableSkills(SKILLS).map((skill) => skill.name)).toEqual(['Greeting Writer']);
    expect(usableSkills(undefined)).toEqual([]);
  });

  it('lists names and when-to-use lines, not instructions', () => {
    const section = formatSkillsSection(usableSkills(SKILLS));
    expect(section).toContain('- Greeting Writer — Use for greetings.');
    expect(section).not.toContain('End on a hook.');
  });

  it('reads a skill by name, ignoring case, @, and quotes', () => {
    for (const name of ['Greeting Writer', 'greeting writer', '@Greeting Writer', '“Greeting Writer”']) {
      const result = readSkill(SKILLS, action({ name }));
      expect(result.ok).toBe(true);
      expect(result.message).toBe('Skill: Greeting Writer\n\nEnd on a hook.');
    }
  });

  it('names the available skills when the name is unknown', () => {
    const result = readSkill(usableSkills(SKILLS), action({ name: 'Nope' }));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('skills: Greeting Writer');
  });

  it('offers usable skills as mentions', () => {
    expect(skillMentions(SKILLS)).toEqual([{ label: 'Greeting Writer', detail: 'Skill' }]);
  });

  it('labels the busy spinner with the skill name', () => {
    expect(formatAgentBusyLabel({ toolName: 'read_skill', headers: { name: 'Greeting Writer' } })).toBe(
      'Reading skill “Greeting Writer”',
    );
  });
});

describe.each([
  ['character', characterHost],
  ['lorebook', lorebookHost],
] as const)('%s host with skills', (_label, makeHost) => {
  it('adds read_skill and the Skills section only when there are usable skills', () => {
    const bare = makeHost([SKILLS[1]]);
    expect(bare.toolNames).not.toContain('read_skill');
    expect(bare.tools?.some((tool) => tool.name === 'read_skill')).toBe(false);
    expect(bare.buildSystemPrompt({ extraChunks: [] })).not.toContain('## Skills');

    const host = makeHost(SKILLS);
    expect(host.toolNames).toContain('read_skill');
    expect(host.tools?.some((tool) => tool.name === 'read_skill')).toBe(true);
    for (const toolMode of ['native', 'xml'] as const) {
      const prompt = host.buildSystemPrompt({ extraChunks: [], toolMode });
      expect(prompt).toContain('## Skills');
      expect(prompt).toContain('- read_skill — name.');
      expect(prompt).not.toContain('Blank');
    }
  });

  it('executes read_skill', async () => {
    const result = await makeHost(SKILLS).execute(action({ name: 'Greeting Writer' }));
    expect(result).toMatchObject({ ok: true, toolName: 'read_skill' });
  });

  it('treats read_skill as unknown without skills', async () => {
    const result = await makeHost([]).execute(action({ name: 'Greeting Writer' }));
    expect(result.ok).toBe(false);
  });
});
