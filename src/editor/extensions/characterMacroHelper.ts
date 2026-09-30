/**
 * @fileoverview Lightweight macro typing helper for Character Vault placeholders.
 * @module editor/extensions/characterMacroHelper
 */

import { EditorView, keymap } from '@codemirror/view';
import {
  Annotation,
  EditorState,
  Prec,
  StateField,
  Transaction,
  type Extension,
  type StateCommand,
  type Text,
} from '@codemirror/state';

const MACROS: Record<string, string> = {
  user: '{{user}}',
  char: '{{char}}',
};

/**
 * Resolve a typed word to its `{{macro}}` replacement, case-insensitively.
 * Returns null for anything that is not a bare `char` / `user` word.
 */
export function resolveMacroReplacement(word: string): string | null {
  if (!word) return null;
  return MACROS[word.toLowerCase()] ?? null;
}

let autoConvert = true;

/** The user's preference, shared by every editor. */
export function setMacroAutoConvert(enabled: boolean): void {
  autoConvert = enabled;
}

const WORD_CHAR = /[A-Za-z0-9_]/;
const COMPLETION_CHAR = /[\s.,!?;:)\]}>"'`]/;

function isWordChar(char: string): boolean {
  return WORD_CHAR.test(char);
}

/** Typed characters, Enter and Tab; not paste, drop, search replace or this helper's own edits. */
function isTyping(tr: Transaction): boolean {
  const event = tr.annotation(Transaction.userEvent);
  return event === 'input.type' || event === 'input';
}

/** The whole `user` / `char` word ending at `end`, unless it already sits inside `{{ }}`. */
function macroWordBefore(doc: Text, end: number): { from: number; to: number; insert: string } | null {
  let from = end;
  while (from > 0 && isWordChar(doc.sliceString(from - 1, from))) from -= 1;
  const insert = resolveMacroReplacement(doc.sliceString(from, end));
  if (!insert) return null;

  const wrappedBefore = from >= 2 ? doc.sliceString(from - 2, from) : '';
  const wrappedAfter = doc.sliceString(end, Math.min(doc.length, end + 2));
  if (wrappedBefore === '{{' && wrappedAfter === '}}') return null;

  return { from, to: end, insert };
}

interface MacroConversion {
  from: number;
  word: string;
  insert: string;
}

const macroConverted = Annotation.define<MacroConversion>();

function conversionSpec(doc: Text, macro: { from: number; to: number; insert: string }) {
  return {
    changes: macro,
    annotations: macroConverted.of({
      from: macro.from,
      word: doc.sliceString(macro.from, macro.to),
      insert: macro.insert,
    }),
  };
}

/** The conversion just made, while the caret hasn't moved and nothing else was edited. */
const lastConversion = StateField.define<(MacroConversion & { head: number }) | null>({
  create: () => null,
  update(value, tr) {
    const converted = tr.annotation(macroConverted);
    if (converted) return { ...converted, head: tr.newSelection.main.head };
    return tr.docChanged || tr.selection ? null : value;
  },
});

/** Backspace right after a conversion turns `{{user}}` back into the word as typed. */
export const revertMacroConversion: StateCommand = ({ state, dispatch }) => {
  const conversion = state.field(lastConversion, false);
  const { ranges, main } = state.selection;
  if (!conversion || ranges.length > 1 || !main.empty || main.head !== conversion.head) return false;
  const to = conversion.from + conversion.insert.length;
  if (state.doc.sliceString(conversion.from, to) !== conversion.insert) return false;
  dispatch(
    state.update({
      changes: { from: conversion.from, to, insert: conversion.word },
      userEvent: 'delete.backward',
      scrollIntoView: true,
    }),
  );
  return true;
};

/**
 * Typing a space, punctuation, Enter or Tab right after the word converts it in
 * the same transaction, so the keystroke and the macro are one undo step.
 */
const convertOnCompletion = EditorState.transactionFilter.of((tr) => {
  if (!autoConvert || !tr.docChanged || !isTyping(tr)) return tr;

  const insertions: Array<{ at: number; first: string }> = [];
  let replacesText = false;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (fromA !== toA) replacesText = true;
    insertions.push({ at: fromA, first: inserted.sliceString(0, 1) });
  });
  if (replacesText || insertions.length !== 1) return tr;

  const [{ at, first }] = insertions;
  if (!COMPLETION_CHAR.test(first)) return tr;

  const macro = macroWordBefore(tr.startState.doc, at);
  if (!macro) return tr;
  return [tr, conversionSpec(tr.startState.doc, macro)];
});

/** True while the last edit was typing, so blur only completes a word the user just typed. */
const lastEditWasTyping = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => (tr.docChanged ? isTyping(tr) : tr.selection ? false : value),
});

/**
 * Converts completed `user` and `char` words into Character Vault macros. A
 * word typed last, with nothing after it, is converted when the editor loses focus.
 */
export function characterMacroHelper(): Extension {
  return [
    convertOnCompletion,
    lastEditWasTyping,
    lastConversion,
    Prec.high(keymap.of([{ key: 'Backspace', run: revertMacroConversion }])),
    EditorView.domEventHandlers({
      blur(_event, view) {
        const { state } = view;
        const caret = state.selection.main;
        if (!autoConvert || state.readOnly || !caret.empty || !state.field(lastEditWasTyping)) return false;
        const next = state.doc.sliceString(caret.head, caret.head + 1);
        if (next && isWordChar(next)) return false;

        const macro = macroWordBefore(state.doc, caret.head);
        if (!macro) return false;
        view.dispatch({ ...conversionSpec(state.doc, macro), userEvent: 'input.type.characterMacro' });
        return false;
      },
    }),
  ];
}
