/**
 * One active lorebook entry editor can register a persist flush so sibling
 * UI (e.g. Open in vault) can commit the CodeMirror draft before leaving.
 */

type FlushFn = () => void;

let draftFlush: FlushFn | null = null;

export function registerLorebookDraftFlush(fn: FlushFn): () => void {
  draftFlush = fn;
  return () => {
    if (draftFlush === fn) draftFlush = null;
  };
}

export function flushLorebookDraft(): void {
  draftFlush?.();
}
