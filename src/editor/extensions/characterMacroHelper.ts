/**
 * @fileoverview Lightweight macro typing helper for Character Vault placeholders.
 * @module editor/extensions/characterMacroHelper
 */

import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

const MACROS: Record<string, string> = {
  user: '{{user}}',
  char: '{{char}}',
};

const WORD_CHAR = /[A-Za-z0-9_]/;
const COMPLETION_CHAR = /[\s.,!?;:)\]}>"'`]/;
const DOCUMENT_END_DELAY_MS = 300;

function isWordChar(char: string): boolean {
  return WORD_CHAR.test(char);
}

function isCompletionChar(char: string): boolean {
  return COMPLETION_CHAR.test(char);
}

function isTypedInput(update: ViewUpdate): boolean {
  return update.transactions.some((transaction) => transaction.isUserEvent('input'));
}

function findCandidate(view: EditorView): { from: number; to: number; replacement: string } | null {
  const selection = view.state.selection.main;
  if (!selection.empty) return null;

  const cursor = selection.from;
  const doc = view.state.doc;
  const docLength = doc.length;
  const previous = cursor > 0 ? doc.sliceString(cursor - 1, cursor) : '';

  let wordEnd = cursor;
  if (previous && isCompletionChar(previous)) {
    wordEnd = cursor - 1;
  } else if (cursor !== docLength || !previous || !isWordChar(previous)) {
    return null;
  }

  let wordStart = wordEnd;
  while (wordStart > 0) {
    const char = doc.sliceString(wordStart - 1, wordStart);
    if (!isWordChar(char)) break;
    wordStart -= 1;
  }

  const word = doc.sliceString(wordStart, wordEnd);
  const replacement = MACROS[word];
  if (!replacement) return null;

  const before = wordStart > 0 ? doc.sliceString(wordStart - 1, wordStart) : '';
  const after = wordEnd < docLength ? doc.sliceString(wordEnd, wordEnd + 1) : '';
  if ((before && isWordChar(before)) || (after && isWordChar(after))) return null;

  const wrappedBefore = wordStart >= 2 ? doc.sliceString(wordStart - 2, wordStart) : '';
  const wrappedAfter = wordEnd + 2 <= docLength ? doc.sliceString(wordEnd, wordEnd + 2) : '';
  if (wrappedBefore === '{{' && wrappedAfter === '}}') return null;

  return { from: wordStart, to: wordEnd, replacement };
}

function findCandidateBeforeInput(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): { from: number; to: number; insert: string } | null {
  if (from !== to || text.length !== 1 || !isCompletionChar(text)) return null;

  const doc = view.state.doc;
  let wordStart = from;
  while (wordStart > 0) {
    const char = doc.sliceString(wordStart - 1, wordStart);
    if (!isWordChar(char)) break;
    wordStart -= 1;
  }

  const word = doc.sliceString(wordStart, from);
  const replacement = MACROS[word];
  if (!replacement) return null;

  const before = wordStart > 0 ? doc.sliceString(wordStart - 1, wordStart) : '';
  if (before && isWordChar(before)) return null;

  const wrappedBefore = wordStart >= 2 ? doc.sliceString(wordStart - 2, wordStart) : '';
  const wrappedAfter = from + 2 <= doc.length ? doc.sliceString(from, from + 2) : '';
  if (wrappedBefore === '{{' && wrappedAfter === '}}') return null;

  return { from: wordStart, to: from, insert: `${replacement}${text}` };
}

function applyMacro(view: EditorView): void {
  const candidate = findCandidate(view);
  if (!candidate) return;

  view.dispatch({
    changes: {
      from: candidate.from,
      to: candidate.to,
      insert: candidate.replacement,
    },
    selection: { anchor: candidate.from + candidate.replacement.length },
    userEvent: 'input.type.characterMacro',
  });
}

/**
 * Converts completed lowercase `user` and `char` words into Character Vault macros.
 */
export function characterMacroHelper(): Extension {
  return [
    EditorView.inputHandler.of((view, from, to, text) => {
      const candidate = findCandidateBeforeInput(view, from, to, text);
      if (!candidate) return false;

      view.dispatch({
        changes: {
          from: candidate.from,
          to: candidate.to,
          insert: candidate.insert,
        },
        selection: { anchor: candidate.from + candidate.insert.length },
        userEvent: 'input.type.characterMacro',
      });
      return true;
    }),
    ViewPlugin.fromClass(class {
      private timeoutId: number | null = null;

      update(update: ViewUpdate): void {
        if (update.docChanged && this.timeoutId !== null) {
          window.clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }

        if (!update.docChanged || !isTypedInput(update)) return;

        const cursor = update.state.selection.main.from;
        const previous = cursor > 0 ? update.state.doc.sliceString(cursor - 1, cursor) : '';
        if (previous && isCompletionChar(previous)) {
          applyMacro(update.view);
          return;
        }

        if (cursor === update.state.doc.length && previous && isWordChar(previous)) {
          this.timeoutId = window.setTimeout(() => {
            this.timeoutId = null;
            applyMacro(update.view);
          }, DOCUMENT_END_DELAY_MS);
        }
      }

      destroy(): void {
        if (this.timeoutId !== null) {
          window.clearTimeout(this.timeoutId);
        }
      }
    }),
  ];
}
