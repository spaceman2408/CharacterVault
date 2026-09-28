import { describe, expect, it } from 'vitest';
import { emptyCharacterSpec } from '../../../src/agent/hosts/character/fields';
import { characterMentions, lorebookMentions } from '../../../src/agent/ui/mentions';
import { createEmptyCharacterBook, type CharacterBook } from '../../../src/db/characterTypes';

const BOOK: CharacterBook = {
  ...createEmptyCharacterBook(),
  entries: [
    { id: 4, name: 'Harbor', keys: ['harbor'], content: '', extensions: {}, enabled: true },
    { id: 7, keys: ['keep'], content: '', extensions: {}, enabled: true },
    { id: 9, keys: [], content: '', extensions: {}, enabled: true },
  ],
};

describe('lorebookMentions', () => {
  it('labels entries by name or first key, with the id', () => {
    expect(lorebookMentions(BOOK).map((mention) => mention.label)).toEqual([
      '“Harbor” (#4)',
      '“keep” (#7)',
      'Entry #9',
    ]);
  });
});

describe('characterMentions', () => {
  it('lists fields by their tab label, then greetings, then entries', () => {
    const spec = { ...emptyCharacterSpec(), alternate_greetings: ['Hello there, traveler.', ''] };
    const mentions = characterMentions(spec, BOOK);
    const labels = mentions.map((mention) => mention.label);
    expect(labels).toContain('Description');
    expect(labels).toContain('First Message');
    expect(labels.indexOf('Greeting 1')).toBeGreaterThan(labels.indexOf('Description'));
    expect(mentions.find((mention) => mention.label === 'Greeting 1')?.detail).toBe(
      'Hello there, traveler.',
    );
    expect(mentions.find((mention) => mention.label === 'Greeting 2')?.detail).toBe('Greeting');
    expect(labels.at(-1)).toBe('Entry #9');
  });
});
