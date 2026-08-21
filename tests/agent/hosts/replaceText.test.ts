import { describe, expect, it } from 'vitest';
import {
  countOccurrences,
  replaceText,
  replacementText,
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
});

describe('replacementText', () => {
  it('uses the new header when present, otherwise the body', () => {
    expect(replacementText({ name: 'replace_in_field', headers: { new: 'from-header' }, body: 'from-body' })).toBe(
      'from-header',
    );
    expect(replacementText({ name: 'replace_in_field', headers: {}, body: 'from-body' })).toBe('from-body');
  });
});
