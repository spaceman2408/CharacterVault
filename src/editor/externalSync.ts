import { Transaction, type EditorState, type TransactionSpec } from '@codemirror/state';

/**
 * Applies text that changed outside this editor (agent, Orion, rollback) without
 * making it undoable here. Only the differing span is replaced, so the caret and
 * the user's own undo steps map cleanly around it.
 */
export function externalSyncSpec(state: EditorState, value: string): TransactionSpec | null {
  const current = state.doc.toString();
  if (current === value) return null;

  const maxPrefix = Math.min(current.length, value.length);
  let start = 0;
  while (start < maxPrefix && current.charCodeAt(start) === value.charCodeAt(start)) start++;

  let currentEnd = current.length;
  let valueEnd = value.length;
  while (
    currentEnd > start &&
    valueEnd > start &&
    current.charCodeAt(currentEnd - 1) === value.charCodeAt(valueEnd - 1)
  ) {
    currentEnd--;
    valueEnd--;
  }

  return {
    changes: { from: start, to: currentEnd, insert: value.slice(start, valueEnd) },
    annotations: Transaction.addToHistory.of(false),
  };
}
