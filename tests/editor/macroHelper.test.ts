/**
 * @fileoverview Tests for the {{char}} / {{user}} typing helper.
 */

import { describe, it, expect } from 'vitest';
import { EditorState, type Transaction } from '@codemirror/state';
import {
  characterMacroHelper,
  resolveMacroReplacement,
  revertMacroConversion,
  setMacroAutoConvert,
} from '../../src/editor/extensions/characterMacroHelper';

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

describe('characterMacroHelper undo and off switch', () => {
  const typeInto = (doc: string, insert: string) => {
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.length },
      extensions: [characterMacroHelper()],
    });
    return state.update({
      changes: { from: doc.length, insert },
      selection: { anchor: doc.length + insert.length },
      userEvent: 'input.type',
    }).state;
  };

  const backspace = (state: EditorState) => {
    let next = state;
    const handled = revertMacroConversion({
      state,
      dispatch: (tr: Transaction) => {
        next = tr.state;
      },
    });
    return { handled, doc: next.doc.toString(), caret: next.selection.main.head, state: next };
  };

  it('Backspace right after a conversion restores the word as typed and keeps the typed character', () => {
    expect(backspace(typeInto('Hello User', ' '))).toMatchObject({
      handled: true,
      doc: 'Hello User ',
      caret: 11,
    });
    expect(backspace(typeInto('Ask char', '?')).doc).toBe('Ask char?');
  });

  it('only reverts once, and not after the caret moves or more is typed', () => {
    const reverted = backspace(typeInto('Hi user', ' '));
    expect(backspace(reverted.state).handled).toBe(false);

    const converted = typeInto('Hi user', ' ');
    const moved = converted.update({ selection: { anchor: 0 } }).state;
    expect(backspace(moved).handled).toBe(false);

    const typedMore = converted.update({
      changes: { from: converted.doc.length, insert: 'x' },
      selection: { anchor: converted.doc.length + 1 },
      userEvent: 'input.type',
    }).state;
    expect(backspace(typedMore).handled).toBe(false);
  });

  it('does not convert when turned off', () => {
    setMacroAutoConvert(false);
    try {
      expect(typeInto('Hello user', ' ').doc.toString()).toBe('Hello user ');
    } finally {
      setMacroAutoConvert(true);
    }
  });
});
