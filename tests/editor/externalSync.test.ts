import { describe, it, expect } from 'vitest';
import { EditorState, type Transaction } from '@codemirror/state';
import { history, undo } from '@codemirror/commands';
import { externalSyncSpec } from '../../src/editor/externalSync';

function run(state: EditorState, command: typeof undo): EditorState {
  let next = state;
  command({ state, dispatch: (tr: Transaction) => { next = tr.state; } });
  return next;
}

describe('externalSyncSpec', () => {
  it('returns null when nothing changed', () => {
    expect(externalSyncSpec(EditorState.create({ doc: 'same' }), 'same')).toBeNull();
  });

  it('replaces only the differing span', () => {
    const state = EditorState.create({ doc: 'She is calm and quiet.' });
    const spec = externalSyncSpec(state, 'She is loud and quiet.')!;
    expect(spec.changes).toEqual({ from: 7, to: 11, insert: 'loud' });
    expect(state.update(spec).state.doc.toString()).toBe('She is loud and quiet.');
  });

  it('handles pure inserts and deletes', () => {
    const state = EditorState.create({ doc: 'abc' });
    expect(state.update(externalSyncSpec(state, 'abXc')!).state.doc.toString()).toBe('abXc');
    expect(state.update(externalSyncSpec(state, 'ac')!).state.doc.toString()).toBe('ac');
    expect(state.update(externalSyncSpec(state, '')!).state.doc.toString()).toBe('');
  });

  it('keeps outside changes out of undo while the user keeps their own steps', () => {
    let state = EditorState.create({ doc: 'Hello', extensions: [history()] });
    state = state.update({ changes: { from: 5, insert: ' there' }, userEvent: 'input.type' }).state;
    state = state.update(externalSyncSpec(state, 'Agent: Hello there')!).state;

    state = run(state, undo);
    expect(state.doc.toString()).toBe('Agent: Hello');
    expect(run(state, undo).doc.toString()).toBe('Agent: Hello');
  });

  it('cannot undo an outside change on its own', () => {
    let state = EditorState.create({ doc: 'Old text', extensions: [history()] });
    state = state.update(externalSyncSpec(state, 'New text')!).state;
    expect(run(state, undo).doc.toString()).toBe('New text');
  });
});
