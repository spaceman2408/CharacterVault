/**
 * @fileoverview Tests for the shared editor basics extension factory.
 */

import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { editorBasics, wrapSelectionSpec } from '../../src/editor/extensions/editorBasics';

function stateWith(doc: string, ...ranges: [number, number][]) {
  return EditorState.create({
    doc,
    selection: EditorSelection.create(ranges.map(([a, h]) => EditorSelection.range(a, h))),
    extensions: EditorState.allowMultipleSelections.of(true),
  });
}

function apply(state: EditorState, text: string) {
  const spec = wrapSelectionSpec(state, text);
  return spec ? state.update(spec).state : null;
}

describe('wrapSelectionSpec', () => {
  it('wraps the selection in asterisks and keeps the inner text selected', () => {
    const next = apply(stateWith('she smiles', [4, 10]), '*')!;
    expect(next.doc.toString()).toBe('she *smiles*');
    expect(next.sliceDoc(next.selection.main.from, next.selection.main.to)).toBe('smiles');
  });

  it('makes bold on a second asterisk', () => {
    const once = apply(stateWith('hi', [0, 2]), '*')!;
    expect(apply(once, '*')!.doc.toString()).toBe('**hi**');
  });

  it('wraps in quotes and keeps a backwards selection backwards', () => {
    const next = apply(stateWith('Hello there', [5, 0]), '"')!;
    expect(next.doc.toString()).toBe('"Hello" there');
    expect(next.selection.main.anchor).toBe(6);
    expect(next.selection.main.head).toBe(1);
  });

  it('wraps every selection range', () => {
    const next = apply(stateWith('a b', [0, 1], [2, 3]), '*')!;
    expect(next.doc.toString()).toBe('*a* *b*');
  });

  it('leaves plain typing alone', () => {
    expect(wrapSelectionSpec(stateWith('ab', [1, 1]), '*')).toBeNull();
    expect(wrapSelectionSpec(stateWith('ab', [0, 2]), 'x')).toBeNull();
    expect(wrapSelectionSpec(stateWith('abc', [0, 1], [3, 3]), '*')).toBeNull();
  });
});

describe('editorBasics', () => {
  it('returns base behaviors without a placeholder', () => {
    const extensions = editorBasics();
    expect(extensions.length).toBeGreaterThan(0);
  });

  it('adds one more extension when placeholder text is provided', () => {
    const without = editorBasics();
    const withPlaceholder = editorBasics({ placeholderText: 'Write...' });
    expect(withPlaceholder.length).toBe(without.length + 1);
  });
});
