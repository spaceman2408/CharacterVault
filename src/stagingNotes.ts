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
export const STAGING_VERSION = 'v1.8.6 staging 3';

/** One short line per thing you want testers to try. */
export const STAGING_TEST_NOTES: string[] = [
  'Library → click a tag chip on a card: the search fills with that tag and the library narrows to matching cards. The "+N" chip still opens the card details.',
  'Library search → a × appears once you type; Escape clears the search, and Escape again leaves the box. Press / anywhere on the library (not while typing) to jump to the search.',
  'Library → new "Created" sort next to Name and Recent: newest created or imported cards first. Cards you already had should sort by when they were added too.',
  'Agent with a DeepSeek or Kimi thinking model → ask for an edit that takes a few tool calls: the run should get past its first tool call instead of failing with an error about reasoning_content. Try it with "Remember earlier edits in the chat" on as well, over two or three runs.',
  'OpenAI reasoning models (o-series, GPT-5) on api.openai.com → chat with Orion and run the agent: replies should keep your Max Tokens limit instead of failing or ignoring it.',
  'OpenRouter → if a model errors partway through a reply, you should see the provider’s error instead of a cut-off reply shown as finished.',
  'Settings → AI Config → new presets: Moonshot (Kimi), Z.ai (GLM), Z.ai Coding Plan and DeepSeek. If you have a key for one, fetch models, chat with Orion and run the agent on it. Note anything that errors or ignores the Reasoning toggle.',
  'Settings → AI Config → pick a provider (or Custom URL) and a model, then "Save as preset" under the URL. Save a few on OpenRouter with different models: each shows under Saved, picking one switches to its model, and they all share one OpenRouter key. "Remove preset" asks first. Clear AI Settings keeps saved presets but drops their keys.',
  'Settings → AI Config → with an OpenRouter preset saved, pick plain OpenRouter and choose a different model, then switch to the saved preset and back. Plain OpenRouter should stay selected with its own model, both right away and after Save and reopening Settings.',
  'Agent → ask for a change that takes a few tool calls on a slower model: while the model writes its next reply, the spinner should say "Working…" instead of staying on the last tool (like "Reading First Message").',
  'Agent → ask for a lorebook overhaul that touches many entries: a reply can now hold up to 24 tool calls (was 12) and a run up to 150 entry updates (was 50), so big passes should stop hitting "max updates per run".',
];
