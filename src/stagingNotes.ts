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
export const STAGING_VERSION = 'v1.6.1 staging 1';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Editor: current line highlights only when nothing is selected.',
  'Editor search (Ctrl+F) opens with the selection prefilled; Ctrl+H jumps to Replace.',
  'Editor font size (aA): slider works with arrow keys, plus Reset and Ctrl+= / Ctrl+- / Ctrl+0.',
  'Typing Char or USER plus punctuation now expands to {{char}} / {{user}}.',
  'Creator Notes split preview keeps undo history and focus.',
  'Empty editors show a placeholder hint; touch devices no longer pop the keyboard on section switch.',
];
