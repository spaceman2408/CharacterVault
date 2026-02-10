/**
 * Reasoning Parser Utilities
 *
 * Handles parsing reasoning content from AI models in different formats:
 * - Separate field format (DeepSeek-style): delta.reasoning_content field
 * - Inline tag format (Qwen/QwQ-style): <think></think> tags from content
 */

/**
 * Reasoning format types supported by AI models.
 * Uses const assertion for erasableSyntaxOnly compatibility.
 */
export const ReasoningFormat = {
  /** Reasoning content is provided in a separate field (e.g., delta.reasoning_content) */
  SEPARATE_FIELD: 'separate_field',
  /** Reasoning content is embedded within <think></think> tags in the main content */
  INLINE_TAGS: 'inline_tags',
} as const;

/**
 * Type for reasoning format values.
 */
export type ReasoningFormat = (typeof ReasoningFormat)[keyof typeof ReasoningFormat];

/**
 * Interface representing the result of parsing a chunk of AI model output.
 */
export interface ReasoningParseResult {
  /** The main response content, with reasoning tags stripped */
  content: string;
  /** The reasoning content extracted from the response */
  reasoning: string;
  /** Whether the parser is currently inside a think block */
  isInThinkBlock: boolean;
}

/**
 * Result of parsing inline think tags from text.
 */
interface InlineTagParseResult {
  /** The text content with think tags removed */
  text: string;
  /** The extracted reasoning content from within think tags */
  reasoning: string;
}

/**
 * OpenAI-compatible streaming chunk delta.
 * Note: NanoGPT uses 'reasoning' field, not 'reasoning_content' for default endpoint
 */
interface ChatCompletionDelta {
  role?: string;
  content?: string;
  reasoning_content?: string;
  /** NanoGPT uses 'reasoning' field for default endpoint */
  reasoning?: string;
}

/**
 * OpenAI-compatible streaming chunk choice.
 * Note: OpenRouter returns reasoning in choice.reasoning.content
 */
interface ChatCompletionChoice {
  index: number;
  delta: ChatCompletionDelta;
  finish_reason: string | null;
  /** OpenRouter returns reasoning at choice level */
  reasoning?: {
    content?: string;
  };
}

/**
 * OpenAI-compatible streaming chunk.
 */
interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
}

/**
 * Parser for handling reasoning content from AI models.
 * Supports both separate field format (DeepSeek) and inline tag format (Qwen/QwQ).
 */
export class ReasoningParser {
  /** Buffer for handling fragmented tags across chunks */
  private buffer: string = '';
  /** Tracks whether we're currently inside a think block */
  private isInThinkBlock: boolean = false;
  /** Accumulated reasoning content */
  private reasoningContent: string = '';
  /** Accumulated main content */
  private mainContent: string = '';

  /** Think tag variations that might be used by different models (case-insensitive) */
  private static readonly THINK_START_VARIATIONS = ['<think>', '<thinking>', '<reasoning>', '<thought>'];
  private static readonly THINK_END_VARIATIONS = ['</think>', '</thinking>', '</reasoning>', '</thought>'];

  /**
   * Parses a streaming chunk from an AI model and extracts reasoning content.
   * Checks ALL possible reasoning locations regardless of model type to ensure
   * compatibility with any API format (OpenRouter, DeepSeek, NanoGPT, etc.)
   *
   * @param chunk - The streaming chunk from the AI model (typically contains delta/content fields)
   * @param modelId - Optional model identifier for format detection (used for inline tag detection)
   * @returns The parsing result with separated content and reasoning
   */
  parseChunk(chunk: ChatCompletionChunk, modelId?: string): ReasoningParseResult {
    const format = modelId ? detectReasoningFormat(modelId) : ReasoningFormat.INLINE_TAGS;

    // First, always try to extract from separate field locations (OpenRouter, DeepSeek, NanoGPT)
    // This ensures we catch reasoning regardless of model name
    const choice = chunk?.choices?.[0];
    const delta = choice?.delta;
    const content = delta?.content ?? '';
    
    // Check ALL possible separate field locations
    const separateFieldReasoning = delta?.reasoning_content ?? 
                                   delta?.reasoning ?? 
                                   choice?.reasoning?.content ?? 
                                   '';
    
    if (separateFieldReasoning || format === ReasoningFormat.SEPARATE_FIELD) {
      // Use separate field parsing, but also include any content
      if (separateFieldReasoning) {
        this.reasoningContent += separateFieldReasoning;
      }
      if (content) {
        this.mainContent += content;
      }
      return {
        content: this.mainContent,
        reasoning: this.reasoningContent,
        isInThinkBlock: false,
      };
    }

    // Fall back to inline tag parsing for models that use <think> tags
    return this.parseInlineTagChunk(chunk);
  }

