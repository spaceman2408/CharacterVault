/**
 * @fileoverview Tests for {{char}} / {{user}} name-macro range detection.
 */

import { describe, it, expect } from 'vitest';
import { findNameMacroRanges } from '../../src/editor/extensions/macroHighlight';

describe('findNameMacroRanges', () => {
  it('finds lowercase {{char}} and {{user}}', () => {
    const text = 'Hi {{user}}! This is {{char}}.';
    const ranges = findNameMacroRanges(text);
    expect(ranges).toEqual([
      { from: 3, to: 11, kind: 'user' },
      { from: 21, to: 29, kind: 'char' },
    ]);
    expect(text.slice(ranges[0].from, ranges[0].to)).toBe('{{user}}');
    expect(text.slice(ranges[1].from, ranges[1].to)).toBe('{{char}}');
  });

  it('matches case-insensitive names', () => {
    const text = '{{Char}} {{USER}} {{UsEr}} {{cHaR}}';
    const ranges = findNameMacroRanges(text);
    expect(ranges.map((r) => ({ kind: r.kind, slice: text.slice(r.from, r.to) }))).toEqual([
      { kind: 'char', slice: '{{Char}}' },
      { kind: 'user', slice: '{{USER}}' },
      { kind: 'user', slice: '{{UsEr}}' },
      { kind: 'char', slice: '{{cHaR}}' },
    ]);
  });

  it('allows optional whitespace inside braces', () => {
    const text = '{{ char }} and {{  user  }}';
    const ranges = findNameMacroRanges(text);
    expect(ranges).toHaveLength(2);
    expect(ranges[0].kind).toBe('char');
    expect(ranges[1].kind).toBe('user');
    expect(text.slice(ranges[0].from, ranges[0].to)).toBe('{{ char }}');
    expect(text.slice(ranges[1].from, ranges[1].to)).toBe('{{  user  }}');
  });

  it('ignores other macros and incomplete braces', () => {
    const text = '{{time}} {{random::a}} {{char {{user}} {char} user char {{char';
    const ranges = findNameMacroRanges(text);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].kind).toBe('user');
    expect(text.slice(ranges[0].from, ranges[0].to)).toBe('{{user}}');
  });

  it('returns empty for text with no macros', () => {
    expect(findNameMacroRanges('Hello world')).toEqual([]);
    expect(findNameMacroRanges('')).toEqual([]);
  });

  it('finds adjacent macros without overlap', () => {
    const text = '{{user}}{{char}}';
    const ranges = findNameMacroRanges(text);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ from: 0, to: 8, kind: 'user' });
    expect(ranges[1]).toEqual({ from: 8, to: 16, kind: 'char' });
  });
});
