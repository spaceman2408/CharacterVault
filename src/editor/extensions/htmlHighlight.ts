/**
 * HTML/CSS language mode for creator notes.
 * Syntax colors come from the shared theme token system (themeSync).
 */

import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { html } from '@codemirror/lang-html';
import { formatCreatorNotesCss } from '../../utils/creatorNotesCssFormat';
import { colorSwatches } from './colorSwatches';

const htmlLanguage = html();

export function creatorNotesExtensions(): Extension[] {
  return [htmlLanguage, colorSwatches()];
}

/** Formats the CSS in every `<style>` block as one undoable change. */
export function formatCreatorNotesCssInView(view: EditorView): boolean {
  const current = view.state.doc.toString();
  const formatted = formatCreatorNotesCss(current);
  if (formatted === current) return false;
  const head = view.state.selection.main.head;
  view.dispatch({
    changes: { from: 0, to: current.length, insert: formatted },
    selection: { anchor: Math.min(head, formatted.length) },
    userEvent: 'input.format',
  });
  return true;
}

export default creatorNotesExtensions;
