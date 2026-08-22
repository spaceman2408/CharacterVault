/**
 * @fileoverview AI Service for handling AI API communication.
 * Supports OpenAI-compatible APIs (NanoGPT, etc.)
 * @module @services/AIService
 */

import type {
  AIConfig,
  SamplerSettings,
  AIModelInfo,
  PromptSettings,
  CharacterSpec,
  CharacterBook,
  ReasoningEffort,
  AIOperation,
} from '../db/characterTypes';
import { ReasoningParser, extractMessageReasoning } from './ReasoningParser';
import { resolveProvider } from './providers';
import type { ModelProviderInfo, FetchModelsOptions } from './providers';
import { EDITOR_PERSONA, buildSystemPrompt as buildSystemPromptParts, getStablePrefix as getStablePrefixParts } from './PromptBuilder';
import {
  applyCapabilityCache,
  getCapabilityCache,
  parseSupportedValues,
  recordRepairInCache,
  recordSupportedEfforts,
  repairChatRequest,
  sanitizeSamplerParams,
  stripAllNonStandardParams,
  type ChatRequestLike,
} from './chatRequestRepair';
import {
  applyToolCallDeltas,
  finalizeToolCalls,
  normalizeMessageToolCalls,
  type NativeToolCall,
} from './toolCallStream';

/**
 * Bytes per token ratio for token estimation.
 *
 * Conservative vs typical English (~4 chars/token): using 4 bytes/token slightly
 * over-counts relative to a naive 5-byte heuristic so we clamp/truncate earlier.
 * Real BPE counts still vary by model; UI estimates remain approximate.
 *
 * History: was 5, which under-estimated enough to exceed provider limits
 * (e.g. ~140k real input vs a 128k window while local estimate still "fit").
 */
export const BYTES_PER_TOKEN = 4;

/** Shared stateless encoder; encode() is safe to reuse across synchronous calls. */
const byteEncoder = new TextEncoder();

/**
 * Estimate token count for a string.
 * Uses heuristic: 1 token ≈ {@link BYTES_PER_TOKEN} UTF-8 bytes.
 * Handles non-ASCII text (CJK, emoji, etc.) better than raw character count.
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const byteLength = byteEncoder.encode(text).length;
  return Math.ceil(byteLength / BYTES_PER_TOKEN);
}

/** Overhead reserved per context chunk for join separators / framing. */
const CONTEXT_CHUNK_SEPARATOR_TOKENS = 5;

/** Don't partial-fill with a sliver smaller than this (tokens). */
const MIN_PARTIAL_CONTEXT_TOKENS = 48;

/**
 * Truncate a string so its estimated token count fits `availableTokens`.
 * Uses the same UTF-8 byte heuristic as {@link estimateTokens}.
 */
