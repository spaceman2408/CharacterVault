/**
 * Models known not to return human-readable chain-of-thought in API responses.
 * Reasoning may still run (and cost tokens); only the thinking *text* is withheld.
 *
 * Match on model id substrings (OpenRouter-style `provider/model` or bare ids).
 * Prefer specific patterns over broad vendor names so we do not false-positive.
 */

export interface HiddenCotRule {
  id: string;
  /** Matched against modelId.toLowerCase() */
  test: (modelIdLower: string) => boolean;
  /** Short UX note shown in settings when this model is selected */
  note: string;
}

/** Shared copy for APIs that keep CoT private. */
export const HIDDEN_COT_NOTE =
  'Proprietary model: does not return thinking process';

/**
 * First matching rule wins. Keep more specific patterns first.
 *
 * Extend this list as we learn more model families that never expose CoT text.
 */
export const HIDDEN_COT_RULES: readonly HiddenCotRule[] = [
  {
    id: 'meta-muse-spark',
    // meta/muse-spark-1.2, muse-spark-1.1, etc. (not open-weight Muse Glimmer)
    test: (id) => id.includes('muse-spark'),
    note: HIDDEN_COT_NOTE,
  },
  {
    id: 'openai-o-series',
    // openai/o1, o1-pro, o3-mini, o4-mini, bare o3-2025-..., etc.
    test: (id) => /(?:^|[/_.-])o[1-4](?:[-./:]|$)/.test(id),
    note: HIDDEN_COT_NOTE,
  },
];

/**
 * Whether this model id is known not to return readable thinking text.
 */
export function modelWithholdsReasoningText(modelId?: string): boolean {
  return getHiddenChainOfThoughtNote(modelId) !== null;
}

/**
 * UX note for settings when the selected model withholds CoT, or null if unknown/fine.
 */
export function getHiddenChainOfThoughtNote(modelId?: string): string | null {
  if (!modelId?.trim()) return null;
  const lower = modelId.toLowerCase();
  for (const rule of HIDDEN_COT_RULES) {
    if (rule.test(lower)) return rule.note;
  }
  return null;
}
