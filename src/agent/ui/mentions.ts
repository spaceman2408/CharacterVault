import type { ComposerMention } from '../../components/ai/composerMentions';
import type { CharacterBook, CharacterSpec } from '../../db/characterTypes';
import { CHARACTER_AGENT_FIELD_IDS, fieldLabel, greetingNumber } from '../hosts/character/fields';

const SNIPPET_MAX = 40;

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > SNIPPET_MAX ? `${flat.slice(0, SNIPPET_MAX - 1)}…` : flat;
}

export function lorebookMentions(book: CharacterBook): ComposerMention[] {
  return book.entries.map((entry) => {
    const name = entry.name?.trim() || entry.comment?.trim() || entry.keys?.[0]?.trim();
    return {
      label: name ? `“${name}” (#${entry.id})` : `Entry #${entry.id}`,
      detail: 'Entry',
    };
  });
}

export function characterMentions(spec: CharacterSpec, book: CharacterBook): ComposerMention[] {
  return [
    ...CHARACTER_AGENT_FIELD_IDS.map((id) => ({ label: fieldLabel(id), detail: 'Field' })),
    ...(spec.alternate_greetings ?? []).map((greeting, index) => ({
      label: `Greeting ${greetingNumber(index)}`,
      detail: snippet(greeting) || 'Greeting',
    })),
    ...lorebookMentions(book),
  ];
}