export function truncateTextToTokenLimit(text: string, availableTokens: number): string {
  if (availableTokens <= 0) return '...';
  if (estimateTokens(text) <= availableTokens) return text;

  const ellipsis = '...';
  const maxBytes = Math.max(0, availableTokens * BYTES_PER_TOKEN - byteEncoder.encode(ellipsis).length);

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (byteEncoder.encode(text.slice(0, mid)).length <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  let end = lo;
  if (end > 0 && end < text.length) {
    const code = text.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  }

  return text.slice(0, Math.max(0, end)) + ellipsis;
}

/**
 * Fit ordered context chunks into a token budget.
 * Includes whole chunks while they fit; if the next chunk overflows, partially
 * includes a truncated prefix of it (so a 100k+ lorebook is not dropped to empty).
 */
export function fitContextChunks(context: string[], availableTokens: number): string[] {
  if (availableTokens <= 0) return [];

  const result: string[] = [];
  let currentTokens = 0;

  for (const ctx of context) {
    if (!ctx || !ctx.trim()) continue;
    const tokens = estimateTokens(ctx) + CONTEXT_CHUNK_SEPARATOR_TOKENS;
    if (currentTokens + tokens <= availableTokens) {
      result.push(ctx);
      currentTokens += tokens;
      continue;
    }

    const remaining = availableTokens - currentTokens - CONTEXT_CHUNK_SEPARATOR_TOKENS;
    if (remaining >= MIN_PARTIAL_CONTEXT_TOKENS) {
      result.push(truncateTextToTokenLimit(ctx, remaining));
    }
    break;
  }

  return result;
}

/**
 * Token breakdown for vault cards.
 *
 * - **active**: fields typically always present in an RP prompt
 *   (name, description, appearance, personality, scenario, system, post-history, examples)
 * - **total**: everything on the card, including greetings, lorebook, and metadata
 *
 * Not counted as active: first message, alternate greetings, lorebook,
 * creator/notes/tags/version (those still count toward total).
 */
export interface CharacterTokenEstimate {
  active: number;
  total: number;
}

/**
 * Estimate active + total tokens for a character card.
 * Uses the same byte-based heuristic as {@link estimateTokens}.
 */
export function estimateCharacterCardTokens(
  data: { spec: CharacterSpec; characterBook?: CharacterBook | null },
  nameFallback = ''
): CharacterTokenEstimate {
  const spec = data.spec;
  let active = 0;
  let total = 0;

  const addActive = (text?: string | null) => {
    if (!text) return;
    const n = estimateTokens(text);
    active += n;
    total += n;
  };
  const addTotalOnly = (text?: string | null) => {
    if (!text) return;
    total += estimateTokens(text);
  };

  // Active (always-on RP definition fields)
  addActive(spec.name || nameFallback);
  addActive(spec.description);
  addActive(spec.physical_description);
  addActive(spec.personality);
  addActive(spec.scenario);
  addActive(spec.system_prompt);
  addActive(spec.post_history_instructions);
  addActive(spec.mes_example);

  // Total-only: greetings / one-shot / conditional / metadata
  addTotalOnly(spec.first_mes);
  if (spec.alternate_greetings?.length) {
    addTotalOnly(spec.alternate_greetings.join('\n---\n'));
  }
  addTotalOnly(spec.creator);
  addTotalOnly(spec.creator_notes);
  addTotalOnly(spec.character_version);
  if (spec.tags?.length) {
    addTotalOnly(spec.tags.join(', '));
  }

  const book = data.characterBook;
  if (book) {
    addTotalOnly(book.name);
    addTotalOnly(book.description);
    for (const entry of book.entries ?? []) {
      addTotalOnly(entry.content);
      if (entry.keys?.length) addTotalOnly(entry.keys.join(','));
      addTotalOnly(entry.name);
      addTotalOnly(entry.comment);
      if (entry.secondary_keys?.length) {
        addTotalOnly(entry.secondary_keys.join(','));
      }
    }
  }

  return { active, total };
}

/**
 * Format a token estimate for compact UI display (e.g. vault cards).
 */
export function formatTokenEstimate(tokens: number): string {
  if (tokens < 1000) return `~${tokens}`;
  if (tokens < 10_000) return `~${(tokens / 1000).toFixed(1)}k`;
  return `~${Math.round(tokens / 1000)}k`;
}

/**
 * Default prompt settings for text operations
 */
const DEFAULT_PROMPTS: PromptSettings = {
  expand: 'Please expand and elaborate on the following text, adding more detail and depth while maintaining the same style and tone:\n\n"""\n${text}\n"""\n\nProvide only the expanded text without any additional commentary.',
  rewrite: 'Please rewrite the following text to improve clarity, flow, and impact while preserving the original meaning:\n\n"""\n${text}\n"""\n\nProvide only the rewritten text without any additional commentary.',
  instruct: 'Please apply the following instruction to the text below:\n\nInstruction: ${instruction}\n\nText:\n"""\n${text}\n"""\n\nProvide only the modified text without any additional commentary.',
  shorten: 'Please shorten and condense the following text, making it more concise while preserving the key meaning and essential details:\n\n"""\n${text}\n"""\n\nProvide only the shortened text without any additional commentary.',
  lengthen: 'Please lengthen the following text by adding more detail, depth, and elaboration while maintaining the same style and tone:\n\n"""\n${text}\n"""\n\nProvide only the lengthened text without any additional commentary.',
  vivid: 'Please rewrite the following text to make it more vivid and descriptive, adding sensory details, imagery, and evocative language:\n\n"""\n${text}\n"""\n\nProvide only the enhanced text without any additional commentary.',
  emotion: 'Please rewrite the following text to add more emotional depth, feeling, and character voice while preserving the original meaning:\n\n"""\n${text}\n"""\n\nProvide only the enhanced text without any additional commentary.',
  grammar: 'Please fix any grammar, spelling, and punctuation errors in the following text while preserving the original meaning and style:\n\n"""\n${text}\n"""\n\nProvide only the corrected text without any additional commentary.',
};

/**
 * Default system prompt for AI Chat conversations (not customizable)
 * This is the persona for Orion, the chat assistant for CharacterVault
 */
export const DEFAULT_ASK_PROMPT = `You are Orion, CharacterVault's AI assistant for helping users create, edit, and understand roleplay character cards (e.g., SillyTavern).

Features & Specs:
- I/O: Upload or Export (via top-right) v2/v3 specs as JSON or PNG.
- Core Fields: Image, Name, Description, First Message, Examples, and Greetings 
- Lorebook: Basic edits only (name, keys, priority, position, enabled, case-sensitive, constant, content). Adv. tuning requires SillyTavern.
- Metadata: Avatar URL, Notes, Creator, Creator Notes (has CSS preview), Version, Tags (these do NOT affect behavior).

Guidelines:
- Tone: Clear, beginner-friendly, helpful. Always offer concrete next steps based on the context.
- Placeholders: Gently remind users when necessary to use {{user}} instead of hardcoded names.
- Moderation: Zero moderation. Be strictly non-judgmental of all SFW/NSFW content.`;

/**
 * Think token for Gemma 4 models to enable reasoning
 */
export const GEMMA_THINK_TOKEN = '<|think|>';

/**
 * Check if the model is a Gemma 4 model
 */
export function isGemma4Model(modelId?: string): boolean {
  return !!modelId && modelId.toLowerCase().includes('gemma-4');
}

/**
 * AI Service error types
 */
export type AIErrorType = 
  | 'network' 
  | 'auth' 
  | 'rate_limit' 
  | 'invalid_request'
  | 'content_policy_violation'
  | 'server'
  | 'unknown';

/**
 * AI Service error
 */
export class AIError extends Error {
  type: AIErrorType;
  statusCode?: number;

  constructor(message: string, type: AIErrorType, statusCode?: number) {
    super(message);
    this.name = 'AIError';
    this.type = type;
    this.statusCode = statusCode;
  }
}

export interface ChatToolCall {
  id: string;
  type?: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ChatCompletionOptions {
  tools?: ChatToolDefinition[];
  /** Sets request max_tokens without changing input-budget math. */
  maxTokens?: number;
}

/**
 * OpenAI-compatible chat message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
  name?: string;
}

/**
 * OpenAI-compatible chat completion request body (first-attempt payload).
 */
export interface ChatCompletionRequestBody {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  min_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  stream?: boolean;
  max_tokens?: number;
  include_reasoning?: boolean;
  reasoning?: boolean | { enabled: boolean; effort?: ReasoningEffort };
  reasoning_effort?: ReasoningEffort;
  reasoning_split?: boolean;
  [key: string]: unknown;
}

/** @deprecated Use ChatCompletionRequestBody */
type ChatCompletionRequest = ChatCompletionRequestBody;

/**
 * Preflight preview of a toolbar operation request (no network).
 */
export interface AIRequestPreview {
  endpoint: string;
  method: 'POST';
  headers: Record<string, string>;
  body: ChatCompletionRequestBody;
  estimatedInputTokens: number;
}

/**
 * OpenAI-compatible chat completion response
 */
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * AI response with content and optional reasoning
 */
interface AIResponse {
  content: string;
  reasoning?: string;
  finishReason?: string | null;
  toolCalls?: NativeToolCall[];
}

/**
 * OpenAI-compatible streaming chunk
 * Note: NanoGPT uses 'reasoning' field, not 'reasoning_content' for default endpoint
 * Note: OpenRouter returns reasoning in choice.reasoning.content
 */
interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
      /** NanoGPT uses 'reasoning' field for default endpoint */
      reasoning?: string;
      /** Minimax uses 'reasoning_details' array with reasoning_split enabled */
      reasoning_details?: Array<{ type?: string; text?: string }>;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
    /** OpenRouter returns reasoning at choice level */
    reasoning?: {
      content?: string;
    };
  }>;
}

