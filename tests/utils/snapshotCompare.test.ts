import { describe, expect, it } from 'vitest';
import { snapshotValuesMatch } from '../../src/utils/snapshotCompare';

describe('snapshotValuesMatch', () => {
  it('treats missing, null, empty string, empty array, and empty object as the same', () => {
    expect(snapshotValuesMatch(undefined, '')).toBe(true);
    expect(snapshotValuesMatch(null, '')).toBe(true);
    expect(snapshotValuesMatch(undefined, [])).toBe(true);
    expect(snapshotValuesMatch(undefined, {})).toBe(true);
    expect(snapshotValuesMatch({ name: '', extensions: {} }, {})).toBe(true);
  });

  it('treats CRLF and LF line endings as the same', () => {
    expect(snapshotValuesMatch('one\r\ntwo', 'one\ntwo')).toBe(true);
    expect(snapshotValuesMatch({ entries: [{ content: 'a\r\nb' }] }, { entries: [{ content: 'a\nb' }] })).toBe(true);
  });

  it('treats a key that is missing on one side like an empty value', () => {
    expect(snapshotValuesMatch({ a: 1 }, { a: 1, b: '' })).toBe(true);
    expect(snapshotValuesMatch({ a: 1, b: { c: [] } }, { a: 1 })).toBe(true);
    expect(snapshotValuesMatch({ a: 1 }, { a: 1, b: 'x' })).toBe(false);
    expect(snapshotValuesMatch({ a: 1, b: 'x' }, { a: 1 })).toBe(false);
  });

  it('does not treat a number and its string as the same', () => {
    expect(snapshotValuesMatch(1, '1')).toBe(false);
    expect(snapshotValuesMatch([1], ['1'])).toBe(false);
  });

  it('ignores key order', () => {
    expect(snapshotValuesMatch({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('still sees real changes', () => {
    expect(snapshotValuesMatch('one', 'two')).toBe(false);
    expect(snapshotValuesMatch('text', 'text ')).toBe(false);
    expect(snapshotValuesMatch({ constant: false }, {})).toBe(false);
    expect(snapshotValuesMatch([1, 2], [2, 1])).toBe(false);
  });

  it('keeps empty items in arrays so a blank greeting still counts', () => {
    expect(snapshotValuesMatch(['', 'Hi'], ['Hi'])).toBe(false);
    expect(snapshotValuesMatch([''], [])).toBe(false);
  });
});
