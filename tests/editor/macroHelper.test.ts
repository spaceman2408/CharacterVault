/**
 * @fileoverview Tests for the {{char}} / {{user}} typing helper.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { characterMacroHelper, resolveMacroReplacement } from '../../src/editor/extensions/characterMacroHelper';

describe('resolveMacroReplacement', () => {
  it('resolves lowercase words', () => {
    expect(resolveMacroReplacement('char')).toBe('{{char}}');
    expect(resolveMacroReplacement('user')).toBe('{{user}}');
  });

  it('resolves case-insensitively', () => {
    expect(resolveMacroReplacement('Char')).toBe('{{char}}');
    expect(resolveMacroReplacement('CHAR')).toBe('{{char}}');
    expect(resolveMacroReplacement('User')).toBe('{{user}}');
    expect(resolveMacroReplacement('USER')).toBe('{{user}}');
    expect(resolveMacroReplacement('uSeR')).toBe('{{user}}');
  });

  it('returns null for non-macro words', () => {
    expect(resolveMacroReplacement('')).toBeNull();
    expect(resolveMacroReplacement('character')).toBeNull();
    expect(resolveMacroReplacement('users')).toBeNull();
    expect(resolveMacroReplacement('{{char}}')).toBeNull();
  });
});

describe('characterMacroHelper typing', () => {
  const type = (doc: string, insert: string, userEvent = 'input.type') => {
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.length },
      extensions: [characterMacroHelper()],
    });
    const tr = state.update({
      changes: { from: doc.length, insert },
      selection: { anchor: doc.length + insert.length },
      userEvent,
    });
    return { doc: tr.state.doc.toString(), caret: tr.state.selection.main.head };
  };

  it('converts the word when a completion character is typed after it', () => {
    expect(type('Hello user', ' ')).toEqual({ doc: 'Hello {{user}} ', caret: 15 });
    expect(type('Ask char', '?').doc).toBe('Ask {{char}}?');
  });

  it('converts on Enter and Tab', () => {
    expect(type('Hi user', '\n', 'input').doc).toBe('Hi {{user}}\n');
    expect(type('Hi char', '\t', 'input').doc).toBe('Hi {{char}}\t');
  });

  it('leaves longer words and word characters alone', () => {
    expect(type('Hello username', ' ').doc).toBe('Hello username ');
    expect(type('Hello user', 'n').doc).toBe('Hello usern');
  });

  it('does not convert pasted text', () => {
    expect(type('Hello user', ' ', 'input.paste').doc).toBe('Hello user ');
  });

  it('skips a word already inside braces', () => {
    const state = EditorState.create({
      doc: '{{user}}',
      selection: { anchor: 6 },
      extensions: [characterMacroHelper()],
    });
    const tr = state.update({ changes: { from: 6, insert: ' ' }, userEvent: 'input.type' });
    expect(tr.state.doc.toString()).toBe('{{user }}');
  });
});
