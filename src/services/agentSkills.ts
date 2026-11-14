import type { AgentSkill, CharacterVaultSettings } from '../db/characterTypes';
import { DEFAULT_AGENT_SKILLS } from '../db/characterTypes';

const NO_SKILLS: readonly AgentSkill[] = [];

/** The skills the Agent gets: none while skills are switched off, else the stored list or the defaults. */
export function activeAgentSkills(
  settings: Pick<CharacterVaultSettings, 'agentSkills' | 'ui'> | null | undefined,
): readonly AgentSkill[] {
  if (settings?.ui?.agentSkillsEnabled === false) return NO_SKILLS;
  return settings?.agentSkills ?? DEFAULT_AGENT_SKILLS;
}

export function cloneDefaultAgentSkills(): AgentSkill[] {
  return DEFAULT_AGENT_SKILLS.map((skill) => ({ ...skill }));
}

/** Stored skills, or the defaults when the user never edited the list. */
export function resolveAgentSkills(stored: readonly AgentSkill[] | undefined): AgentSkill[] {
  return stored ? stored.map((skill) => ({ ...skill })) : cloneDefaultAgentSkills();
}

/** Unedited defaults are stored as missing, so later default updates still reach the user. */
export function isDefaultAgentSkills(skills: readonly AgentSkill[]): boolean {
  return (
    skills.length === DEFAULT_AGENT_SKILLS.length &&
    skills.every((skill, index) => {
      const builtin = DEFAULT_AGENT_SKILLS[index];
      return (
        skill.enabled !== false &&
        skill.id === builtin.id &&
        skill.name === builtin.name &&
        skill.description === builtin.description &&
        skill.content === builtin.content
      );
    })
  );
}

export function findDefaultAgentSkill(id: string): AgentSkill | undefined {
  return DEFAULT_AGENT_SKILLS.find((skill) => skill.id === id);
}

export function isEditedDefaultSkill(skill: AgentSkill): boolean {
  const builtin = findDefaultAgentSkill(skill.id);
  return (
    !!builtin &&
    (skill.name !== builtin.name ||
      skill.description !== builtin.description ||
      skill.content !== builtin.content)
  );
}

export function createAgentSkillId(): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `skill-${suffix}`;
}

/** Returns undefined for anything that is not a skill list, so callers fall back to defaults. */
export function normalizeAgentSkills(value: unknown): AgentSkill[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: AgentSkill[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const record = raw as Record<string, unknown>;
    out.push({
      id: typeof record.id === 'string' && record.id ? record.id : createAgentSkillId(),
      name: typeof record.name === 'string' ? record.name : '',
      description: typeof record.description === 'string' ? record.description : '',
      content: typeof record.content === 'string' ? record.content : '',
      ...(record.enabled === false ? { enabled: false } : {}),
    });
  }
  return out;
}

export function validateAgentSkills(skills: readonly AgentSkill[]): string | null {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const skill of skills) {
    const name = skill.name.trim();
    if (!name) {
      if (skill.content.trim() || skill.description.trim()) errors.push('Skills: every skill needs a name');
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) errors.push(`Skills: two skills are named "${name}"`);
    seen.add(key);
  }
  return errors.length > 0 ? [...new Set(errors)].join('\n') : null;
}
