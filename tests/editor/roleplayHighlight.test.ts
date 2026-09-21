/**
 * @fileoverview Tests for "dialogue" / narration / *action* range detection.
 */

import { describe, it, expect } from 'vitest';
import { findRoleplayRanges } from '../../src/editor/extensions/roleplayHighlight';

function kinds(text: string): Array<{ kind: string; slice: string }> {
  return findRoleplayRanges(text).map((r) => ({ kind: r.kind, slice: text.slice(r.from, r.to) }));
}

describe('findRoleplayRanges', () => {
  it('returns empty for empty text', () => {
    expect(findRoleplayRanges('')).toEqual([]);
  });

  it('colors straight double-quoted dialogue with narration around it', () => {
    expect(kinds('He said "stay." loudly')).toEqual([
      { kind: 'narration', slice: 'He said ' },
      { kind: 'dialogue', slice: '"stay."' },
      { kind: 'narration', slice: ' loudly' },
    ]);
  });

  it('colors curly-quoted dialogue', () => {
    expect(kinds('“Stay with me.”')).toEqual([{ kind: 'dialogue', slice: '“Stay with me.”' }]);
  });

  it('leaves unclosed quotes as narration', () => {
    expect(kinds('He said "stay.')).toEqual([{ kind: 'narration', slice: 'He said "stay.' }]);
  });

  it('ignores single quotes and apostrophes', () => {
    expect(kinds("It's 'fine,' she said")).toEqual([
      { kind: 'narration', slice: "It's 'fine,' she said" },
    ]);
  });

  it('colors single-asterisk actions', () => {
    expect(kinds('*He steps closer.*')).toEqual([
      { kind: 'action', slice: '*He steps closer.*' },
    ]);
  });

  it('ignores **bold** markers', () => {
    expect(kinds('This is **bold** text')).toEqual([
      { kind: 'narration', slice: 'This is **bold** text' },
    ]);
  });

  it('lets dialogue win inside actions', () => {
    expect(kinds('*he said "hi" loudly*')).toEqual([
      { kind: 'action', slice: '*he said ' },
      { kind: 'dialogue', slice: '"hi"' },
      { kind: 'action', slice: ' loudly*' },
    ]);
  });

  it('keeps asterisks inside dialogue as dialogue', () => {
    expect(kinds('"she *laughed* loudly"')).toEqual([
      { kind: 'dialogue', slice: '"she *laughed* loudly"' },
    ]);
  });

  it('carves out {{char}} / {{user}} macros for the macro highlighter', () => {
    expect(kinds('"hi {{char}}"')).toEqual([
      { kind: 'dialogue', slice: '"hi ' },
      { kind: 'dialogue', slice: '"' },
    ]);
    expect(kinds('{{user}}')).toEqual([]);
  });

  it('finds multiple quotes and actions on one line', () => {
    expect(kinds('*a* "b" *c*')).toEqual([
      { kind: 'action', slice: '*a*' },
      { kind: 'narration', slice: ' ' },
      { kind: 'dialogue', slice: '"b"' },
      { kind: 'narration', slice: ' ' },
      { kind: 'action', slice: '*c*' },
    ]);
  });
});
