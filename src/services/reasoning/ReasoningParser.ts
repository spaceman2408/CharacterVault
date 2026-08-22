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
    const contentAt = this.state.mainContent.length;
    const reasoningAt = this.state.reasoningContent.length;

    if (separateFieldReasoning || format === ReasoningFormat.SEPARATE_FIELD) {
      if (separateFieldReasoning) {
        this.state.reasoningContent.append(separateFieldReasoning);
      }

      if (content) {
        // Some gateways also embed tags in content; strip to avoid duplication.
        const stripped = parseInlineTags(content);
        this.state.mainContent.append(stripped.text);
        if (stripped.reasoning && !separateFieldReasoning) {
          this.state.reasoningContent.append(stripped.reasoning);
        }
      }

      return this.snapshot(false, contentAt, reasoningAt);
    }

    appendThinkTagContent(this.state, content);

    return this.snapshot(this.state.isInThinkBlock, contentAt, reasoningAt);
  }

  /** Complete-string tag parse (also used to strip tags from structured-path content). */
  parseInlineTags(text: string): InlineTagParseResult {
    return parseInlineTags(text);
  }

  flush(): ReasoningParseResult {
    const contentAt = this.state.mainContent.length;
    const reasoningAt = this.state.reasoningContent.length;
    flushThinkTagState(this.state);
    return this.snapshot(this.state.isInThinkBlock, contentAt, reasoningAt);
  }

  reset(): void {
    resetThinkTagState(this.state);
  }

  private snapshot(
    isInThinkBlock: boolean,
    contentAt: number,
    reasoningAt: number,
  ): ReasoningParseResult {
    const main = this.state.mainContent;
    const reason = this.state.reasoningContent;
    return {
      get content() {
        return main.toString();
      },
      get reasoning() {
        return reason.toString();
      },
      contentDelta: main.sliceFrom(contentAt),
      reasoningDelta: reason.sliceFrom(reasoningAt),
      isInThinkBlock,
    };
  }
}
