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

/**
 * Build generation style instructions based on selected perspective and tense tags.
 */
export function buildGenerationStyleInstructions(
  perspective: PerspectiveTag | null,
  tense: TenseTag | null
): string {
  if (!perspective || !tense) {
    throw new Error('Generation style requires one perspective tag and one tense tag.');
  }

  let perspectiveInstruction = '';
  switch (perspective) {
    case 'first_person':
      perspectiveInstruction = "Write in first person from the character's perspective (I, me, my).";
      break;
    case 'second_person':
      perspectiveInstruction = 'Write in second person, addressing the reader as "you".';
      break;
    case 'third_person':
      perspectiveInstruction = 'Write in third person (he, she, they).';
      break;
    case 'first_person_you':
      perspectiveInstruction =
        "Write in first person from the character's perspective (I, me, my), and refer to {{user}} as \"you\".";
      break;
  }

  let tenseInstruction = '';
  switch (tense) {
    case 'present_tense':
      tenseInstruction = 'Use present tense throughout.';
      break;
    case 'past_tense':
      tenseInstruction = 'Use past tense throughout.';
      break;
  }

  return `\n\n<generation_style>\n${perspectiveInstruction}\n${tenseInstruction}\n</generation_style>`;
}

export function buildDescriptionStyleInstructions(
  perspective: PerspectiveTag | null,
  tense: TenseTag | null
): string {
  if (!perspective || !tense) {
    throw new Error('Generation style requires one perspective tag and one tense tag.');
  }

  let perspectiveInstruction = '';
  switch (perspective) {
    case 'first_person':
      perspectiveInstruction =
        "Write description content in first person from the character's perspective (I, me, my).";
      break;
    case 'first_person_you':
      perspectiveInstruction =
        'Write description content in first person from the character\'s perspective, but refer to the player only as {{user}}. Do not address {{user}} as "you" in the description. Example: write "{{user}} is the only thing that feels stable in my life," not "You are the only thing that feels stable in my life."';
      break;
    case 'second_person':
    case 'third_person':
      perspectiveInstruction =
        'Write description content in third-person omniscient style (he, she, they, the character), describing the character rather than addressing the reader.';
      break;
  }

  const tenseInstruction =
    tense === 'present_tense'
      ? 'Use present tense throughout.'
      : 'Use past tense throughout.';

  return `\n\n<generation_style>\n${perspectiveInstruction}\n${tenseInstruction}\nDescriptions are character-card reference material, not an opening message. Do not write directly to the reader in description sections.</generation_style>`;
}

export function buildNarrationFormatInstruction(perspective: PerspectiveTag | null): string {
  switch (perspective) {
    case 'first_person':
      return 'Narrative/action text should use first person from the character\'s perspective; dialogue should still be quoted naturally.';
    case 'second_person':
      return 'Narrative/action text should use second person, addressing {{user}} as "you"; dialogue should still be quoted naturally.';
    case 'third_person':
      return 'Narrative/action text should use third person; dialogue should still be quoted naturally.';
    case 'first_person_you':
      return 'Narrative/action text should use first person from the character\'s perspective and refer to {{user}} as "you"; dialogue should still be quoted naturally.';
    default:
      throw new Error('Generation style requires a valid perspective tag.');
  }
}
