/**
 * Replaces `start..end` of a textarea through the browser's edit stack so Ctrl+Z can undo it.
 * The native input event reaches React's onChange like typing does. Returns false if the
 * browser refused, so the caller can fall back to setting the value directly.
 */
export function insertTextUndoable(
  el: HTMLTextAreaElement,
  text: string,
  start = 0,
  end = el.value.length
): boolean {
  if (typeof document.execCommand !== 'function') return false;
  el.focus();
  el.setSelectionRange(start, end);
  return document.execCommand('insertText', false, text);
}
