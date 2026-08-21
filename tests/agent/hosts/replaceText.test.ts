import { describe, expect, it } from 'vitest';
import {
  countOccurrences,
  replaceText,
  replacementText,
  searchText,
} from '../../../src/agent/hosts/replaceText';

describe('countOccurrences', () => {
  it('counts non-overlapping matches', () => {
    expect(countOccurrences('aaa', 'aa')).toBe(1);
    expect(countOccurrences('ababab', 'ab')).toBe(3);
    expect(countOccurrences('keep', 'x')).toBe(0);
  });
});

describe('replaceText', () => {
  it('replaces a unique snippet', () => {
    const result = replaceText('A quiet cartographer.', 'quiet', 'careful', false);
    expect(result).toEqual({ ok: true, text: 'A careful cartographer.', count: 1 });
  });

  it('rejects a missing snippet', () => {
    const result = replaceText('A quiet cartographer.', 'loud', 'careful', false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('old not found');
  });

  it('rejects an empty old string', () => {
    const result = replaceText('hello', '', 'x', false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('old is empty');
  });

  it('rejects a non-unique snippet unless replace_all', () => {
    const blocked = replaceText('red red fox', 'red', 'blue', false);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.message).toContain('matches 2 times');

    const all = replaceText('red red fox', 'red', 'blue', true);
    expect(all).toEqual({ ok: true, text: 'blue blue fox', count: 2 });
  });

  it('does not interpret $ in the replacement', () => {
    const result = replaceText('cost is X', 'X', '$100', false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe('cost is $100');
  });

  it('matches curly quotes and dashes in the source against straight old text', () => {
    const source =
      "1. Keep characters\u2019 heights in mind\n2. Weave attire naturally when needed\u2014full motion";
    const result = replaceText(
      source,
      "1. Keep characters' heights in mind",
      '1. Keep height in mind',
      false,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe(
        '1. Keep height in mind\n2. Weave attire naturally when needed\u2014full motion',
      );
    }
  });

  it('refuses to delete a markdown heading alone', () => {
    const source =
      '## Commands for generating response\n1. Keep characters\' heights in mind\n2. Emphasize motion';
    const result = replaceText(source, '## Commands for generating response', '', false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('deleting a heading leaves the section body');
  });

  it('deletes a section from a unique first line through a unique last line', () => {
    const source = [
      '## Core Rules',
      '12. NPCs cannot control {{user}} or know their unspoken thoughts',
      '',
      '## Commands for generating response',
      "1. Keep characters' heights and stature in mind when generating responses",
      '2. Emphasize how present characters act, talk, and move',
      '11. Last command with "quotes" and an em dash \u2014 here',
    ].join('\n');
    const result = replaceText(
      source,
      [
        '## Commands for generating response',
        'WRONG MIDDLE WITH STRAIGHT QUOTES',
        '11. Last command with "quotes" and an em dash - here',
      ].join('\n'),
      '',
      false,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe(
        '## Core Rules\n12. NPCs cannot control {{user}} or know their unspoken thoughts\n\n',
      );
      expect(result.text).not.toContain('Commands for generating response');
      expect(result.text).not.toContain('Keep characters');
    }
  });

  it('hints when only the first line of a multiline old matches', () => {
    const source = [
      '## Commands for generating response',
      '1. Keep characters\' heights in mind',
      '2. Emphasize motion',
    ].join('\n');
    const result = replaceText(
      source,
      ['## Commands for generating response', 'this last line is not in the field'].join('\n'),
      '',
      false,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('first line matched once');
  });
});

describe('replacementText', () => {
  it('uses the new header when present, otherwise the body', () => {
    expect(replacementText({ name: 'replace_in_field', headers: { new: 'from-header' }, body: 'from-body' })).toBe(
      'from-header',
    );
    expect(replacementText({ name: 'replace_in_field', headers: {}, body: 'from-body' })).toBe('from-body');
  });
});

describe('searchText', () => {
  it('uses the old header when present, otherwise the body if new is set', () => {
    expect(searchText({ name: 'replace_in_field', headers: { old: 'from-header' }, body: 'from-body' })).toBe(
      'from-header',
    );
    expect(searchText({ name: 'replace_in_field', headers: { new: '' }, body: 'from-body' })).toBe(
      'from-body',
    );
  });
});