/**
 * AI Service class for handling AI API communication
 */
export class AIService {
  private config: AIConfig;
  private sampler: SamplerSettings;
  private prompts: PromptSettings;
  private abortController: AbortController | null = null;
  // Survives abort() nulling the controller so stream loops still observe cancel.
  private aborted = false;
  private streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  /**
   * Safety margin reserved for tokenizer variance, message framing, and
   * prompt wrappers not fully accounted for in the pre-budget step.
   * Kept in sync with `aiToolbarPanel` selection checks.
   */
  private static readonly SAFETY_MARGIN = 256;

  /** Per-message role/framing overhead when summing multi-message prompts. */
  private static readonly MESSAGE_OVERHEAD_TOKENS = 6;

  constructor(config: AIConfig, sampler: SamplerSettings, prompts?: PromptSettings) {
    this.config = config;
    this.sampler = sampler;
    // Merge provided prompts with defaults to ensure all properties are present
    this.prompts = prompts ? { ...DEFAULT_PROMPTS, ...prompts } : DEFAULT_PROMPTS;
  }

  /**
   * Estimate token count for a string.
   * @deprecated Use estimateTokens() function directly instead
   */
  public static estimateTokens(text: string): number {
    return estimateTokens(text);
  }

  /** Max tokens allowed for request input (context window minus max output and margin). */
  private getMaxInputTokens(sampler: SamplerSettings = this.sampler): number {
    return Math.max(0, sampler.contextLength - sampler.maxTokens - AIService.SAFETY_MARGIN);
  }

  private messageTokenText(message: ChatMessage): string {
    const parts: string[] = [];
    if (message.content) parts.push(message.content);
    if (message.tool_calls?.length) parts.push(JSON.stringify(message.tool_calls));
    if (message.tool_call_id) parts.push(message.tool_call_id);
    return parts.join('\n');
  }

  private estimateMessagesTokens(messages: ChatMessage[]): number {
    return messages.reduce(
      (sum, m) => sum + estimateTokens(this.messageTokenText(m)) + AIService.MESSAGE_OVERHEAD_TOKENS,
      0
    );
  }

  /** Truncate context entries to fit within available tokens (partial last chunk OK). */
  private fitContextToLimit(context: string[], availableTokens: number): string[] {
    return fitContextChunks(context, availableTokens);
  }

  /** Truncate a string to an estimated token budget. */
  private truncateTextToLimit(text: string, availableTokens: number): string {
    return truncateTextToTokenLimit(text, availableTokens);
  }

