/**
 * Public entry for reasoning parse utilities.
 * Implementation lives under ./reasoning — add new field formats there.
 */
export {
  ReasoningFormat,
  ReasoningParser,
  detectReasoningFormat,
  extractMessageReasoning,
  extractStructuredReasoning,
  STRUCTURED_FIELD_EXTRACTORS,
  THINK_TAG_PAIRS,
  FORMAT_HINT_RULES,
  parseInlineTags,
  type ReasoningParseResult,
  type ReasoningSource,
  type ChatCompletionChunk,
} from './reasoning';