  /**
   * Finds the index of a think tag in the buffer (case-insensitive).
   * Checks for all known variations of think tags.
   *
   * @param buffer - The buffer to search
   * @param startIndex - Index to start searching from
   * @returns Object with index and the matched tag, or null if not found
   */
  private findThinkTag(buffer: string, startIndex: number = 0): { index: number; tag: string } | null {
    const lowerBuffer = buffer.toLowerCase();
    let bestMatch: { index: number; tag: string } | null = null;

    for (const tag of ReasoningParser.THINK_START_VARIATIONS) {
      const index = lowerBuffer.indexOf(tag, startIndex);
      if (index !== -1 && (bestMatch === null || index < bestMatch.index)) {
        bestMatch = { index, tag };
      }
    }

    return bestMatch;
  }

  /**
   * Finds the index of a closing think tag in the buffer (case-insensitive).
   * Checks for all known variations of closing tags.
   *
   * @param buffer - The buffer to search
   * @param startIndex - Index to start searching from
   * @returns Object with index and the matched tag, or null if not found
   */
  private findCloseTag(buffer: string, startIndex: number = 0): { index: number; tag: string } | null {
    const lowerBuffer = buffer.toLowerCase();
    let bestMatch: { index: number; tag: string } | null = null;

    for (const tag of ReasoningParser.THINK_END_VARIATIONS) {
      const index = lowerBuffer.indexOf(tag, startIndex);
      if (index !== -1 && (bestMatch === null || index < bestMatch.index)) {
        bestMatch = { index, tag };
      }
    }

    return bestMatch;
  }

  /**
   * Parses a chunk using the inline tag format (Qwen/QwQ-style).
   * Handles fragmented <think></think> tags across chunks.
   *
   * @param chunk - The streaming chunk from the AI model
   * @returns The parsing result
   */
  private parseInlineTagChunk(chunk: ChatCompletionChunk): ReasoningParseResult {
    const delta = chunk?.choices?.[0]?.delta;
    const content = delta?.content ?? '';

    // Add new content to buffer
    this.buffer += content;

    // Process the buffer to extract reasoning and content
    this.processBuffer();

    return {
      content: this.mainContent,
      reasoning: this.reasoningContent,
      isInThinkBlock: this.isInThinkBlock,
    };
  }

  /**
   * Processes the buffer to extract reasoning from think tags and regular content.
   * Handles fragmented tags by keeping unprocessed content in the buffer.
   * Uses case-insensitive matching for various think tag formats.
   */
  private processBuffer(): void {
    while (this.buffer.length > 0) {
      if (this.isInThinkBlock) {
        // Look for closing tag (case-insensitive)
        const closeMatch = this.findCloseTag(this.buffer);

        if (closeMatch === null) {
          // No closing tag found, all buffer content is reasoning
          // But keep last 12 chars in buffer in case it's a partial closing tag
          const maxCloseTagLen = Math.max(...ReasoningParser.THINK_END_VARIATIONS.map(t => t.length));
          const keepInBuffer = Math.min(this.buffer.length, maxCloseTagLen - 1);
          const processContent = this.buffer.slice(0, this.buffer.length - keepInBuffer);
          this.reasoningContent += processContent;
          this.buffer = this.buffer.slice(this.buffer.length - keepInBuffer);
          break;
        }

        // Found closing tag
        this.reasoningContent += this.buffer.slice(0, closeMatch.index);
        this.buffer = this.buffer.slice(closeMatch.index + closeMatch.tag.length);
        this.isInThinkBlock = false;
      } else {
        // Look for opening tag (case-insensitive)
        const openMatch = this.findThinkTag(this.buffer);

        if (openMatch === null) {
          // No opening tag found, all buffer content is main content
          // But keep last 10 chars in buffer in case it's a partial opening tag
          const maxOpenTagLen = Math.max(...ReasoningParser.THINK_START_VARIATIONS.map(t => t.length));
          const keepInBuffer = Math.min(this.buffer.length, maxOpenTagLen - 1);
          const processContent = this.buffer.slice(0, this.buffer.length - keepInBuffer);
          this.mainContent += processContent;
          this.buffer = this.buffer.slice(this.buffer.length - keepInBuffer);
          break;
        }

        // Found opening tag
        this.mainContent += this.buffer.slice(0, openMatch.index);
        this.buffer = this.buffer.slice(openMatch.index + openMatch.tag.length);
        this.isInThinkBlock = true;
      }
    }
  }

