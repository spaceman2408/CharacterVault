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
export const STAGING_VERSION = 'v1.8.4 staging 3';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'OpenRouter → Provider: pick a host for a model. Hosts show variant tags like fp8, and the info on a reply shows the host that actually answered. Only use this host fails the request instead of falling back.',
  'OpenRouter with an API key: the model list only shows models that key can use, so guardrails and ignored providers on openrouter.ai should hide models.',
  'Settings → AI Config → OpenRouter Options → Host priority: Balanced, Cheapest, Fastest, or Quickest start. A pinned host still wins.',
  'OpenRouter Options → No training on prompts / Zero data retention only: with ZDR on, model lists hide models with no ZDR host, and a request that no host can serve says which option blocked it.',
  'OpenRouter Options → Free models only: model lists show only $0 models. Try it together with ZDR.',
  'OpenRouter Options → Always use Exacto for the Agent: Agent tool calls use the :exacto variant even with a Host priority set. Without it, any Host priority but Balanced turns off Auto Exacto.',
  'Character → Lorebook → Attach a library book to a character that already has entries: the copy prompt offers Merge. Merge keeps the existing entries, adds the book entries after them, and unlinks the book. Open in vault then makes a new book from the merged entries.',
  'Lorebooks tab → open a book → Book Name: names with spaces type normally now.',
];
