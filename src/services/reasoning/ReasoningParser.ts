/**
 * Streaming reasoning orchestrator: structured fields first, then think tags.
 */

import { ReasoningFormat } from './types';
import type { ChatCompletionChunk, InlineTagParseResult, ReasoningParseResult } from './types';
import {
  extractStructuredReasoning,
  sourceFromChunk,
} from './fieldExtractors';
import { detectReasoningFormat } from './formatHints';
import {
  appendThinkTagContent,
  createThinkTagStreamState,
  flushThinkTagState,
  parseInlineTags,
  resetThinkTagState,
  type ThinkTagStreamState,
} from './thinkTags';

export class ReasoningParser {
  private state: ThinkTagStreamState = createThinkTagStreamState();

  /**
   * Parse one stream chunk. Always checks structured fields first, then think tags.
   * modelId is only a soft hint when no structured reasoning appears on the chunk.
   */
  parseChunk(chunk: ChatCompletionChunk, modelId?: string): ReasoningParseResult {
    const format = modelId ? detectReasoningFormat(modelId) : ReasoningFormat.INLINE_TAGS;
    const source = sourceFromChunk(chunk);
    const content = source.content ?? '';
    const separateFieldReasoning = extractStructuredReasoning(source);

    if (separateFieldReasoning || format === ReasoningFormat.SEPARATE_FIELD) {
      if (separateFieldReasoning) {
        this.state.reasoningContent += separateFieldReasoning;
      }

      if (content) {
        // Some gateways also embed tags in content; strip to avoid duplication.
        const stripped = parseInlineTags(content);
        this.state.mainContent += stripped.text;
        if (stripped.reasoning && !separateFieldReasoning) {
          this.state.reasoningContent += stripped.reasoning;
        }
      }

      return {
        content: this.state.mainContent,
        reasoning: this.state.reasoningContent,
        isInThinkBlock: false,
      };
    }

    appendThinkTagContent(this.state, content);

    return {
      content: this.state.mainContent,
      reasoning: this.state.reasoningContent,
      isInThinkBlock: this.state.isInThinkBlock,
    };
  }

  /** Complete-string tag parse (also used to strip tags from structured-path content). */
  parseInlineTags(text: string): InlineTagParseResult {
    return parseInlineTags(text);
  }

  flush(): ReasoningParseResult {
    flushThinkTagState(this.state);
    return {
      content: this.state.mainContent,
      reasoning: this.state.reasoningContent,
      isInThinkBlock: this.state.isInThinkBlock,
    };
  }

  reset(): void {
    resetThinkTagState(this.state);
  }
}
