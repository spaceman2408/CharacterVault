import type { CharacterBook, CharacterSpec } from '../../db/characterTypes';

const MAX_SUGGESTIONS = 3;

function isBlank(text: string | undefined): boolean {
  return !text?.trim();
}

function pick(candidates: Array<string | false>): string[] {
  return candidates.filter((label): label is string => Boolean(label)).slice(0, MAX_SUGGESTIONS);
}

// Never offer Appearance, Personality, Scenario, System prompt, or Post-history;
// the agent persona treats those as optional (hosts/character/prompt.ts).
export function characterSuggestions(
  spec: CharacterSpec,
  book: CharacterBook,
  hasCustomContext: boolean,
): string[] {
  const entries = book.entries.length;
  const greetings = spec.alternate_greetings?.length ?? 0;
  return pick([
    isBlank(spec.description) && 'Write a description',
    isBlank(spec.first_mes) && 'Write a first message',
    !isBlank(spec.first_mes) && greetings === 0 && 'Write 2 alternate greetings',
    entries === 0 && hasCustomContext && 'Build a lorebook from my custom context',
    !isBlank(spec.description) && 'Audit this card',
    entries > 0 && 'Summarize my lorebook',
    greetings > 0 && 'Write me one more alternate greeting',
  ]);
}

export function lorebookSuggestions(book: CharacterBook, hasCustomContext: boolean): string[] {
  const hasEntries = book.entries.length > 0;
  return pick([
    !hasEntries && hasCustomContext && 'Build a lorebook from my custom context',
    hasEntries && hasCustomContext && 'Add entries from my custom context',
    hasEntries && 'Audit this book',
    book.entries.some((entry) => entry.constant) && 'List my constant entries',
    hasEntries && 'Summarize my longest entry',
  ]);
}
