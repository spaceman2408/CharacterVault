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
export const STAGING_VERSION = 'v1.8.5 staging 4';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Agent → refresh or close the tab while a run is going, or while an agent review is waiting (even minimized): the browser asks before leaving. With the agent idle, it leaves without asking.',
  'Agent → leave anyway (refresh mid-run, refresh with a review waiting, or go back to the library with a review waiting), then reopen the chat: that run says "Interrupted… These edits were not saved." and its writes show struck through as Not saved. Ask "what did you change?" and the agent should know nothing landed. Finished, stopped, or applied runs show no notice.',
  'Settings → Character Workspace → Agent edits → "Remember earlier edits in the chat" (off by default). Turn it on, have the agent edit something, then ask it to change part of that edit ("reword the second sentence you just wrote"): it should know exactly what it wrote without searching for it. Replies should never end with an "[App note: …]" line. With it off, the agent works as before.',
  'Agent → ask it to remove em dashes from a card that also has hyphenated words (demi-human, t-shirt): only real em dashes change and hyphens stay. Ask again once none are left: it should say there are none, not turn hyphens into commas.',
  'Agent → ask it to rename the character or add a few NPCs without giving names ("add her two brothers, they grew up in 1920s Kraków"): it should pick real names that fit the setting instead of Elara/Voss-style names, and never reuse a name already on the card or in its lorebook. Japanese settings get romanized names (Sato, Yuko). Works in the standalone lorebook agent too.',
  'Agent → ask for names for an invented culture ("a desert clan", "a forest elf village"): it should come up with made-up names that share one sound across the group, not real-world names.',
];
