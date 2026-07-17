/**
 * HTML/CSS language mode for creator notes.
 * Syntax colors come from the shared theme token system (themeSync).
 */

import type { Extension } from '@codemirror/state';
import { html } from '@codemirror/lang-html';

const htmlLanguage = html();

export function creatorNotesExtensions(): Extension[] {
  return [htmlLanguage];
}

export default creatorNotesExtensions;