  /**
   * Parses inline think tags from a complete text string.
   * Useful for processing non-streaming responses or historical data.
   * Uses case-insensitive matching for various think tag formats.
   *
   * @param text - The text containing potential <think></think> tags
   * @returns Object with text (tags stripped) and reasoning (extracted content)
   */
  parseInlineTags(text: string): InlineTagParseResult {
    let resultText = '';
    let resultReasoning = '';
    let remaining = text;

    while (remaining.length > 0) {
      // Find opening tag (case-insensitive)
      const openMatch = this.findThinkTag(remaining);

      if (openMatch === null) {
        // No more think tags
        resultText += remaining;
        break;
      }

      // Add content before think tag to text
      resultText += remaining.slice(0, openMatch.index);

      // Find closing tag (case-insensitive), starting after the opening tag
      const closeMatch = this.findCloseTag(remaining, openMatch.index + openMatch.tag.length);

      if (closeMatch === null) {
        // No closing tag - treat rest as reasoning (though this is malformed)
        resultReasoning += remaining.slice(openMatch.index + openMatch.tag.length);
        break;
      }

      // Extract reasoning content
      resultReasoning += remaining.slice(
        openMatch.index + openMatch.tag.length,
        closeMatch.index
      );

      // Continue processing after closing tag
      remaining = remaining.slice(closeMatch.index + closeMatch.tag.length);
    }

    return {
      text: resultText,
      reasoning: resultReasoning,
    };
  }

  /**
   * Flushes any remaining buffer content to the appropriate output.
   * Should be called at the end of a stream to ensure no content is lost.
   */
  flush(): ReasoningParseResult {
    // Process any remaining buffer content
    if (this.buffer.length > 0) {
      if (this.isInThinkBlock) {
        this.reasoningContent += this.buffer;
      } else {
        this.mainContent += this.buffer;
      }
      this.buffer = '';
    }

    return {
      content: this.mainContent,
      reasoning: this.reasoningContent,
      isInThinkBlock: this.isInThinkBlock,
    };
  }

  /**
   * Resets the parser state.
   * Clears all accumulated content and buffers. Should be called when starting
   * to parse a new conversation or stream.
   */
  reset(): void {
    this.buffer = '';
    this.isInThinkBlock = false;
    this.reasoningContent = '';
    this.mainContent = '';
  }
}

/**
 * Detects the reasoning format based on the model identifier.
 *
 * @param modelId - The model identifier string (e.g., 'deepseek-chat', 'qwen-turbo')
 * @returns The detected ReasoningFormat
 *
 * @example
 * detectReasoningFormat('deepseek-chat') // Returns ReasoningFormat.SEPARATE_FIELD
 * detectReasoningFormat('qwen-turbo') // Returns ReasoningFormat.INLINE_TAGS
 * detectReasoningFormat('QwQ-32B') // Returns ReasoningFormat.INLINE_TAGS
 * detectReasoningFormat('model:thinking') // Returns ReasoningFormat.SEPARATE_FIELD
 */
export function detectReasoningFormat(modelId: string): ReasoningFormat {
  const lowerModelId = modelId.toLowerCase();

  // DeepSeek models use separate field format
  if (lowerModelId.includes('deepseek')) {
    return ReasoningFormat.SEPARATE_FIELD;
  }

  // Models with :thinking suffix use separate field format (like DeepSeek, NanoGPT)
  // Note: NanoGPT uses `delta.reasoning` instead of `reasoning_content`, but same format
  if (lowerModelId.includes(':thinking')) {
    return ReasoningFormat.SEPARATE_FIELD;
  }

  // Models with -thinking suffix use separate field format
  if (lowerModelId.includes('-thinking')) {
    return ReasoningFormat.SEPARATE_FIELD;
  }

  // Models with "reasoning" in the name might use separate field
  if (lowerModelId.includes('reasoning')) {
    return ReasoningFormat.SEPARATE_FIELD;
  }

  // Qwen and QwQ models use inline tags
  if (lowerModelId.includes('qwen') || lowerModelId.includes('qwq')) {
    return ReasoningFormat.INLINE_TAGS;
  }

  // Default to inline tags for unknown models
  return ReasoningFormat.INLINE_TAGS;
}
