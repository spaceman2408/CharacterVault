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
export const STAGING_VERSION = 'v1.8.1 staging 3';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Snapshots: the diff now uses cards like the agent review, with Restore on each card. A snapshot marked as changed should never show an empty diff.',
  'Snapshots: lorebook entry settings (enabled, position, order, keys) and entry order changes now show in the diff.',
  'Chat header: the Orion / Agent icons at the left switch modes. The highlighted one is active.',
  'Orion: hover your last message and click the pencil to edit and resend it. × cancels and keeps the chat as it was.',
  'Workspace header: card tokens (active / total) next to the save status, on wider screens.',
  'Greetings: rows show tokens, Tab + Enter pick one, and the open greeting stays open across sections.',
  'Agent: after it edits a greeting, click that line in the chat to open the greeting.',
  'Image tab: drop or paste an image to set it. Replacing an existing image asks first.',
  'Lorebook: every entry row shows its content token count.',
  'Orion: if a reply fails, click Retry on the banner or press Enter in the empty box. Esc stops a reply.',
  'Inline AI toolbar: after Reject, Stop, or closing an error, your text is selected again.',
  'Settings → Prompts / Studio: changed prompts show "edited" and Reset to default. Resets ask first.',
];
