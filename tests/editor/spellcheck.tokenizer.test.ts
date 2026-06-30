/**
 * @fileoverview Tests for the spellcheck tokenizer ignore-rule logic.
 *
 * Pure-function tests that don't require a CodeMirror view or a built
 * dictionary. They cover the behavior the in-editor extension ultimately
 * relies on when walking text and deciding what to spellcheck.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TOKENIZER_OPTIONS,
  tokenize,
  findCodeFenceRanges,
  findInlineCodeRanges,
  findMacroRanges,
  type TokenizerOptions,
} from '../../src/editor/spellcheck/tokenizer';

const NO_IGNORE: TokenizerOptions = {
  ignoreCodeFences: false,
  ignoreInlineCode: false,
  ignoreMacros: false,
  ignoreNumbers: false,
  ignoreAllCaps: false,
};

function wordsOnly(text: string, opts: TokenizerOptions = DEFAULT_TOKENIZER_OPTIONS): string[] {
  return tokenize(text, opts)
    .filter((t) => t.skipped === undefined)
    .map((t) => t.word);
}

describe('tokenizer — basic word extraction', () => {
  it('extracts lowercase words and preserves case', () => {
    expect(wordsOnly('Hello World', NO_IGNORE)).toEqual(['Hello', 'World']);
  });

  it('keeps hyphens inside words', () => {
    expect(wordsOnly('state-of-the-art', NO_IGNORE)).toEqual(['state-of-the-art']);
  });

  it('keeps apostrophes (curly) inside words', () => {
    expect(wordsOnly("don't", NO_IGNORE)).toEqual(["don't"]);
  });

  it('skips pure punctuation', () => {
    expect(wordsOnly('... !? ---', NO_IGNORE)).toEqual([]);
  });

  it('populates wordLower for downstream ignore/custom comparison', () => {
    const tokens = tokenize('Hello World', NO_IGNORE);
    expect(tokens[0]).toMatchObject({ word: 'Hello', wordLower: 'hello' });
    expect(tokens[1]).toMatchObject({ word: 'World', wordLower: 'world' });
  });
});

describe('tokenizer — ignore rules', () => {
  it('skips code fences', () => {
    const text = [
      'Before missspelling here',
      '```js',
      'var missspelling = 1; // inside fence',
      '```',
      'After missspelling again',
    ].join('\n');
    const tokens = tokenize(text);
    const inside = tokens.find((t) => t.word === 'inside');
    const before = tokens.find((t) => t.word === 'Before');
    expect(inside?.skipped).toBe('inCodeFence');
    expect(before?.skipped).toBeUndefined();
  });

  it('skips inline code spans', () => {
    const tokens = tokenize('Hello `fooBar` world');
    const inline = tokens.find((t) => t.wordLower === 'foobar');
    expect(inline?.skipped).toBe('inInlineCode');
    const world = tokens.find((t) => t.wordLower === 'world');
    expect(world?.skipped).toBeUndefined();
  });

  it('skips macro placeholders', () => {
    const tokens = tokenize('Hello {{char}}! and {{user}} spells colour');
    expect(tokens.find((t) => t.wordLower === 'char')?.skipped).toBe('macroPlaceholder');
    expect(tokens.find((t) => t.wordLower === 'user')?.skipped).toBe('macroPlaceholder');
    expect(tokens.find((t) => t.wordLower === 'colour')?.skipped).toBeUndefined();
  });

  it('skips pure numbers', () => {
    const tokens = tokenize('I have 42 cats and 3.14 pi');
    expect(tokens.find((t) => t.wordLower === '42')?.skipped).toBe('number');
    // "3.14" splits into two numeric tokens `3` and `14`
    expect(tokens.find((t) => t.wordLower === '3')?.skipped).toBe('number');
    expect(tokens.find((t) => t.wordLower === '14')?.skipped).toBe('number');
  });

  it('skips ALL-CAPS tokens', () => {
    const tokens = tokenize('NASA and ABC while lowercase stays');
    expect(tokens.find((t) => t.wordLower === 'nasa')?.skipped).toBe('allCaps');
    expect(tokens.find((t) => t.wordLower === 'abc')?.skipped).toBe('allCaps');
    expect(tokens.find((t) => t.wordLower === 'lowercase')?.skipped).toBeUndefined();
  });

  it('can disable individual rules', () => {
    const opts: TokenizerOptions = { ...DEFAULT_TOKENIZER_OPTIONS, ignoreAllCaps: false };
    const tokens = tokenize('NASA flight', opts);
    expect(tokens.find((t) => t.wordLower === 'nasa')?.skipped).toBeUndefined();
  });
});

describe('tokenizer — range helpers', () => {
  it('findCodeFenceRanges finds balanced fences', () => {
    const text = 'before\n```\ninside\n```\nafter';
    const ranges = findCodeFenceRanges(text);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].from).toBeLessThan(ranges[0].to);
  });

  it('findInlineCodeRanges handles backticks', () => {
    const text = 'a `b` c `d e` f';
    const ranges = findInlineCodeRanges(text);
    expect(ranges).toHaveLength(2);
  });

  it('findMacroRanges finds placeholders', () => {
    const ranges = findMacroRanges('Hi {{user}}! This is {{char}}.');
    expect(ranges).toHaveLength(2);
  });
});
