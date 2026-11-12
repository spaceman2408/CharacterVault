import type { AgentSkill } from '../../db/characterTypes';
import type { ActionResult, AgentToolSpec, ParsedAction } from '../core/types';

export const READ_SKILL_TOOL = 'read_skill';

export const READ_SKILL_TOOL_SPEC: AgentToolSpec = {
  name: READ_SKILL_TOOL,
  description:
    "Return one skill's full instructions from the Skills list in the system prompt. Read a skill before a task it covers, then follow it.",
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Skill name as listed under Skills' },
    },
    required: ['name'],
  },
};

export const READ_SKILL_TOOL_DOC =
  "- read_skill — name. Returns that skill's full instructions. Read it before a task the skill covers, then follow it.";

export function usableSkills(skills: readonly AgentSkill[] | undefined): AgentSkill[] {
  return (skills ?? []).filter((skill) => skill.name.trim() && skill.content.trim());
}

export function formatSkillsSection(skills: readonly AgentSkill[]): string {
  const lines = skills.map((skill) => {
    const description = skill.description.trim();
    return description ? `- ${skill.name.trim()} — ${description}` : `- ${skill.name.trim()}`;
  });
  return `## Skills
Skills are the user's saved instructions for specific tasks. Before starting a task a skill covers, call read_skill with its name and follow it; it overrides general habits but not the user's request. When the user writes @ and a skill name, read that skill first. Read each skill once per run.
${lines.join('\n')}`;
}

function normalizeSkillName(raw: string): string {
  return raw
    .trim()
    .replace(/^@/, '')
    .replace(/^["“”']+|["“”']+$/g, '')
    .trim()
    .toLowerCase();
}

export function readSkill(skills: readonly AgentSkill[], action: ParsedAction): ActionResult {
  const wanted = normalizeSkillName(action.headers.name ?? action.body ?? '');
  const skill = skills.find((candidate) => normalizeSkillName(candidate.name) === wanted);
  if (!skill) {
    const names = skills.map((candidate) => candidate.name.trim()).join(', ');
    return {
      ok: false,
      toolName: READ_SKILL_TOOL,
      message: `error: no skill named "${action.headers.name ?? ''}" (skills: ${names || 'none'})`,
    };
  }
  return {
    ok: true,
    toolName: READ_SKILL_TOOL,
    message: `Skill: ${skill.name.trim()}\n\n${skill.content.trim()}`,
  };
}
