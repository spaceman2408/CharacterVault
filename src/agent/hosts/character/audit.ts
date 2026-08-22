import type { CharacterBook, CharacterSpec } from '../../../db/characterTypes';
import { estimateCharacterCardTokens } from '../../../services/AIService';
import { formatBookAudit } from '../lorebook/audit';
import { CHARACTER_AGENT_FIELD_IDS, fieldLabel, getFieldValue } from './fields';

const MACRO_FIELDS = [
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
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
  const filled = CHARACTER_AGENT_FIELD_IDS.filter((id) => getFieldValue(spec, id).trim().length > 0);
  const empty = CHARACTER_AGENT_FIELD_IDS.filter((id) => getFieldValue(spec, id).trim().length === 0);
  const greetings = spec.alternate_greetings ?? [];
  const emptyGreetings = greetings.filter((greeting) => !greeting.trim()).length;
  const tokens = estimateCharacterCardTokens({ spec, characterBook: book }, spec.name);

  const header = `Card audit — ${filled.length}/${CHARACTER_AGENT_FIELD_IDS.length} fields filled, ${greetings.length} greeting${
    greetings.length === 1 ? '' : 's'
  }, ${(book.entries ?? []).length} ${
    (book.entries ?? []).length === 1 ? 'entry' : 'entries'
  }, ~${tokens.active} active / ~${tokens.total} total tokens`;

  const lines = [header];
  if (empty.length > 0) {
    lines.push(`Empty fields: ${empty.map((id) => fieldLabel(id)).join(', ')}`);
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
