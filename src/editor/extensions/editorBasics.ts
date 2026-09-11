/**
 * @fileoverview Shared CodeMirror editing defaults for CharacterVault prose editors.
 * Small readability and mouse behaviors with no new dependencies:
 * caret-line highlight, bracket matching, multi-cursor / rectangular
 * selection, drop cursor, and optional placeholder.
 * @module editor/extensions/editorBasics
 */

import { EditorState, type Extension } from '@codemirror/state';
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
  ];

  if (options.placeholderText) {
    extensions.push(placeholder(options.placeholderText));
  }

  return extensions;
}

export default editorBasics;
