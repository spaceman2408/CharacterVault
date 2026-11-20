import { describe, it, expect } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import { history, undo } from '@codemirror/commands';
import { createEditorState, saveEditorState } from '../../src/editor/savedEditorStates';

function undoState(state: ReturnType<typeof createEditorState>['state']) {
  let next = state;
  undo({ state, dispatch: (tr) => { next = tr.state; } });
  return next;
}

describe('savedEditorStates', () => {
  it('restores cursor and undo history when the text is unchanged', () => {
    const { state } = createEditorState('c1:description', 'Hello', [history()]);
    const edited = state.update({
      changes: { from: 5, insert: ' world' },
      selection: EditorSelection.cursor(3),
    }).state;
    saveEditorState('c1:description', edited);

    const { state: restored } = createEditorState('c1:description', 'Hello world', [history()]);
    expect(restored.selection.main.head).toBe(3);
    expect(undoState(restored).doc.toString()).toBe('Hello');
  });

  it('starts fresh when the text changed elsewhere', () => {
    const { state } = createEditorState('c1:scenario', 'A', [history()]);
    saveEditorState('c1:scenario', state.update({ changes: { from: 1, insert: 'B' } }).state);

    const { state: restored, scrollTo } = createEditorState('c1:scenario', 'Other', [history()]);
    expect(restored.doc.toString()).toBe('Other');
    expect(restored.selection.main.head).toBe(0);
    expect(scrollTo).toBeUndefined();
    expect(undoState(restored).doc.toString()).toBe('Other');
  });

  it('keeps entries separate per key', () => {
    const { state } = createEditorState('c1:personality', 'Same', [history()]);
    saveEditorState('c1:personality', state.update({ selection: EditorSelection.cursor(2) }).state);

    const { state: other } = createEditorState('c2:personality', 'Same', [history()]);
    expect(other.selection.main.head).toBe(0);
  });
});
