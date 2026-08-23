import type { CharacterBook, CharacterSpec } from '../../../db/characterTypes';
import { estimateTokens } from '../../../services/AIService';
import { estimateBookContentTokens, formatBookAudit } from '../lorebook/audit';
import { getFieldValue, type CharacterAgentFieldId } from './fields';

/** Spec fields `audit_card` reports. name, creator, creator_notes, character_version, and avatar are omitted. */
export const CHARACTER_AUDIT_FIELD_IDS = [
  'description',
  'first_mes',
  'mes_example',
  'scenario',
  'physical_description',
  'personality',
  'system_prompt',
  'post_history_instructions',
  'tags',
] as const satisfies readonly CharacterAgentFieldId[];

/** Empty is fine when description already contains that material. */
export const CHARACTER_AUDIT_DESCRIPTION_COVERED_FIELD_IDS = [
  'physical_description',
  'personality',
] as const satisfies readonly CharacterAgentFieldId[];

/** Empty is fine; description does not need to cover these. */
export const CHARACTER_AUDIT_OPTIONAL_FIELD_IDS = [
  'scenario',
  'system_prompt',
  'post_history_instructions',
] as const satisfies readonly CharacterAgentFieldId[];

/** Always-on SillyTavern character-prompt fields. first_mes and alts are not included. */
export const CHARACTER_AUDIT_ACTIVE_FIELD_IDS = [
  'description',
  'personality',
  'physical_description',
  'scenario',
  'system_prompt',
  'post_history_instructions',
  'mes_example',
] as const satisfies readonly CharacterAgentFieldId[];

const NON_REQUIRED_FIELD_ID_SET = new Set<string>([
  ...CHARACTER_AUDIT_DESCRIPTION_COVERED_FIELD_IDS,
  ...CHARACTER_AUDIT_OPTIONAL_FIELD_IDS,
]);

const CHARACTER_AUDIT_REQUIRED_FIELD_IDS = CHARACTER_AUDIT_FIELD_IDS.filter(
  (id) => !NON_REQUIRED_FIELD_ID_SET.has(id),
);

const MACRO_FIELDS = [
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'system_prompt',
  'post_history_instructions',
  'physical_description',
] as const;

function fieldHasMacro(text: string, macro: '{{char}}' | '{{user}}'): boolean {
  return text.toLowerCase().includes(macro);
}

function collectMacroPlaces(spec: CharacterSpec, macro: '{{char}}' | '{{user}}'): string[] {
  const places: string[] = [];
  for (const id of MACRO_FIELDS) {
    if (fieldHasMacro(getFieldValue(spec, id), macro)) places.push(id);
  }
  (spec.alternate_greetings ?? []).forEach((greeting, index) => {
    if (fieldHasMacro(greeting ?? '', macro)) places.push(`greeting ${index + 1}`);
  });
  return places;
}

export function formatCardAudit(spec: CharacterSpec, book: CharacterBook): string {
  const requiredFilled = CHARACTER_AUDIT_REQUIRED_FIELD_IDS.filter(
    (id) => getFieldValue(spec, id).trim().length > 0,
  );
  const requiredEmpty = CHARACTER_AUDIT_REQUIRED_FIELD_IDS.filter(
    (id) => getFieldValue(spec, id).trim().length === 0,
  );
  const descriptionCoveredEmpty = CHARACTER_AUDIT_DESCRIPTION_COVERED_FIELD_IDS.filter(
    (id) => getFieldValue(spec, id).trim().length === 0,
  );
  const optionalEmpty = CHARACTER_AUDIT_OPTIONAL_FIELD_IDS.filter(
    (id) => getFieldValue(spec, id).trim().length === 0,
  );
  const greetings = spec.alternate_greetings ?? [];
  const emptyGreetings = greetings.filter((greeting) => !greeting.trim()).length;
  let activeTokens = 0;
  for (const id of CHARACTER_AUDIT_ACTIVE_FIELD_IDS) {
    activeTokens += estimateTokens(getFieldValue(spec, id));
  }
  const firstMesTokens = estimateTokens(spec.first_mes ?? '');
  let altGreetingTokens = 0;
  for (const greeting of greetings) {
    altGreetingTokens += estimateTokens(greeting);
  }
  const lorebookTokens = estimateBookContentTokens(book);

  const header = `Card audit — ${requiredFilled.length}/${CHARACTER_AUDIT_REQUIRED_FIELD_IDS.length} required filled, ${greetings.length} greeting${
    greetings.length === 1 ? '' : 's'
  }, ${(book.entries ?? []).length} ${
    (book.entries ?? []).length === 1 ? 'entry' : 'entries'
  }`;

  const lines = [
    header,
    `Active ~${activeTokens} (in ST prompt: description, personality, physical_description, scenario, system_prompt, post_history_instructions, mes_example)`,
    `Inactive: first_mes ~${firstMesTokens}; ${greetings.length} greeting${
      greetings.length === 1 ? '' : 's'
    } ~${altGreetingTokens} (one greeting used per chat); lorebook ~${lorebookTokens} (World Info, keyed/budgeted)`,
  ];
  if (requiredEmpty.length > 0) {
    lines.push(`Empty fields: ${requiredEmpty.join(', ')}`);
  }
  if (descriptionCoveredEmpty.length > 0) {
    lines.push(
      `Empty (ok if in description): ${descriptionCoveredEmpty.join(', ')}`,
    );
  }
  if (optionalEmpty.length > 0) {
    lines.push(`Empty (optional): ${optionalEmpty.join(', ')}`);
  }
  if (emptyGreetings > 0) {
    lines.push(`Empty greetings: ${emptyGreetings}`);
  }

  const charPlaces = collectMacroPlaces(spec, '{{char}}');
  const userPlaces = collectMacroPlaces(spec, '{{user}}');
  if (charPlaces.length > 0 || userPlaces.length > 0) {
    const bits: string[] = [];
    if (charPlaces.length > 0) bits.push(`{{char}} in ${charPlaces.join(', ')}`);
    if (userPlaces.length > 0) bits.push(`{{user}} in ${userPlaces.join(', ')}`);
    lines.push(`Macros: ${bits.join('; ')}`);
  } else {
    lines.push('Macros: none');
  }

  lines.push(formatBookAudit(book));
  return lines.join('\n');
}
