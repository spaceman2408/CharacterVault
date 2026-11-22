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
export const STAGING_VERSION = 'v1.9.3 staging 6';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Character header → Find (search icon): type a word that appears in several places (description, greetings, lorebook entries). Results are grouped by place; try Aa, ab, .* and, with text in Replace, AB. The preview shows old struck through and new next to it. Untick a match or a whole group. Click a match to open that section.',
  'Find → Replace 12 (or Remove 12 when Replace is empty; hover it to see what goes): the ticked matches change in one step and a toast offers Undo. Undo puts the card back unless you edited it since. Snapshots shows a Find & Replace save point from just before.',
  'Ctrl+Shift+F (Cmd+Shift+F on Mac) opens Find & Replace from anywhere in a character. Select a word in a section first and it lands in Find, ready to type over. Ctrl+F still opens the small find bar in the editor.',
  'Find & Replace fixes: typing stays quick with thousands of results; it no longer jumps the cursor back to Find when the card saves; Ctrl+Shift+F does nothing while Snapshots, Settings or another window is open; leaving the character closes the Undo toast; replacing text with the same text says Nothing would change.',
  'Endpoints with no API key: in Settings → AI Config, use a custom URL on any hostname (not just localhost), leave the key empty and pick a model. AI Creation Studio lets you Generate, and Settings → Prompts → Model for this prompt can Fetch models with no key warning. If the endpoint does need a key, you get its own error.',
];