  /**
   * Last-line defense before send: if assembled messages still exceed the input
   * budget, shrink in this order so the active user turn is preserved longest:
   * 1) assistant history, 2) older user turns, 3) system/context, 4) latest user.
   */
  private enforceInputBudget(messages: ChatMessage[], maxInput: number): ChatMessage[] {
    const result = messages.map((m) => ({ ...m }));

    const totalTokens = () => this.estimateMessagesTokens(result);
    if (totalTokens() <= maxInput) return result;

    let lastUserIndex = -1;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    const indicesByPriority: number[] = [];
    // Oldest assistant first (drop early history before recent)
    for (let i = 0; i < result.length; i++) {
      if (result[i].role === 'assistant' || result[i].role === 'tool') indicesByPriority.push(i);
    }
    // Older user turns (not the latest)
    for (let i = 0; i < result.length; i++) {
      if (result[i].role === 'user' && i !== lastUserIndex) indicesByPriority.push(i);
    }
    // System / context block
    for (let i = 0; i < result.length; i++) {
      if (result[i].role === 'system') indicesByPriority.push(i);
    }
    // Last resort: active user message (editor selection / current question)
    if (lastUserIndex >= 0) indicesByPriority.push(lastUserIndex);

    for (const i of indicesByPriority) {
      const over = totalTokens() - maxInput;
      if (over <= 0) break;

      const text = result[i].content ?? '';
      const contentTokens = estimateTokens(text);
      if (contentTokens <= 0) continue;

      const keepTokens = Math.max(0, contentTokens - over);
      result[i] = {
        ...result[i],
        content: this.truncateTextToLimit(text, keepTokens),
      };
    }

    return result;
  }

  /**
   * Abort the current request if one is in progress
   */
  abort(): void {
    this.aborted = true;
    if (this.abortController) {
      this.abortController.abort();
      console.log('[AIService] Request aborted by user');
      this.abortController = null;
    }
    const reader = this.streamReader;
    this.streamReader = null;
    if (reader) {
      void reader.cancel().catch(() => undefined);
    }
  }

  dispose(): void {
    this.abort();
  }

  private isAborted(): boolean {
    return this.aborted || !!this.abortController?.signal.aborted;
  }

  /**
   * Update the service configuration
   */
  updateConfig(config: AIConfig): void {
    this.config = config;
  }

  /**
   * Update the sampler settings
   */
  updateSampler(sampler: SamplerSettings): void {
    this.sampler = sampler;
  }

  /**
   * Update the prompt settings
   */
  updatePrompts(prompts: PromptSettings): void {
    this.prompts = prompts;
  }

  /**
   * Get the think token for Gemma 4 models if applicable
   */
  private getThinkToken(): string {
    return isGemma4Model(this.config.modelId) ? `${GEMMA_THINK_TOKEN}\n` : '';
  }

  /**
   * Interpolate text into a prompt template
   * Replaces ${text} placeholder with the actual text value
   */
  private interpolatePrompt(template: string, text: string): string {
    return template.replace(/\$\{text\}/g, text);
  }

  /**
   * Interpolate text and instruction into a prompt template
   * Replaces ${text} and ${instruction} placeholders with actual values
   * When text is empty, generates a prompt for creating new content
   */
  private interpolateInstructPrompt(template: string, text: string, instruction: string): string {
    if (!text || text.trim().length === 0) {
      // Generate a prompt for creating new content
      return `Please generate text based on the following instruction:

Instruction: ${instruction}

Provide only the generated text without any additional commentary.`;
    }
    return template
      .replace(/\$\{text\}/g, text)
      .replace(/\$\{instruction\}/g, instruction);
  }

