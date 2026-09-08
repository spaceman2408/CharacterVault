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
export const STAGING_VERSION = 'v1.6.0 staging 2';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Vault backup and restore from the library header.',
  'Settings backup with optional API keys.',
  'Card details sheet: Active versus Total token counts.',
  'Editor header save status: Saving / Saved / Save failed.',
  'Section headers show live chars, words and token estimates.',
  'Extensions JSON is editable with an invalid-JSON warning.',
  'Cmd+S flushes pending editor saves.',
  'Greetings: duplicate with confirm, plus move up/down.',
  'Lorebook entries: duplicate with confirm creates the next available entry ID.',
  'Deletes and replaces use styled confirms, failures use toasts (no browser popups).',
];
