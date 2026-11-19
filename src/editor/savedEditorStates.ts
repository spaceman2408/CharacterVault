import { EditorState, type Extension, type StateEffect } from '@codemirror/state';
import { historyField } from '@codemirror/commands';

interface SavedEditorState {
  json: { doc: string };
  scroll?: StateEffect<unknown>;
}

// About one card's worth of sections; older entries fall off first.
const MAX_SAVED_STATES = 15;
const SERIALIZED_FIELDS = { history: historyField };
const savedStates = new Map<string, SavedEditorState>();

export function saveEditorState(key: string, state: EditorState, scroll?: StateEffect<unknown>): void {
  savedStates.delete(key);
  savedStates.set(key, { json: state.toJSON(SERIALIZED_FIELDS) as SavedEditorState['json'], scroll });
  if (savedStates.size > MAX_SAVED_STATES) {
    const oldest = savedStates.keys().next().value;
    if (oldest !== undefined) savedStates.delete(oldest);
  }
}

/**
 * Brings back cursor, scroll and undo history only when the text is unchanged;
 * history from a different document would undo into text that is no longer there.
 */
export function createEditorState(
  key: string | undefined,
  doc: string,
  extensions: Extension[],
): { state: EditorState; scrollTo?: StateEffect<unknown> } {
  const saved = key ? savedStates.get(key) : undefined;
  if (saved && saved.json.doc === doc) {
    return {
      state: EditorState.fromJSON(saved.json, { extensions }, SERIALIZED_FIELDS),
      scrollTo: saved.scroll,
    };
  }
  return { state: EditorState.create({ doc, extensions }) };
}
