/**
 * @fileoverview CodeMirror extension: color `"quoted dialogue"`, plain narration,
 * and `*asterisked actions*` in prose editors.
 * @module editor/extensions/roleplayHighlight
 */

import { Compartment } from '@codemirror/state';
import type { Extension, Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS } from '../../db/characterTypes';
import type { RoleplayHighlightSettings } from '../../db/characterTypes';
import { findNameMacroRanges } from './macroHighlight';

export type RoleplayKind = 'dialogue' | 'action' | 'narration';

export interface RoleplayRange {
  from: number;
  to: number;
  kind: RoleplayKind;
}

type Span = { from: number; to: number };

const DIALOGUE_CLASS = 'cm-rp-dialogue';
const ACTION_CLASS = 'cm-rp-action';
const NARRATION_CLASS = 'cm-rp-narration';

function subtractSpan(span: Span, cuts: Span[]): Span[] {
  let pieces: Span[] = [span];
  for (const cut of cuts) {
    const next: Span[] = [];
    for (const piece of pieces) {
      if (cut.to <= piece.from || cut.from >= piece.to) {
        next.push(piece);
        continue;
      }
      if (cut.from > piece.from) next.push({ from: piece.from, to: cut.from });
      if (cut.to < piece.to) next.push({ from: cut.to, to: piece.to });
    }
    pieces = next;
    if (pieces.length === 0) break;
  }
  return pieces;
}

/** Closed `"..."` / `"..."` pairs on one line. Unclosed quotes stay narration. */
function findQuotedSpans(text: string): Span[] {
  const spans: Span[] = [];
  const re = /"[^"\n]+"|“[^”\n]+”/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    spans.push({ from: match.index, to: match.index + match[0].length });
  }
  return spans;
}

/**
 * Single-asterisk `*actions*` on one line. `**bold**` is never an action:
 * candidates touching another `*` on either side are rejected.
 */
function findActionSpans(text: string): Span[] {
  const spans: Span[] = [];
  const re = /\*[^*\n]+\*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    if (from > 0 && text[from - 1] === '*') continue;
    if (to < text.length && text[to] === '*') continue;
    spans.push({ from, to });
  }
  return spans;
}

/**
 * Split one line of prose into dialogue / action / narration spans.
 * Offsets are relative to the start of `text`.
 * Dialogue wins over actions; `{{char}}` / `{{user}}` macros are carved out
 * for the macro highlighter so both colors coexist.
 */
export function findRoleplayRanges(text: string): RoleplayRange[] {
  if (!text) return [];
  const macroSpans: Span[] = findNameMacroRanges(text).map(({ from, to }) => ({ from, to }));
  const dialogueSpans = findQuotedSpans(text).flatMap((span) => subtractSpan(span, macroSpans));
  const actionSpans = findActionSpans(text)
    .flatMap((span) => subtractSpan(span, dialogueSpans))
    .flatMap((span) => subtractSpan(span, macroSpans));

  const covered: Span[] = [...dialogueSpans, ...actionSpans, ...macroSpans].sort(
    (a, b) => a.from - b.from,
  );
  const ranges: RoleplayRange[] = dialogueSpans.map((s) => ({ ...s, kind: 'dialogue' as const }));
  for (const s of actionSpans) ranges.push({ ...s, kind: 'action' as const });

  let cursor = 0;
  for (const span of covered) {
    if (span.from > cursor) {
      ranges.push({ from: cursor, to: span.from, kind: 'narration' });
    }
    cursor = Math.max(cursor, span.to);
  }
  if (cursor < text.length) {
    ranges.push({ from: cursor, to: text.length, kind: 'narration' });
  }

  return ranges.sort((a, b) => a.from - b.from);
}

function roleplayClass(kind: RoleplayKind): string {
  return kind === 'dialogue' ? DIALOGUE_CLASS : kind === 'action' ? ACTION_CLASS : NARRATION_CLASS;
}

function buildRoleplayDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];

  for (const { from: rangeFrom, to: rangeTo } of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(rangeFrom);
    const endLine = view.state.doc.lineAt(rangeTo);

    for (let lineNo = startLine.number; lineNo <= endLine.number; lineNo += 1) {
      const line = view.state.doc.line(lineNo);
      for (const match of findRoleplayRanges(line.text)) {
        ranges.push(
          Decoration.mark({ class: roleplayClass(match.kind) }).range(
            line.from + match.from,
            line.from + match.to,
          ),
        );
      }
    }
  }

  return ranges.length === 0 ? Decoration.none : Decoration.set(ranges, true);
}

const roleplayHighlightTheme = EditorView.baseTheme({
  [`.${DIALOGUE_CLASS}`]: {
    color: `var(--rp-dialogue, ${DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS.dialogue})`,
  },
  [`.${ACTION_CLASS}`]: {
    color: `var(--rp-action, ${DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS.action})`,
  },
  [`.${NARRATION_CLASS}`]: {
    color: 'var(--rp-narration, var(--editor-text))',
  },
});

const roleplayHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildRoleplayDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.geometryChanged) {
        this.decorations = buildRoleplayDecorations(update.view);
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

const roleplayHighlightCompartment = new Compartment();

export function roleplayHighlight(options: { enabled: boolean }): Extension {
  return [
    roleplayHighlightTheme,
    roleplayHighlightCompartment.of(options.enabled ? roleplayHighlightPlugin : []),
  ];
}

export function setRoleplayHighlightEnabled(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: roleplayHighlightCompartment.reconfigure(enabled ? roleplayHighlightPlugin : []),
  });
}

export function applyRoleplayHighlightColors(
  colors: Pick<RoleplayHighlightSettings, 'dialogue' | 'narration' | 'action'>,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--rp-dialogue', colors.dialogue);
  if (colors.narration) {
    root.style.setProperty('--rp-narration', colors.narration);
  } else {
    root.style.removeProperty('--rp-narration');
  }
  root.style.setProperty('--rp-action', colors.action);
}
