/**
 * @fileoverview Prompt templates for AI character generation
 * @module @pages/ai-creation-studio/generationPrompts
 */

import type { PerspectiveTag, TenseTag } from './tags/tagData';
import type { StudioPrompts } from '../../db/characterTypes';

export type StudioPromptKey = keyof StudioPrompts;

export interface StudioTemplateVars {
  concept: string;
  name: string;
  description: string;
  styleBlock: string;
  narrationRule: string;
  firstMessageBlock: string;
}

export const STUDIO_PROMPT_REQUIRED_VARS: Record<StudioPromptKey, string[]> = {
  system: [],
  name: ['concept'],
  description: ['concept', 'name'],
  first_mes: ['concept', 'name', 'description'],
  mes_example: ['concept', 'name', 'description'],
};

export const STUDIO_PROMPT_OPTIONAL_VARS: Record<StudioPromptKey, Array<keyof StudioTemplateVars>> = {
  system: [],
  name: [],
  description: ['styleBlock'],
  first_mes: ['styleBlock', 'narrationRule'],
  mes_example: ['styleBlock', 'narrationRule', 'firstMessageBlock'],
};

export function renderStudioTemplate(
  template: string,
  vars: Partial<StudioTemplateVars>
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`\${${key}}`).join(value ?? '');
  }
  return out;
}

export function buildRevisionBlock(previous: string | undefined, note: string): string {
  const previousBlock = previous?.trim() ? `\n\nPrevious version:\n${previous.trim()}` : '';
  return `\n\n<revision>${previousBlock}\n\nWrite a new version that follows this note: ${note.trim()}\nKeep everything the note does not ask to change, and follow all the rules above.\n</revision>`;
}

export function replaceNameWithCharMacro(text: string, name: string): string {
  const full = name.trim();
  if (!full) return text;
  const parts = full.split(/\s+/).filter((part) => part !== full && part.length >= 3 && /^\p{Lu}/u.test(part));
  let out = text;
  for (const part of [full, ...parts]) {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gu'), '{{char}}');
  }
  return out;
}

export function validateStudioPrompts(prompts: Partial<Record<StudioPromptKey, string>>): string | null {
  const errors: string[] = [];
  const keys = Object.keys(STUDIO_PROMPT_REQUIRED_VARS) as StudioPromptKey[];
  for (const key of keys) {
    const template = prompts[key] ?? '';
    if (!template.trim()) {
      errors.push(`Studio ${key} prompt must not be empty`);
      continue;
    }
    for (const variable of STUDIO_PROMPT_REQUIRED_VARS[key]) {
      if (!template.includes(`\${${variable}}`)) {
        errors.push(`Studio ${key} prompt must contain \${${variable}}`);
      }
    }
  }
  return errors.length > 0 ? errors.join('\n') : null;
}

const TENSE_RULES: Record<TenseTag, string> = {
  present_tense: 'Present tense for narration and actions ("she turns").',
  past_tense: 'Past tense for narration and actions ("she turned").',
};

function requireStyleTags(perspective: PerspectiveTag | null, tense: TenseTag | null): asserts perspective is PerspectiveTag {
  if (!perspective || !tense) {
    throw new Error('Generation style requires one perspective tag and one tense tag.');
  }
}

export function buildGenerationStyleInstructions(
  perspective: PerspectiveTag | null,
  tense: TenseTag | null
): string {
  requireStyleTags(perspective, tense);
  const perspectiveRules: Record<PerspectiveTag, string> = {
    first_person: 'First person, as the character (I, me, my).',
    second_person: 'Second person: "you" is {{user}}.',
    third_person: 'Third person (he, she, they).',
    first_person_you: 'First person, as the character (I, me, my), calling {{user}} "you".',
  };
  return `\n\nStyle:\n- ${perspectiveRules[perspective]}\n- ${TENSE_RULES[tense!]}`;
}

export function buildDescriptionStyleInstructions(
  perspective: PerspectiveTag | null,
  tense: TenseTag | null
): string {
  requireStyleTags(perspective, tense);
  const perspectiveRules: Record<PerspectiveTag, string> = {
    first_person: 'First person, as the character (I, me, my).',
    first_person_you: 'First person, as the character (I, me, my). Call the player {{user}}, never "you".',
    second_person: 'Third person, describing the character. Never address the reader as "you".',
    third_person: 'Third person, describing the character. Never address the reader as "you".',
  };
  return `\n\nStyle:\n- ${perspectiveRules[perspective]}\n- ${tense === 'present_tense' ? 'Present tense.' : 'Past tense.'}`;
}

export function buildNarrationFormatInstruction(perspective: PerspectiveTag | null): string {
  switch (perspective) {
    case 'first_person':
    case 'third_person':
      return 'Refer to {{user}} as {{user}}, not "you".';
    case 'second_person':
      return '{{user}} is already in the scene. Use "you" only for what {{user}} sees, hears, or physically senses, never for what they do, say, or decide.';
    case 'first_person_you':
      return '"You" is {{user}}.';
    default:
      throw new Error('Generation style requires a valid perspective tag.');
  }
}
