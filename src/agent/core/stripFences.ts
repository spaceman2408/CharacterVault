import { parseActions } from './parseActions';

export function stripFences(text: string): string {
  const { speech } = parseActions(text);
  return speech.replace(/\n{3,}/g, '\n\n').trim();
}
