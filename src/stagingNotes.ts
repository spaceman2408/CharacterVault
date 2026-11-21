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
export const STAGING_VERSION = 'v1.9.3 staging 3';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Character header → Find (search icon): type a word that appears in several places (description, greetings, lorebook entries). Results are grouped by place; try Aa, ab, .* and, with text in Replace, AB. The preview shows old struck through and new next to it. Untick a match or a whole group. Click a match to open that section.',
  'Find → Replace 12 (or Remove 12 when Replace is empty; hover it to see what goes): the ticked matches change in one step and a toast offers Undo. Undo puts the card back unless you edited it since. Snapshots shows a Find & Replace save point from just before.',
];
