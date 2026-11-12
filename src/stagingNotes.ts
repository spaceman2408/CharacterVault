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
export const STAGING_VERSION = 'v1.9.1 staging 1';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Settings → change a toggle, slider or dropdown: there is no Save button now. The footer should show "Saving…" then "Saved". Reload the page and reopen Settings: the change should still be there. Change something and close right away with Close or Escape: it should still be saved.',
  'Settings → Prompts → edit a prompt: nothing saves while you type (the footer says "Saves when you leave this field"), then it saves when you click out. Delete ${text} and click out: the footer should say "Not saved" and why, with no error popup.',
  'Settings → Prompts → on an edited prompt, click Reset to default and confirm, or click a variable chip to insert it: Ctrl+Z (⌘+Z) in that box should bring your text back.',
  'Settings → Backup → import a settings backup: it should ask "Restore settings from backup?" first. Cancel changes nothing; Restore replaces your settings right away.',
  'Settings → Prompts → with saved presets on AI Config, open a prompt\'s endpoint list (or the Agent\'s): your presets show under Saved, and picking one sets both the endpoint and the model. Picking plain OpenRouter should stay on OpenRouter even when its remembered model matches a preset.',
];
