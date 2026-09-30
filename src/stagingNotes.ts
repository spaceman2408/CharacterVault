/**
 * Staging tester notes.
 *
 * This file drives the popup shown on staging.charactervault.app.
 * To post new notes: update STAGING_VERSION and STAGING_TEST_NOTES,
 * then push to staging. Each tester sees the popup once per version
 * and can reopen it with the floating flask button.
 *
 * Production builds never render these notes.
 */

/** Host that renders the tester notes popup. */
export const STAGING_HOST = 'staging.charactervault.app';

const PREVIEW_PARAM = 'stagingNotes';

export function isStagingHost(hostname: string, search = '', hash = ''): boolean {
  if (hostname === STAGING_HOST) return true;
  return search.includes(PREVIEW_PARAM) || hash.includes(PREVIEW_PARAM);
}

export function shouldShowStagingNotes(seenVersion: string | null, version: string): boolean {
  return seenVersion !== version;
}

/** Bump this every time you post new notes so testers see the popup again. */
export const STAGING_VERSION = 'v1.8.2 staging 3';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Spellcheck: bigger dictionary, so fewer real words get flagged, and numbers like 6\'2 or 1-2 are no longer flagged. Long fields should still type smoothly.',
  'Editor highlighting: *actions* after **bold** on the same line now highlight, and a height like 6\'2" no longer turns the rest of the line into dialogue.',
  'Editor: typing char or user becomes {{char}} / {{user}} when you finish the word. Enter or paste right after should work normally.',
  'Editor: press Backspace right after char / user converts to keep the plain word. Turn conversion off in Settings → Character Workspace → Name macros.',
  'Font size (aA): dragging the slider resizes the text live, and the standalone lorebook now remembers its size. Ctrl+= / Ctrl+- also work with the slider focused.',
  'Image links: Ctrl+click (⌘+click on Mac) or tap ![](https://…) to open it; a plain click just places the cursor. The warning focuses Cancel, and URLs with (parentheses) stay whole.',
  'Search (Ctrl+F, Ctrl+H to replace): the count matches the highlights, F3 or Ctrl+G steps through matches, Enter in Replace replaces, and the query stays after Replace All.',
  'Inline AI toolbar: Retry on the result and on errors. Reject reopens Custom with your instruction so you can tweak it.',
  'Inline AI toolbar: the result header shows the model, time to first token, and speed, and warns if the reply was cut off at Max Tokens.',
  'Inline AI toolbar → Custom: the button reads Rewrite with a selection and Insert without one. Esc and Cancel keep what you typed.',
  'Inline AI toolbar → Custom: ↑ in an empty box recalls recent instructions. The clock button lists them, with ✕ to remove one and Clear all (click twice).',
  'Inline AI toolbar: an empty AI reply shows an error instead of locking the editor. Esc in a dialog or the font-size popup no longer rejects the result.',
  'Japanese / Chinese / Korean input: Enter and Esc while composing no longer send or close things.',
  'Snapshots: pinning a lorebook entry for AI context no longer shows as a change.',
];
