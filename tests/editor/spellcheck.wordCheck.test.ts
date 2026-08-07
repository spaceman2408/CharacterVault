/**
 * @fileoverview Tests for hyphen-aware spell correctness.
 */

import { describe, it, expect } from 'vitest';
import { isWordCorrect, type SpellCheckerLike } from '../../src/editor/spellcheck/wordCheck';

function mockSpell(words: readonly string[]): SpellCheckerLike {
  const set = new Set(words.map((w) => w));
  return {
    correct(word: string): boolean {
      return set.has(word);
    },
  };
}

describe('isWordCorrect', () => {
  it('accepts words present in the dictionary', () => {
    const spell = mockSpell(['soft', 'spoken', 'hello']);
    expect(isWordCorrect(spell, 'hello')).toBe(true);
  });

  it('rejects unknown single words', () => {
    const spell = mockSpell(['soft', 'spoken']);
    expect(isWordCorrect(spell, 'missspelled')).toBe(false);
  });

  it('accepts hyphenated compounds when every segment is known', () => {
    const spell = mockSpell(['soft', 'spoken', 'well', 'known', 'state', 'of', 'the', 'art']);
    expect(isWordCorrect(spell, 'soft-spoken')).toBe(true);
    expect(isWordCorrect(spell, 'well-known')).toBe(true);
    expect(isWordCorrect(spell, 'state-of-the-art')).toBe(true);
  });

  it('rejects hyphenated compounds when any segment is unknown', () => {
    const spell = mockSpell(['soft', 'spoken', 'well']);
    expect(isWordCorrect(spell, 'soft-xyzzy')).toBe(false);
    expect(isWordCorrect(spell, 'xyzzy-spoken')).toBe(false);
    expect(isWordCorrect(spell, 'well-known')).toBe(false);
  });

  it('prefers the full-form dictionary entry when present', () => {
    const spell = mockSpell(['soft-spoken']);
    expect(isWordCorrect(spell, 'soft-spoken')).toBe(true);
  });

  it('treats empty or punctuation-only hyphen runs as incorrect', () => {
    const spell = mockSpell(['soft']);
    expect(isWordCorrect(spell, '-')).toBe(false);
    expect(isWordCorrect(spell, '--')).toBe(false);
  });

  it('accepts trailing or leading hyphens when the remaining segment is known', () => {
    const spell = mockSpell(['soft', 'spoken']);
    expect(isWordCorrect(spell, 'soft-')).toBe(true);
    expect(isWordCorrect(spell, '-spoken')).toBe(true);
  });

  it('preserves original case when checking segments', () => {
    const spell = mockSpell(['Soft', 'Spoken']);
    expect(isWordCorrect(spell, 'Soft-Spoken')).toBe(true);
    expect(isWordCorrect(spell, 'soft-spoken')).toBe(false);
  });

  it('swallows spell.correct throws and treats the word as correct', () => {
    const spell: SpellCheckerLike = {
      correct(): boolean {
        throw new Error('boom');
      },
    };
    expect(isWordCorrect(spell, 'anything')).toBe(true);
    expect(isWordCorrect(spell, 'soft-spoken')).toBe(true);
  });
});
