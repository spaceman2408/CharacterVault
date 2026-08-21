import type { CharacterSpec } from '../../../db/characterTypes';
import { CHARACTER_SECTIONS } from '../../../db/characterTypes';

export const CHARACTER_AGENT_FIELD_IDS = [
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'system_prompt',
  'post_history_instructions',
  'physical_description',
  'creator_notes',
  'creator',
  'character_version',
  'tags',
  'avatar',
] as const;

export type CharacterAgentFieldId = (typeof CHARACTER_AGENT_FIELD_IDS)[number];

const FIELD_ID_SET = new Set<string>(CHARACTER_AGENT_FIELD_IDS);

const FIELD_LABELS: Record<CharacterAgentFieldId, string> = Object.fromEntries(
  CHARACTER_SECTIONS.filter((section) => FIELD_ID_SET.has(section.id)).map((section) => [
    section.id,
    section.label,
  ]),
) as Record<CharacterAgentFieldId, string>;

export function isCharacterAgentFieldId(id: string): id is CharacterAgentFieldId {
  return FIELD_ID_SET.has(id);
}

export function fieldLabel(id: CharacterAgentFieldId): string {
  return FIELD_LABELS[id] ?? id;
}

export function validFieldIdsList(): string {
  return CHARACTER_AGENT_FIELD_IDS.join(', ');
}

export function emptyCharacterSpec(): CharacterSpec {
  return {
    name: '',
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    physical_description: '',
  };
}

export function cloneSpec(spec: CharacterSpec): CharacterSpec {
  return {
    ...spec,
    alternate_greetings: [...(spec.alternate_greetings ?? [])],
    tags: spec.tags ? [...spec.tags] : spec.tags,
  };
}

export function parseCommaList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function getFieldValue(spec: CharacterSpec, id: CharacterAgentFieldId): string {
  if (id === 'tags') {
    return (spec.tags ?? []).join(', ');
  }
  const value = spec[id];
  return typeof value === 'string' ? value : '';
}

export function setFieldValue(
  spec: CharacterSpec,
  id: CharacterAgentFieldId,
  content: string,
): CharacterSpec {
  const next = cloneSpec(spec);
  if (id === 'tags') {
    next.tags = parseCommaList(content);
    return next;
  }
  next[id] = content;
  return next;
}

export function parseGreetingIndex(raw: string | undefined, length: number): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^#/, '');
  if (!/^\d+$/.test(trimmed)) return null;
  const index = Number(trimmed);
  if (!Number.isInteger(index) || index < 0 || index >= length) return null;
  return index;
}
