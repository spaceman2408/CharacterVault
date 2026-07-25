/**
 * Structured reasoning field extractors.
 *
 * To support a new API that puts reasoning in a dedicated JSON field (not think tags):
 * 1. Extend {@link ReasoningSource} in types.ts if the field is new.
 * 2. Add one entry to {@link STRUCTURED_FIELD_EXTRACTORS} below.
 * 3. Add a fixture test in tests/services/ReasoningParser.test.ts.
 *
 * Extractors run in order; the first non-empty string wins (same as the old ?? chain).
 */

import type { ReasoningMessageFields, ReasoningSource, ChatCompletionChunk } from './types';

export interface StructuredFieldExtractor {
  /** Stable id for logs/tests */
  id: string;
  /** What this field is for (docs only) */
  description: string;
  extract: (source: ReasoningSource) => string;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Registry of structured reasoning locations.
 * Prefer adding here over branching inside ReasoningParser.
 */
export const STRUCTURED_FIELD_EXTRACTORS: readonly StructuredFieldExtractor[] = [
  {
    id: 'delta.reasoning_content',
    description: 'DeepSeek-style / many OpenAI-compatible gateways',
    extract: (s) => asText(s.reasoning_content),
  },
  {
    id: 'delta.reasoning',
    description: 'NanoGPT default endpoint (and some others)',
    extract: (s) => asText(s.reasoning),
  },
  {
    id: 'choice.reasoning.content',
    description: 'OpenRouter stream chunks',
    extract: (s) => asText(s.choiceReasoningContent),
  },
  {
    id: 'delta.reasoning_details',
    description: 'Minimax with reasoning_split (array of { text })',
    extract: (s) => {
      const details = s.reasoning_details;
      if (!Array.isArray(details) || details.length === 0) return '';
      return details
        .map((d) => asText(d?.text))
        .filter((t) => t.length > 0)
        .join('');
    },
  },
];

export function sourceFromChunk(chunk: ChatCompletionChunk): ReasoningSource {
  const choice = chunk?.choices?.[0];
  const delta = choice?.delta;
  return {
    content: delta?.content,
    reasoning_content: delta?.reasoning_content,
    reasoning: delta?.reasoning,
    reasoning_details: delta?.reasoning_details,
    choiceReasoningContent: choice?.reasoning?.content,
  };
}

export function sourceFromMessage(message: ReasoningMessageFields): ReasoningSource {
  return {
    content: message.content,
    reasoning_content: message.reasoning_content,
    reasoning: message.reasoning,
    reasoning_details: message.reasoning_details,
  };
}

/** First non-empty structured reasoning string, or ''. */
export function extractStructuredReasoning(source: ReasoningSource): string {
  for (const extractor of STRUCTURED_FIELD_EXTRACTORS) {
    const value = extractor.extract(source);
    if (value.length > 0) return value;
  }
  return '';
}

/** Non-stream helper: reasoning on a final assistant message, if any. */
export function extractMessageReasoning(message: ReasoningMessageFields): string | undefined {
  const value = extractStructuredReasoning(sourceFromMessage(message));
  return value.length > 0 ? value : undefined;
}
