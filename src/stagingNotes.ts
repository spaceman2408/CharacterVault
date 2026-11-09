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
export const STAGING_VERSION = 'v1.8.6 staging 1';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Library → click a tag chip on a card: the search fills with that tag and the library narrows to matching cards. The "+N" chip still opens the card details.',
  'Library search → a × appears once you type; Escape clears the search, and Escape again leaves the box. Press / anywhere on the library (not while typing) to jump to the search.',
  'Library → new "Created" sort next to Name and Recent: newest created or imported cards first. Cards you already had should sort by when they were added too.',
  'Agent with a DeepSeek or Kimi thinking model → ask for an edit that takes a few tool calls: the run should get past its first tool call instead of failing with an error about reasoning_content. Try it with "Remember earlier edits in the chat" on as well, over two or three runs.',
  'OpenAI reasoning models (o-series, GPT-5) on api.openai.com → chat with Orion and run the agent: replies should keep your Max Tokens limit instead of failing or ignoring it.',
  'OpenRouter → if a model errors partway through a reply, you should see the provider’s error instead of a cut-off reply shown as finished.',
];
