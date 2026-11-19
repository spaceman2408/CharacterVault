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
export const STAGING_VERSION = 'v1.9.2 staging 11';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Phone (iPhone especially) → tap into the editor, the AI Custom box, the find bar or any other text field: the page should not zoom in when the keyboard opens. Pinch-zoom should still work on iPhone.',
  'Phone → open the find bar (magnifier) in a field: Find should be full width with × on the right, then ^ v, the match count and Aa / ab / .* on one row, then a full-width Replace box with Replace and Replace All under it.',
  'Phone → AI toolbar in a field: the AI buttons (Enhance, Custom…) and More should sit on the first row without being cut off, with the magnifier, { }, ;& and aA on a second row. Tapping Custom should still show the instruction box on its own line.',
  'Phone → tap into Description (or any text field) so the keyboard opens: the section bar and the field heading hide, and you should see several lines of text above the keyboard. Close the keyboard: everything comes back.',
  'Phone → same check in a greeting and in a lorebook entry (in a character and in a standalone lorebook): with the keyboard open, the token count and the Enabled/Constant toggles hide and the text area keeps several lines. Back, Duplicate, Delete and the keys box stay.',
  'Phone → with the keyboard open in a character or a lorebook, the top header (back arrow, name, settings, export) hides too and comes back when the keyboard closes. In a standalone lorebook, tap the lorebook name in the header to rename it: the header should stay while you type.',
  'Creator Notes → Preview: Match SillyTavern is on. Markdown (**bold**, lists) renders, {{char}} shows the card name, and styles on :root or body stop working with a note above the preview saying so. Remote images are hidden. Turn the switch off: the notes look as they did before.',
  'Creator Notes → Preview: try the width buttons (480px is about the SillyTavern side panel), the Dark / Light / checkerboard background, and Replay (animations start over). Turn on Remote media: remote images show. Reload the page: your choices stick, in the docked split too.',
  'Creator Notes → Dock: the editor and preview sit side by side. Drag the divider between them (it works while dragging over the preview), double-click it, or use the Reset dock size button next to Replay, to go back to half and half. Switch to another tab and back: still docked. Click Dock again to undock. Dock inside the Preview window does the same.',
  'Creator Notes → colors in <style> or style="" have a small swatch in front: click it and pick a color. The text updates in the same format (hex, rgb, hsl) and Ctrl+Z undoes the pick in one step. Format (toolbar) tidies minified CSS; Ctrl+Z undoes it. The line under the heading shows the size and any embedded data: images.',
  'Creator Notes → Insert: pick each snippet (Hero banner, Gradient title, Info block, Collapsible spoiler, Content warnings). Each lands at the cursor and shows up in Preview with the card name, and no warnings appear above the preview for it. Ctrl+Z removes it.',
  'Creator Notes → click a color swatch: the color picker opens right next to the swatch (it used to open in the top-left corner). Format keeps your cursor where it was. Phone → Insert: the menu fits on screen and closes when you scroll. On a computer, Dock, then narrow the window to phone width: Dock still shows so you can close the split.',
];