  /**
   * Get the API base URL
   */
  private getBaseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, '');
  }

  /**
   * Check if the configured base URL points to the Minimax API.
   */
  private isMinimaxBaseUrl(): boolean {
    const baseUrl = this.getBaseUrl().toLowerCase();
    return baseUrl.includes('api.minimax.io');
  }

  /**
   * Detect the common OpenAI-compatible base URL mistake where `/v1` is omitted.
   */
  private getMissingV1Hint(): string | null {
    const baseUrl = this.getBaseUrl();

    try {
      const url = new URL(baseUrl);
      const normalizedPath = url.pathname.replace(/\/+$/, '');

      if (normalizedPath.endsWith('/v1')) {
        return null;
      }

      return `The API Base URL appears to be missing /v1. Use ${baseUrl}/v1 instead.`;
    } catch {
      return baseUrl.endsWith('/v1')
        ? null
        : `The API Base URL appears to be missing /v1. Use ${baseUrl}/v1 instead.`;
    }
  }

  /**
   * Append a targeted base URL hint when the configured endpoint looks incomplete.
   */
  private withBaseUrlHint(message: string): string {
    const missingV1Hint = this.getMissingV1Hint();
    return missingV1Hint ? `${message} ${missingV1Hint}` : message;
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    // Add provider-specific headers (e.g., X-Provider, X-Billing-Mode)
    const provider = resolveProvider(this.config.baseUrl);
    const providerHeaders = provider.getChatHeaders(this.config);
    Object.assign(headers, providerHeaders);

    return headers;
  }

  /**
   * Handle API errors
   */
  private handleError(error: unknown): never {
    if (error instanceof AIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        throw new AIError(
          this.withBaseUrlHint('Network error. Please check your connection.'),
          'network'
        );
      }
      throw new AIError(this.withBaseUrlHint(error.message), 'unknown');
    }

    throw new AIError(this.withBaseUrlHint('An unknown error occurred'), 'unknown');
  }

  /**
   * Fetch available models from the API
   * Delegates to the appropriate provider adapter
   */
  async fetchModels(options?: FetchModelsOptions): Promise<AIModelInfo[]> {
    try {
      const provider = resolveProvider(this.config.baseUrl);
      return await provider.fetchModels(this.getBaseUrl(), this.config.apiKey, options);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid API key') {
          throw new AIError('Invalid API key', 'auth', 401);
        }
        if (error.message === 'Rate limit exceeded') {
          throw new AIError('Rate limit exceeded', 'rate_limit', 429);
        }
        throw new AIError(this.withBaseUrlHint(error.message), 'server');
      }
      throw new AIError(this.withBaseUrlHint('An unknown error occurred'), 'unknown');
    }
  }

  /**
   * Fetch available providers for a specific model.
   * Delegates short-circuit logic to the resolved provider adapter:
   * - Non-supporting providers return immediately (no network call)
   * - Provider cache is checked before making an API call
   */
  async fetchModelProviders(modelId: string): Promise<ModelProviderInfo> {
    try {
      const provider = resolveProvider(this.config.baseUrl);

      if (!provider.maySupportProviderSelection(modelId)) {
        return {
          canonicalId: modelId,
          displayName: this.config.availableModels?.find((m) => m.id === modelId)?.name || modelId,
          supportsProviderSelection: false,
          defaultPrice: { inputPer1kTokens: 0, outputPer1kTokens: 0 },
          providers: [],
        };
      }

      return await provider.fetchModelProviders(this.getBaseUrl(), this.config.apiKey, modelId);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Rate limit exceeded') {
          throw new AIError('Rate limit exceeded', 'rate_limit', 429);
        }
        throw new AIError(this.withBaseUrlHint(error.message), 'server');
      }
      throw new AIError(this.withBaseUrlHint('An unknown error occurred'), 'unknown');
    }
  }

  /**
   * Build the first-attempt chat completion body (budget + sanitize + capability cache).
   * Shared by send path and preflight preview so they stay aligned.
   */
  private buildChatCompletionBody(
    messages: ChatMessage[],
    customSampler?: Partial<SamplerSettings>,
    stream = false,
    options?: ChatCompletionOptions
  ): ChatCompletionRequestBody {
    const sampler = { ...this.sampler, ...customSampler };
    const maxInput = this.getMaxInputTokens(sampler);
    const budgetedMessages = this.enforceInputBudget(messages, maxInput);

    const enableReasoning = !!this.config.enableReasoning;
    const effort: ReasoningEffort = this.config.reasoningEffort ?? 'medium';
    const baseUrl = this.getBaseUrl();
    const cache = getCapabilityCache(baseUrl, this.config.modelId);

    let request: ChatCompletionRequestBody = {
      model: this.config.modelId,
      messages: budgetedMessages,
      temperature: sampler.temperature,
      top_p: sampler.topP,
      min_p: sampler.minP,
      top_k: sampler.topK,
      repetition_penalty: sampler.repetitionPenalty,
      stream: !!stream,
      max_tokens: options?.maxTokens ?? sampler.maxTokens,
      include_reasoning: enableReasoning ? true : undefined,
      reasoning: enableReasoning
        ? { enabled: true, effort }
        : undefined,
      reasoning_effort: enableReasoning ? effort : undefined,
      reasoning_split: enableReasoning && this.isMinimaxBaseUrl() ? true : undefined,
    };

    if (options?.tools?.length && !cache.rejectedParams.has('tools')) {
      request.tools = options.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters ?? { type: 'object', properties: {} },
        },
      }));
      request.tool_choice = 'auto';
    }

    request = sanitizeSamplerParams(request, baseUrl) as ChatCompletionRequestBody;
    request = applyCapabilityCache(request, cache) as ChatCompletionRequestBody;
    if (cache.rejectedParams.has('tools')) {
      delete request.tools;
      delete request.tool_choice;
    }
    return request;
  }

  /**
   * Build system + user messages for a toolbar text operation (with token budget).
   */
  private buildOperationMessages(
    operation: AIOperation,
    text: string,
    context: string[],
    instruction?: string
  ): ChatMessage[] {
    const maxInput = this.sampler.contextLength - this.sampler.maxTokens - AIService.SAFETY_MARGIN;
    const systemPromptTemplate = this.getThinkToken() + getStablePrefixParts(EDITOR_PERSONA);

    let userPromptTemplate: string;
    if (operation === 'instruct') {
      if (!instruction) {
        throw new Error('No custom prompt provided');
      }
      userPromptTemplate = this.interpolateInstructPrompt(this.prompts.instruct, '', instruction);
    } else {
      userPromptTemplate = this.interpolatePrompt(this.prompts[operation], '');
    }

    const overhead = AIService.estimateTokens(systemPromptTemplate + userPromptTemplate);
    let available = maxInput - overhead;

    let truncatedText = text;
    const textTokens = AIService.estimateTokens(text);
    if (textTokens > available) {
      truncatedText = this.truncateTextToLimit(text, available);
      available = 0;
    } else {
      available -= textTokens;
    }

    const truncatedContext = this.fitContextToLimit(context, available);
    const systemPrompt = this.buildSystemPrompt(truncatedContext);
    const userPrompt =
      operation === 'instruct'
        ? this.interpolateInstructPrompt(this.prompts.instruct, truncatedText, instruction!)
        : this.interpolatePrompt(this.prompts[operation], truncatedText);

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  /**
   * Headers suitable for UI display (API key redacted).
   */
  private getRedactedHeaders(): Record<string, string> {
    const headers = this.getHeaders();
    if (headers.Authorization) {
      headers.Authorization = 'Bearer ***';
    }
    return headers;
  }

  /**
   * Preflight: build the exact first-attempt request for a toolbar operation (no network).
   */
  previewOperationRequest(
    operation: AIOperation,
    text: string,
    context: string[],
    options?: { instruction?: string; customSampler?: Partial<SamplerSettings> }
  ): AIRequestPreview {
    const messages = this.buildOperationMessages(
      operation,
      text,
      context,
      options?.instruction
    );
    const stream = !!this.config.enableStreaming;
    const body = this.buildChatCompletionBody(messages, options?.customSampler, stream);
    return {
      endpoint: `${this.getBaseUrl()}/chat/completions`,
      method: 'POST',
      headers: this.getRedactedHeaders(),
      body,
      estimatedInputTokens: this.estimateMessagesTokens(body.messages),
    };
  }

  /**
   * Make a chat completion request
   */
  private async chatCompletion(
    messages: ChatMessage[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void,
    options?: ChatCompletionOptions
  ): Promise<AIResponse> {
    const useStreaming = this.config.enableStreaming && onChunk;
    const request = this.buildChatCompletionBody(messages, customSampler, !!useStreaming, options);
    const cache = getCapabilityCache(this.getBaseUrl(), this.config.modelId);

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    console.log('[AIService] Sending request with model:', this.config.modelId);

    try {
      if (this.aborted) {
        throw new AIError('Request was cancelled', 'unknown');
      }
      let currentRequest = request;
      let response = await this.sendRequest(currentRequest, signal);

      for (let attempt = 0; attempt < 3; attempt++) {
        if (response.status !== 400) break;

        const errorText = await response.text().catch(() => '');
        console.warn(`[AIService] Attempt ${attempt + 1} failed with 400. Response body:`, errorText);
        let errorData: Record<string, unknown>;
        try { errorData = JSON.parse(errorText); } catch { errorData = {}; }

        const errorCode = (errorData.error as { code?: string } | undefined)?.code;
        if (errorCode === 'content_policy_violation') {
          throw new AIError(
            (errorData.error as { message?: string } | undefined)?.message || 'Content blocked by safety filters',
            'content_policy_violation',
            400
          );
        }

        const repaired = repairChatRequest(currentRequest as ChatRequestLike, errorData);
        if (repaired) {
          const supported = parseSupportedValues(
            (errorData.error as { message?: string } | undefined)?.message ||
              (typeof errorData.error === 'string' ? errorData.error : '') ||
              ''
          );
          if (supported) recordSupportedEfforts(cache, supported);
          recordRepairInCache(cache, repaired);

          const remapParts = Object.entries(repaired.remapped).map(
            ([k, v]) => `${k}=${v}`
          );
          if (remapParts.length > 0) {
            console.warn(
              `[AIService] Model "${this.config.modelId}" remapped parameters: ${remapParts.join(', ')}. Retrying...`
            );
          }
          if (repaired.removed.length > 0) {
            console.warn(
              `[AIService] Model "${this.config.modelId}" rejected parameters: ${repaired.removed.join(', ')}. ` +
                `Retrying without them...`
            );
          }

          if (this.isAborted()) {
            throw new AIError('Request was cancelled', 'unknown');
          }
          this.abortController = new AbortController();
          currentRequest = repaired.request as ChatCompletionRequest;
          response = await this.sendRequest(currentRequest, this.abortController.signal);
          continue;
        }

        const fallback = stripAllNonStandardParams(currentRequest as ChatRequestLike);
        if (fallback.removed.length > 0) {
          recordRepairInCache(cache, fallback);
          console.warn(
            `[AIService] Generic 400 error. Proactively stripping non-standard params: ${fallback.removed.join(', ')}. ` +
              `Retrying without them...`
          );
          if (this.isAborted()) {
            throw new AIError('Request was cancelled', 'unknown');
          }
          this.abortController = new AbortController();
          currentRequest = fallback.request as ChatCompletionRequest;
          response = await this.sendRequest(currentRequest, this.abortController.signal);
          continue;
        }

        console.error('[AIService] No request repair match. Throwing invalid_request.');
        throw new AIError(
          (errorData.error as { message?: string } | undefined)?.message || 'Invalid request',
          'invalid_request',
          400
        );
      }

      if (response.status === 400) {
        const errorText = await response.text().catch(() => '');
        console.error('[AIService] Final 400 after retries. Response body:', errorText);
        let errorData: Record<string, unknown>;
        try { errorData = JSON.parse(errorText); } catch { errorData = {}; }
        throw new AIError(
          (errorData.error as { message?: string } | undefined)?.message || 'Invalid request',
          'invalid_request',
          400
        );
      }

      return await this.handleResponse(response, !!useStreaming, onChunk);
    } catch (error) {
      if (error instanceof AIError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[AIService] Request aborted - operation cancelled by user');
        throw new AIError('Request was cancelled', 'unknown');
      }
      this.handleError(error);
    } finally {
      this.abortController = null;
    }
  }

  private async sendRequest(request: ChatCompletionRequest, signal: AbortSignal): Promise<Response> {
    return fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
      signal,
    });
  }

  private async handleResponse(
    response: Response,
    useStreaming: boolean,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    if (!response.ok) {
      if (response.status === 401) {
        throw new AIError('Invalid API key', 'auth', 401);
      }
      if (response.status === 429) {
        throw new AIError('Rate limit exceeded', 'rate_limit', 429);
      }
      let errorMessage = response.statusText || `HTTP ${response.status}`;
      try {
        const errorData = await response.json().catch(() => null);
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If we can't parse JSON, use the status text we already have
      }
      throw new AIError(
        this.withBaseUrlHint(`API error: ${errorMessage}`),
        'server',
        response.status
      );
    }

    if (useStreaming && response.body) {
      return await this.handleStreamingResponse(response.body, onChunk!);
    }

    const data = await response.json() as ChatCompletionResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new AIError('No response from AI', 'unknown');
    }

    const choice = data.choices[0];
    const message = choice.message;

    return {
      content: message.content ?? '',
      reasoning: extractMessageReasoning(
        message as {
          content?: string;
          reasoning_content?: string;
          reasoning?: string;
          reasoning_details?: Array<{ type?: string; text?: string }>;
        }
      ),
      finishReason: choice.finish_reason ?? null,
      toolCalls: normalizeMessageToolCalls(message.tool_calls),
    };
  }

  /**
   * Handle streaming response from the API
   */
  private async handleStreamingResponse(
    body: ReadableStream<Uint8Array>,
    onChunk: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    const reader = body.getReader();
    this.streamReader = reader;
    const decoder = new TextDecoder();
    const parser = new ReasoningParser();
    const toolCallAcc: NativeToolCall[] = [];
    let finishReason: string | null = null;
    let doneSentinel = false;
    let pendingLine = '';

    const emitDeltas = (contentDelta?: string, reasoningDelta?: string) => {
      if (contentDelta || reasoningDelta) {
        onChunk({
          content: contentDelta || undefined,
          reasoning: reasoningDelta || undefined,
        });
      }
    };

    try {
      while (true) {
        if (this.isAborted()) {
          console.log('[AIService] Streaming aborted');
          throw new AIError('Request was cancelled', 'unknown');
        }

        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // A network chunk can split an SSE line, so keep the trailing fragment
        // until the newline arrives; `[DONE]` must survive chunk boundaries.
        pendingLine += decoder.decode(value, { stream: true });
        const lines = pendingLine.split('\n');
        pendingLine = lines.pop() ?? '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim() === '') {
            continue;
          }

          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            // The sentinel ends the response even when the server keeps the
            // socket open (keep-alive comments / half-close); break out so
            // the in-flight closure and host caches can be released.
            if (data === '[DONE]') {
              doneSentinel = true;
              break;
            }

            try {
              const parsedChunk = JSON.parse(data) as ChatCompletionChunk;
              const parsed = parser.parseChunk(parsedChunk, this.config.modelId);
              emitDeltas(parsed.contentDelta, parsed.reasoningDelta);
              const choice = parsedChunk.choices?.[0];
              if (choice?.delta?.tool_calls?.length) {
                applyToolCallDeltas(toolCallAcc, choice.delta.tool_calls);
              }
              if (choice?.finish_reason) finishReason = choice.finish_reason;
            } catch (e) {
              console.warn('[AIService] Failed to parse streaming chunk:', e);
              console.warn('[AIService] Problematic line:', line.slice(0, 200));
            }
          }
        }

        if (doneSentinel) {
          break;
        }
      }

      const flushed = parser.flush();
      emitDeltas(flushed.contentDelta, flushed.reasoningDelta);

      return {
        content: flushed.content,
        reasoning: flushed.reasoning || undefined,
        finishReason,
        toolCalls: finalizeToolCalls(toolCallAcc),
      };
    } catch (error) {
      if (this.isAborted() || (error instanceof Error && error.name === 'AbortError')) {
        throw new AIError('Request was cancelled', 'unknown');
      }
      throw error;
    } finally {
      if (this.streamReader === reader) {
        this.streamReader = null;
      }
      try {
        await reader.cancel();
      } catch {
        // already closed / cancelled
      }
      try {
        reader.releaseLock();
      } catch {
        // lock already released by cancel()
      }
      parser.reset();
    }
  }

  /**
   * Expand selected text
   */
  async expandText(
    text: string,
    context: string[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    return this.chatCompletion(
      this.buildOperationMessages('expand', text, context),
      customSampler,
      onChunk
    );
  }

  /**
   * Rewrite selected text
   */
  async rewriteText(
    text: string,
    context: string[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    return this.chatCompletion(
      this.buildOperationMessages('rewrite', text, context),
      customSampler,
      onChunk
    );
  }

  /**
   * Apply custom instruction to selected text
   */
  async instructText(
    text: string,
    instruction: string,
    context: string[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    return this.chatCompletion(
      this.buildOperationMessages('instruct', text, context, instruction),
      customSampler,
      onChunk
    );
  }

  /**
   * Shorten selected text
   */
  async shortenText(
    text: string,
    context: string[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    return this.chatCompletion(
      this.buildOperationMessages('shorten', text, context),
      customSampler,
      onChunk
    );
  }

  /**
   * Lengthen selected text
   */
  async lengthenText(
    text: string,
    context: string[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    return this.chatCompletion(
      this.buildOperationMessages('lengthen', text, context),
      customSampler,
      onChunk
    );
  }

  /**
   * Make text more vivid and descriptive
   */
  async makeVivid(
    text: string,
    context: string[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    return this.chatCompletion(
      this.buildOperationMessages('vivid', text, context),
      customSampler,
      onChunk
    );
  }

  /**
   * Add emotional depth to text
   */
  async addEmotion(
    text: string,
    context: string[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    return this.chatCompletion(
      this.buildOperationMessages('emotion', text, context),
      customSampler,
      onChunk
    );
  }

  /**
   * Fix grammar in text
   */
  async fixGrammar(
    text: string,
    context: string[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    return this.chatCompletion(
      this.buildOperationMessages('grammar', text, context),
      customSampler,
      onChunk
    );
  }

  /**
   * Ask AI with conversation history for follow-up questions
   */
  async askAIWithConversation(
    question: string,
    context: string[],
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    const maxInput = this.sampler.contextLength - this.sampler.maxTokens - AIService.SAFETY_MARGIN;
    
    // 1. Calculate base overhead (system prompt without context + question)
    const baseSystemPrompt = getStablePrefixParts(DEFAULT_ASK_PROMPT);
    const questionTokens = AIService.estimateTokens(question);
    const baseSystemTokens = AIService.estimateTokens(baseSystemPrompt);
    const fixedOverhead = baseSystemTokens + questionTokens;
    
    let availableTokens = maxInput - fixedOverhead;
    
    // 2. Prioritize context entries
    const truncatedContext = this.fitContextToLimit(context, availableTokens);
    const contextTokens = truncatedContext.reduce((acc, ctx) => acc + AIService.estimateTokens(ctx) + 5, 0);
    availableTokens -= contextTokens;
    
    // 3. Fill remaining space with history (newest first)
    const includedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      const msgTokens = AIService.estimateTokens(msg.content) + 10; // +10 for metadata/role overhead
      if (availableTokens >= msgTokens) {
        includedHistory.unshift(msg);
        availableTokens -= msgTokens;
      } else {
        break;
      }
    }

    // 4. Build final system prompt with truncated context
    const systemPrompt = this.getThinkToken() + buildSystemPromptParts(DEFAULT_ASK_PROMPT, truncatedContext);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add history
    includedHistory.forEach(msg => {
      messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
    });

    // Add current question
    messages.push({
      role: 'user',
      content: question
    });

    return this.chatCompletion(messages, customSampler, onChunk);
  }

  /**
   * Build system prompt from context entries
   */
  private buildSystemPrompt(context: string[]): string {
    return this.getThinkToken() + buildSystemPromptParts(EDITOR_PERSONA, context);
  }

  /**
   * Make a chat completion request with custom messages
   * Public wrapper around chatCompletion for custom prompt generation
   */
  async chat(
    messages: ChatMessage[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void,
    options?: ChatCompletionOptions
  ): Promise<AIResponse> {
    return this.chatCompletion(messages, customSampler, onChunk, options);
  }

  /**
   * Check if the service is configured and ready
   */
  isReady(): boolean {
    return !!(
      this.config.apiKey &&
      this.config.baseUrl &&
      this.config.modelId
    );
  }
}

/**
 * Create an AI service instance
 */
export function createAIService(
  config: AIConfig,
  sampler: SamplerSettings,
  prompts?: PromptSettings
): AIService {
  return new AIService(config, sampler, prompts);
}
