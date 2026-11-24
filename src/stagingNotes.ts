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
export const STAGING_VERSION = 'v1.10.1 staging 3';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Settings → Skills → Import / Export all / Select to export: export one skill (open it → Export), several, or all to a .json file, then import it back. Import also takes Markdown skill files (SKILL.md with name and description frontmatter, or a # heading), and several files at once. A name that already exists asks Replace (updates it in place, keeps it on or off) or Keep both (adds a numbered copy).',
  'AI Creation Studio: new, shorter generation prompts. Create a few characters in different perspectives and check that the description has a Speech section, that the first message and examples never act or speak for {{user}}, and that examples say {{char}} instead of the name. Studio prompts you edited in Settings are kept; untouched ones update on their own.',
  'AI Creation Studio → Tags: the concept now groups tags by category (Identity: …; Tone: …; Dynamic: …). Pick some tags, then switch to Write to see it.',
  'AI Creation Studio: once a field is done, the note button next to Regenerate takes a short change like "make them older" and regenerates just that field with it.',
  'AI Creation Studio: edit or regenerate the Description, and First Message and Examples show "Description changed" until you regenerate them.',
];
