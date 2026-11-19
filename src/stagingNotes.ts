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
export const STAGING_VERSION = 'v1.9.2 staging 5';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Phone (iPhone especially) → tap into the editor, the AI Custom box, the find bar or any other text field: the page should not zoom in when the keyboard opens. Pinch-zoom should still work on iPhone.',
  'Phone → open the find bar (magnifier) in a field: Find should be full width with × on the right, then ^ v, the match count and Aa / ab / .* on one row, then a full-width Replace box with Replace and Replace All under it.',
  'Phone → AI toolbar in a field: the AI buttons (Enhance, Custom…) and More should sit on the first row without being cut off, with the magnifier, { }, ;& and aA on a second row. Tapping Custom should still show the instruction box on its own line.',
  'Phone → tap into Description (or any text field) so the keyboard opens: the section bar and the field heading hide, and you should see several lines of text above the keyboard. Close the keyboard: everything comes back.',
  'Phone → same check in a greeting and in a lorebook entry (in a character and in a standalone lorebook): with the keyboard open, the token count and the Enabled/Constant toggles hide and the text area keeps several lines. Back, Duplicate, Delete and the keys box stay.',
  'Phone → with the keyboard open in a character or a lorebook, the top header (back arrow, name, settings, export) hides too and comes back when the keyboard closes. In a standalone lorebook, tap the lorebook name in the header to rename it: the header should stay while you type.',
  'Creator Notes → Preview CSS: Match SillyTavern is on. Markdown (**bold**, lists) renders, {{char}} shows the card name, and styles on :root or body stop working with a note above the preview saying so. Remote images are hidden. Turn the switch off: the notes look as they did before.',
];
