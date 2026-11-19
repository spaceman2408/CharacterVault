/**
 * @fileoverview Shared CodeMirror editing defaults for CharacterVault prose editors.
 * Small readability and mouse behaviors with no new dependencies:
 * caret-line highlight, bracket matching, multi-cursor / rectangular
 * selection, drop cursor, wrap-selection on * or ", and optional placeholder.
 * @module editor/extensions/editorBasics
 */

import { EditorSelection, EditorState, type Extension, type TransactionSpec } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  crosshairCursor,
  drawSelection,
  dropCursor,
  placeholder,
  rectangularSelection,
} from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { bracketMatching } from '@codemirror/language';

export interface EditorBasicsOptions {
  placeholderText?: string;
}

function buildCaretLineDeco(view: EditorView): DecorationSet {
  const ranges = [];
  let lastLineStart = -1;
  for (const r of view.state.selection.ranges) {
    if (!r.empty) continue;
    const line = view.lineBlockAt(r.head);
    if (line.from > lastLineStart) {
      ranges.push(Decoration.line({ class: 'cm-activeLine' }).range(line.from));
      lastLineStart = line.from;
    }
  }
  return Decoration.set(ranges);
}

const caretLineHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildCaretLineDeco(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = buildCaretLineDeco(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

/**
 * Marks caret lines with `cm-activeLine`, but only for empty selections.
 * Stock `highlightActiveLine` also decorates the head line of a range
 * selection, where it fights the selection background for the same line.
 */
export function highlightCaretLine(): Extension {
  return caretLineHighlighter;
}

const WRAP_CHARS = new Set(['*', '"']);

/**
 * Typing * or " over a selection wraps it instead of replacing it. The
 * selection stays on the inner text, so a second * makes **bold**.
 */
export function wrapSelectionSpec(state: EditorState, text: string): TransactionSpec | null {
  if (!WRAP_CHARS.has(text) || state.readOnly) return null;
  if (state.selection.ranges.some((range) => range.empty)) return null;
  return {
    ...state.changeByRange((range) => ({
      changes: [
        { from: range.from, insert: text },
        { from: range.to, insert: text },
      ],
      range: EditorSelection.range(range.anchor + 1, range.head + 1),
    })),
    scrollIntoView: true,
    userEvent: 'input.type',
  };
}

const wrapSelectionOnType = EditorView.inputHandler.of((view, _from, _to, text) => {
  const spec = wrapSelectionSpec(view.state, text);
  if (!spec) return false;
  view.dispatch(spec);
  return true;
});

/**
 * Base editing behaviors shared by every AI editor instance.
 * Theme colors come from CSS variables (themeSync); this only enables the behaviors.
 */
export function editorBasics(options: EditorBasicsOptions = {}): Extension[] {
  const extensions: Extension[] = [
    highlightCaretLine(),
    bracketMatching(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    EditorState.allowMultipleSelections.of(true),
    wrapSelectionOnType,
  ];

  if (options.placeholderText) {
    extensions.push(placeholder(options.placeholderText));
  }

  return extensions;
}

export default editorBasics;
