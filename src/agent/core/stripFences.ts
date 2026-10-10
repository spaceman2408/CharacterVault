import { parseActions } from './parseActions';

const APP_NOTE_BLOCK = /^\[App note:[\s\S]*?\][ \t]*$/gm;

/** Models sometimes copy the app's history notes into a reply; those are never the model's speech. */
export function stripAppNotes(text: string): string {
  return text.replace(APP_NOTE_BLOCK, '');
}

export function stripFences(text: string): string {
  const { speech } = parseActions(text);
  return stripAppNotes(speech).replace(/\n{3,}/g, '\n\n').trim();
}
