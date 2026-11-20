/**
 * HTML/CSS language mode for creator notes.
 * Syntax colors come from the shared theme token system (themeSync).
 */

import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { html } from '@codemirror/lang-html';
import { creatorNotesCssFormatChanges } from '../../utils/creatorNotesCssFormat';
import { colorSwatches } from './colorSwatches';

const htmlLanguage = html();

export function creatorNotesExtensions(): Extension[] {
  return [htmlLanguage, colorSwatches()];
}

/** Formats the CSS in every `<style>` block as one undoable change; the cursor keeps its place. */
export function formatCreatorNotesCssInView(view: EditorView): boolean {
  const changes = creatorNotesCssFormatChanges(view.state.doc.toString());
  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: 'input.format' });
  return true;
}

export default creatorNotesExtensions;
