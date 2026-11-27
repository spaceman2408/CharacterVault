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
export const STAGING_VERSION = 'v1.10.1 staging 6';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Settings → Skills → Import / Export all / Select to export: export one skill (open it → Export), several, or all to a .json file, then import it back. Import also takes Markdown skill files (SKILL.md with name and description frontmatter, or a # heading), and several files at once. A name that already exists asks Replace (updates it in place, keeps it on or off) or Keep both (adds a numbered copy).',
  'AI Creation Studio: new, shorter generation prompts. Create a few characters in different perspectives and check that the description has a Speech section, that the first message and examples never act or speak for {{user}}, and that examples say {{char}} instead of the name. Studio prompts you edited in Settings are kept; untouched ones update on their own.',
  'AI Creation Studio → Tags: the concept now groups tags by category (Identity: …; Tone: …; Dynamic: …). Pick some tags, then switch to Write to see it.',
  'AI Creation Studio: once a field is done, the note button next to Regenerate takes a short change like "make them older" and regenerates just that field with it.',
  'AI Creation Studio: edit or regenerate the Description, and First Message and Examples show "Description changed" until you regenerate them.',
  'AI Creation Studio → Generation Style: pick a perspective or tense, then click the star inside its chip to make it your default. It is already selected when you open the Studio and after Create Another. One default per row; starring another replaces it.',
  'AI Creation Studio → Tags: every tag chip works the same way. Click the name to select it, click the star inside the chip to favorite it. Selected only removes (×), Favorites unfavorite with the star, and Generation Style is a collapsible section above Identity.',
  'AI Creation Studio → Tags → add your own tag: delete it with the trash icon inside its chip. It takes two clicks (the icon turns into a red check first), and deleting also removes it from Favorites.',
  'AI Creation Studio: with no AI provider set up, an "AI not configured" button shows in the header instead of the big warning box ("Set up AI" on phones).',
  'Settings → AI Config on OpenRouter: Minimum quantization under Provider skips hosts below the chosen precision (4-bit, 8-bit, 16-bit, …), and Hide unknown also skips hosts that do not report one. Open the Provider list to see skipped hosts greyed out, then send a message and check that the reply info shows an allowed host.',
  'Agent (card and lorebook): ask for a new town, region, river, mountain, lake, or inn, or to rename a placeholder like Oakhaven. It should call suggest_places ("Suggested N places") and pick from the list instead of making one up: invented names for fantasy worlds, real towns for real-world settings, and bare names for rivers, mountains, and lakes.',
  'Agent: tool descriptions are shorter, so every request sends less context. Run your usual agent tasks (field and greeting edits, lorebook entries, book settings) and report any tool call that fails or picks the wrong option.',
];
