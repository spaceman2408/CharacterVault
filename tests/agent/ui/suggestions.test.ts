import { describe, expect, it } from 'vitest';
import { emptyCharacterSpec } from '../../../src/agent/hosts/character/fields';
import { characterSuggestions, lorebookSuggestions } from '../../../src/agent/ui/suggestions';
import {
  createEmptyCharacterBook,
  type CharacterBook,
  type CharacterSpec,
  type LorebookEntry,
} from '../../../src/db/characterTypes';

function spec(overrides: Partial<CharacterSpec> = {}): CharacterSpec {
  return { ...emptyCharacterSpec(), ...overrides };
}

function book(entries: Array<Partial<LorebookEntry>> = []): CharacterBook {
  return {
    ...createEmptyCharacterBook(),
    entries: entries.map((entry, id) => ({
      id,
      keys: ['k'],
      content: 'body',
      extensions: {},
      enabled: true,
      ...entry,
    })),
  };
}

const FULL_CARD = spec({
  description: 'A sailor.',
  first_mes: 'Ahoy.',
  alternate_greetings: ['Hello.'],
});

describe('characterSuggestions', () => {
  it('starts a blank card with the description and first message', () => {
    expect(characterSuggestions(spec(), book(), false)).toEqual([
      'Write a description',
      'Write a first message',
    ]);
  });

  it('offers alternate greetings once there is a first message', () => {
    expect(
      characterSuggestions(spec({ description: 'A sailor.', first_mes: 'Ahoy.' }), book([{}]), false),
    ).toEqual(['Write 2 alternate greetings', 'Audit this card', 'Summarize my lorebook']);
  });

  it('offers a lorebook from custom context when the book is empty', () => {
    expect(characterSuggestions(FULL_CARD, book(), true)).toEqual([
      'Build a lorebook from my custom context',
      'Audit this card',
      'Write me one more alternate greeting',
    ]);
    expect(characterSuggestions(FULL_CARD, book(), false)).not.toContain(
      'Build a lorebook from my custom context',
    );
  });

  it('keeps the usual chips for a finished card', () => {
    expect(characterSuggestions(FULL_CARD, book([{}]), true)).toEqual([
      'Audit this card',
      'Summarize my lorebook',
      'Write me one more alternate greeting',
    ]);
  });

  it('never offers the optional fields the persona leaves alone', () => {
    const labels = [
      characterSuggestions(spec(), book(), true),
      characterSuggestions(spec({ description: 'x' }), book(), true),
      characterSuggestions(FULL_CARD, book([{}]), true),
    ].flat();
    for (const label of labels) {
      expect(label).not.toMatch(/appearance|personality|scenario|system|post-history/i);
    }
  });
});

describe('lorebookSuggestions', () => {
  it('shows nothing for an empty book without custom context', () => {
    expect(lorebookSuggestions(book(), false)).toEqual([]);
  });

  it('builds from custom context when the book is empty', () => {
    expect(lorebookSuggestions(book(), true)).toEqual(['Build a lorebook from my custom context']);
  });

  it('extends from custom context and lists constants only when there are some', () => {
    expect(lorebookSuggestions(book([{ constant: true }]), true)).toEqual([
      'Add entries from my custom context',
      'Audit this book',
      'List my constant entries',
    ]);
    expect(lorebookSuggestions(book([{}]), false)).toEqual([
      'Audit this book',
      'Summarize my longest entry',
    ]);
  });
});
