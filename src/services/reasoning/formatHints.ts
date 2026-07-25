/**
 * Soft model-id hints for reasoning layout.
 *
 * Hints never block structured field extraction — field extractors always run first.
 * Use SEPARATE_FIELD when empty structured deltas should still treat content as
 * non-tag stream (rare). Use INLINE_TAGS for think-tag models and unknowns.
 *
 * To add a model family hint: append a rule to {@link FORMAT_HINT_RULES}.
 */

import { ReasoningFormat, type ReasoningFormat as ReasoningFormatType } from './types';

export interface FormatHintRule {
  id: string;
  /** Matched against modelId.toLowerCase() */
  test: (modelIdLower: string) => boolean;
  format: ReasoningFormatType;
}

/**
 * First matching rule wins. Keep more specific patterns above broad ones.
 */
export const FORMAT_HINT_RULES: readonly FormatHintRule[] = [
  {
    id: 'deepseek',
    test: (id) => id.includes('deepseek'),
    format: ReasoningFormat.SEPARATE_FIELD,
  },
  {
    id: 'colon-thinking-suffix',
    test: (id) => id.includes(':thinking'),
    format: ReasoningFormat.SEPARATE_FIELD,
  },
  {
    id: 'dash-thinking-suffix',
    test: (id) => id.includes('-thinking'),
    format: ReasoningFormat.SEPARATE_FIELD,
  },
  {
    id: 'reasoning-in-name',
    test: (id) => id.includes('reasoning'),
    format: ReasoningFormat.SEPARATE_FIELD,
  },
  {
    id: 'qwen-qwq',
    test: (id) => id.includes('qwen') || id.includes('qwq'),
    format: ReasoningFormat.INLINE_TAGS,
  },
  {
    id: 'gemma-4',
    test: (id) => id.includes('gemma-4'),
    format: ReasoningFormat.INLINE_TAGS,
  },
  {
    id: 'minimax',
    test: (id) => id.includes('minimax'),
    format: ReasoningFormat.SEPARATE_FIELD,
  },
];

export function detectReasoningFormat(modelId: string): ReasoningFormatType {
  const lower = modelId.toLowerCase();
  for (const rule of FORMAT_HINT_RULES) {
    if (rule.test(lower)) return rule.format;
  }
  return ReasoningFormat.INLINE_TAGS;
}
