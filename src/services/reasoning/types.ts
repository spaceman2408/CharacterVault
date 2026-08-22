/**
 * Shared types for reasoning extraction from OpenAI-compatible responses.
 */

export const ReasoningFormat = {
  /** Reasoning in a structured API field (DeepSeek, NanoGPT, Minimax, …) */
  SEPARATE_FIELD: 'separate_field',
  /** Reasoning embedded in content via think tags (Qwen, Gemma 4, …) */
  INLINE_TAGS: 'inline_tags',
} as const;

export type ReasoningFormat = (typeof ReasoningFormat)[keyof typeof ReasoningFormat];

export interface ReasoningParseResult {
  content: string;
  reasoning: string;
  contentDelta?: string;
  reasoningDelta?: string;
  isInThinkBlock: boolean;
}

export interface InlineTagParseResult {
  text: string;
  reasoning: string;
}

/**
 * Normalized view of where gateways put reasoning.
 * Built from stream deltas or final assistant messages.
 */
export interface ReasoningSource {
  content?: string | null;
  reasoning_content?: string | null;
  /** NanoGPT default endpoint */
  reasoning?: string | null;
  /** Minimax (with reasoning_split) */
  reasoning_details?: Array<{ type?: string; text?: string }> | null;
  /** OpenRouter: choice.reasoning.content on stream chunks */
  choiceReasoningContent?: string | null;
}

/** Stream chunk shape (subset used for reasoning). */
export interface ChatCompletionDelta {
  role?: string;
  content?: string;
  reasoning_content?: string;
  reasoning?: string;
  reasoning_details?: Array<{ type?: string; text?: string }>;
}

export interface ChatCompletionChoice {
  index: number;
  delta: ChatCompletionDelta;
  finish_reason: string | null;
  reasoning?: {
    content?: string;
  };
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
}

/** Final message fields that may carry reasoning (non-stream). */
export interface ReasoningMessageFields {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
  reasoning_details?: Array<{ type?: string; text?: string }> | null;
}
