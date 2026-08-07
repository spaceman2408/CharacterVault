/**
 * @fileoverview CodeMirror extension: color {{char}} and {{user}} name macros.
 * @module editor/extensions/macroHighlight
 */

import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import type { Extension, Range } from '@codemirror/state';

export type NameMacroKind = 'char' | 'user';

export interface NameMacroRange {
  from: number;
  to: number;
  kind: NameMacroKind;
}

/** Case-insensitive {{char}} / {{user}} with optional inner whitespace (ST-style). */
const NAME_MACRO_RE_SOURCE = String.raw`\{\{\s*(char|user)\s*\}\}`;

const CHAR_CLASS = 'cm-macro-char';
const USER_CLASS = 'cm-macro-user';

/**
 * Find `{{char}}` / `{{user}}` placeholders (case-insensitive) in text.
 * Offsets are relative to the start of `text`.
 */
export function findNameMacroRanges(text: string): NameMacroRange[] {
  const ranges: NameMacroRange[] = [];
  // Fresh regex each call so lastIndex never leaks across invocations.
  const re = new RegExp(NAME_MACRO_RE_SOURCE, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const name = match[1].toLowerCase();
    if (name !== 'char' && name !== 'user') continue;
    ranges.push({
      from: match.index,
      to: match.index + match[0].length,
      kind: name,
    });
  }
  return ranges;
}

function buildMacroDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];

  for (const { from: rangeFrom, to: rangeTo } of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(rangeFrom);
    const endLine = view.state.doc.lineAt(rangeTo);

    for (let lineNo = startLine.number; lineNo <= endLine.number; lineNo += 1) {
      const line = view.state.doc.line(lineNo);
      for (const match of findNameMacroRanges(line.text)) {
        const from = line.from + match.from;
        const to = line.from + match.to;
        const className = match.kind === 'char' ? CHAR_CLASS : USER_CLASS;
        ranges.push(Decoration.mark({ class: className }).range(from, to));
      }
    }
  }

  return ranges.length === 0 ? Decoration.none : Decoration.set(ranges, true);
}

/** Module-level theme so remounts do not allocate new baseTheme facets. */
const macroHighlightTheme = EditorView.baseTheme({
  [`.${CHAR_CLASS}`]: {
    color: 'var(--macro-char, var(--syntax-keyword, #7c3aed))',
    fontWeight: '600',
  },
  [`.${USER_CLASS}`]: {
    color: 'var(--macro-user, var(--syntax-variable, #db2777))',
    fontWeight: '600',
  },
});

/**
 * Module-level plugin definition (one type for the app lifetime).
 * Instance state is only the current DecorationSet; no timers, listeners, or view refs.
 */
const macroHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildMacroDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.geometryChanged) {
        this.decorations = buildMacroDecorations(update.view);
      }
    }

    destroy() {
      this.decorations = Decoration.none;
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

/**
 * Highlights `{{char}}` and `{{user}}` (any letter case) with distinct colors.
 * Safe to call per editor mount; returns shared extension values.
 */
export function macroHighlight(): Extension {
  return [macroHighlightTheme, macroHighlightPlugin];
}
