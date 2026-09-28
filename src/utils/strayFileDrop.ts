/**
 * Cancels a file drag that no drop target handled, so the browser shows a no-drop
 * cursor instead of opening the file in place of the app.
 */
export function blockStrayFileDrop(event: DragEvent): void {
  if (event.defaultPrevented || !event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'none';
}
