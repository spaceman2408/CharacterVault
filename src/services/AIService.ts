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
} from '../db/characterTypes';
import { ReasoningParser } from './ReasoningParser';
import { resolveProvider } from './providers';
import type { ModelProviderInfo, FetchModelsOptions } from './providers';
import { EDITOR_PERSONA, buildSystemPrompt as buildSystemPromptParts, getStablePrefix as getStablePrefixParts } from './PromptBuilder';

/**
 * Bytes per token ratio for token estimation.
 * Empirically derived: 1 token ≈ 5 bytes (UTF-8)
 */
export const BYTES_PER_TOKEN = 5;

/**
 * Estimate token count for a string.
 * Uses heuristic: 1 token ≈ 5 bytes (UTF-8)
 * This handles non-ASCII text (CJK, emoji, etc.) more accurately than character count
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const byteLength = new TextEncoder().encode(text).length;
  return Math.ceil(byteLength / BYTES_PER_TOKEN);
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

/**
 * OpenAI-compatible chat message
 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI-compatible chat completion request
 */
interface ChatCompletionRequest {
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
  reasoning?: boolean | { enabled: boolean; effort?: 'low' | 'medium' | 'high' };
  reasoning_effort?: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

const NON_STANDARD_PARAMS = ['min_p', 'top_k', 'repetition_penalty', 'include_reasoning', 'reasoning', 'reasoning_effort', 'reasoning_split'] as const;

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
  /** Safety margin of tokens to reserve for overhead and varying token lengths */
  private static readonly SAFETY_MARGIN = 100;

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

  /**
   * Truncate context entries to fit within available tokens
   */
  private fitContextToLimit(context: string[], availableTokens: number): string[] {
    if (availableTokens <= 0) return [];
    
    const result: string[] = [];
    let currentTokens = 0;
    
    for (const ctx of context) {
      const tokens = AIService.estimateTokens(ctx) + 5; // +5 for separators/overhead
      if (currentTokens + tokens <= availableTokens) {
        result.push(ctx);
        currentTokens += tokens;
      } else {
        // Try to include a partial if it's the first one? No, let's just drop for now
        // since these are "context entries" (Lorebook etc.)
        break;
      }
    }
    
    return result;
  }

  /**
   * Truncate single text string to fit within available tokens from the end/start?
   * For single-turn ops, we usually want to truncate from the end if it's too long.
   */
  private truncateTextToLimit(text: string, availableTokens: number): string {
    if (availableTokens <= 0) return '...';
    const maxChars = availableTokens * 4;
    if (text.length <= maxChars) return text;
    
    // Truncate and add ellipsis
    return text.substring(0, Math.max(0, maxChars - 3)) + '...';
  }

  /**
   * Abort the current request if one is in progress
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      console.log('[AIService] Request aborted by user');
      this.abortController = null;
    }
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
   * Make a chat completion request
   */
  private async chatCompletion(
    messages: ChatMessage[],
    customSampler?: Partial<SamplerSettings>,
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    const sampler = { ...this.sampler, ...customSampler };
    const useStreaming = this.config.enableStreaming && onChunk;

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const request: ChatCompletionRequest = {
      model: this.config.modelId,
      messages,
      temperature: sampler.temperature,
      top_p: sampler.topP,
      min_p: sampler.minP,
      top_k: sampler.topK,
      repetition_penalty: sampler.repetitionPenalty,
      stream: !!useStreaming,
      max_tokens: sampler.maxTokens,
      include_reasoning: this.config.enableReasoning ?? false,
      reasoning: this.config.enableReasoning
        ? { enabled: true, effort: this.config.reasoningEffort ?? 'medium' }
        : { enabled: false },
      reasoning_effort: this.config.enableReasoning
        ? (this.config.reasoningEffort ?? 'medium')
        : undefined,
      // Minimax: send reasoning_split to separate thinking into reasoning_details field
      reasoning_split: this.config.enableReasoning && this.isMinimaxBaseUrl() ? true : undefined,
    };

    //DEBUG: Log request details for troubleshooting
    console.log('[AIService] Sending request with model:', this.config.modelId);
    //console.log('[AIService] Full request:', JSON.stringify(request, null, 2));

    try {
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

        const stripped = this.stripRejectedParams(currentRequest, errorData);
        if (stripped) {
          console.warn(
            `[AIService] Model "${this.config.modelId}" rejected parameters: ${stripped.removed.join(', ')}. ` +
            `Retrying without them...`
          );
          // console.log('[AIService] Retrying with cleaned request:', JSON.stringify(stripped.request, null, 2));
          this.abortController = new AbortController();
          currentRequest = stripped.request;
          response = await this.sendRequest(currentRequest, this.abortController.signal);
          continue;
        }

        // Fallback: if error message is generic or doesn't name params, strip all non-standard params proactively
        const fallbackStripped = this.stripAllNonStandardParams(currentRequest);
        if (fallbackStripped.removed.length > 0) {
          console.warn(
            `[AIService] Generic 400 error. Proactively stripping non-standard params: ${fallbackStripped.removed.join(', ')}. ` +
            `Retrying without them...`
          );
          // console.log('[AIService] Retrying with cleaned request:', JSON.stringify(fallbackStripped.request, null, 2));
          this.abortController = new AbortController();
          currentRequest = fallbackStripped.request;
          response = await this.sendRequest(currentRequest, this.abortController.signal);
          continue;
        }

        console.error('[AIService] No stripRejectedParams match. Throwing invalid_request.');
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

  private stripRejectedParams(
    request: ChatCompletionRequest,
    errorData: Record<string, unknown>
  ): { request: ChatCompletionRequest; removed: string[] } | null {
    const errorObj = errorData.error as Record<string, unknown> | undefined;
    const errorMsg = (errorObj?.message as string | undefined)
      || (errorData.message as string | undefined)
      || (typeof errorData.error === 'string' ? errorData.error : '')
      || '';
    const lowerMsg = errorMsg.toLowerCase();

    const removed: string[] = [];
    for (const param of NON_STANDARD_PARAMS) {
      if (lowerMsg.includes(param) && request[param] !== undefined) {
        removed.push(param);
      }
    }

    if (lowerMsg.includes('logit_bias') && request.logit_bias !== undefined) {
      removed.push('logit_bias');
    }

    if (removed.length === 0) return null;

    const cleaned = { ...request };
    for (const param of removed) {
      delete cleaned[param];
    }
    return { request: cleaned, removed };
  }

  private stripAllNonStandardParams(
    request: ChatCompletionRequest
  ): { request: ChatCompletionRequest; removed: string[] } {
    const removed: string[] = [];
    for (const param of NON_STANDARD_PARAMS) {
      if (request[param] !== undefined) {
        removed.push(param);
      }
    }
    if (request.logit_bias !== undefined) {
      removed.push('logit_bias');
    }

    if (removed.length === 0) return { request, removed };

    const cleaned = { ...request };
    for (const param of removed) {
      delete cleaned[param];
    }
    return { request: cleaned, removed };
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

    const reasoningContent = (message as unknown as { reasoning_content?: string }).reasoning_content;
    const reasoning = (message as unknown as { reasoning?: string }).reasoning;
    const reasoningDetails = (message as unknown as { reasoning_details?: Array<{ type?: string; text?: string }> }).reasoning_details;
    const reasoningDetailsText = reasoningDetails
      ?.map(d => d.text ?? '')
      .filter(t => t.length > 0)
      .join('') ?? undefined;

    return {
      content: message.content,
      reasoning: reasoningContent ?? reasoning ?? reasoningDetailsText ?? undefined,
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
    const decoder = new TextDecoder();
    let fullContent = '';
    let fullReasoning = '';
    const parser = new ReasoningParser();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Check if we were aborted during streaming
        if (this.abortController?.signal.aborted) {
          console.log('[AIService] Streaming aborted');
          throw new AIError('Request was cancelled', 'unknown');
        }

        const rawChunk = decoder.decode(value, { stream: true });

        const lines = rawChunk.split('\n').filter(line => line.trim() !== '');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsedChunk = JSON.parse(data) as ChatCompletionChunk;

              const parsed = parser.parseChunk(parsedChunk, this.config.modelId);

              const content = parsed.content;
              const reasoning = parsed.reasoning;

              if (content !== fullContent || reasoning !== fullReasoning) {
                const contentDelta = content.slice(fullContent.length);
                const reasoningDelta = reasoning.slice(fullReasoning.length);

                fullContent = content;
                fullReasoning = reasoning;

                if (contentDelta || reasoningDelta) {
                  onChunk({ content: contentDelta || undefined, reasoning: reasoningDelta || undefined });
                }
              }
            } catch (e) {
              console.warn('[AIService] Failed to parse streaming chunk:', e);
              console.warn('[AIService] Problematic line:', line.slice(0, 200));
            }
          }
        }
      }

      // Flush any remaining buffer content from the parser
      const flushed = parser.flush();

      // Check if flush added new content
      if (flushed.content.length > fullContent.length) {
        const contentDelta = flushed.content.slice(fullContent.length);
        fullContent = flushed.content;
        onChunk({ content: contentDelta });
      }

      if (flushed.reasoning.length > fullReasoning.length) {
        const reasoningDelta = flushed.reasoning.slice(fullReasoning.length);
        fullReasoning = flushed.reasoning;
        onChunk({ reasoning: reasoningDelta });
      }

      return { content: fullContent, reasoning: fullReasoning || undefined };
    } finally {
      reader.releaseLock();
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
    const maxInput = this.sampler.contextLength - this.sampler.maxTokens - AIService.SAFETY_MARGIN;
    const systemPromptTemplate = this.getThinkToken() + getStablePrefixParts(EDITOR_PERSONA); // Base overhead
    const userPromptTemplate = this.interpolatePrompt(this.prompts.expand, ''); // Base overhead
    const overhead = AIService.estimateTokens(systemPromptTemplate + userPromptTemplate);
    
    let available = maxInput - overhead;
    
    // Prioritize text
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
    const userPrompt = this.interpolatePrompt(this.prompts.expand, truncatedText);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.chatCompletion(messages, customSampler, onChunk);
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
    const maxInput = this.sampler.contextLength - this.sampler.maxTokens - AIService.SAFETY_MARGIN;
    const systemPromptTemplate = this.getThinkToken() + getStablePrefixParts(EDITOR_PERSONA);
    const userPromptTemplate = this.interpolatePrompt(this.prompts.rewrite, '');
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
    const userPrompt = this.interpolatePrompt(this.prompts.rewrite, truncatedText);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.chatCompletion(messages, customSampler, onChunk);
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
    const maxInput = this.sampler.contextLength - this.sampler.maxTokens - AIService.SAFETY_MARGIN;
    const systemPromptTemplate = this.getThinkToken() + getStablePrefixParts(EDITOR_PERSONA);
    const userPromptTemplate = this.interpolateInstructPrompt(this.prompts.instruct, '', instruction);
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
    const userPrompt = this.interpolateInstructPrompt(this.prompts.instruct, truncatedText, instruction);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.chatCompletion(messages, customSampler, onChunk);
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
    const maxInput = this.sampler.contextLength - this.sampler.maxTokens - AIService.SAFETY_MARGIN;
    const systemPromptTemplate = this.getThinkToken() + getStablePrefixParts(EDITOR_PERSONA);
    const userPromptTemplate = this.interpolatePrompt(this.prompts.shorten, '');
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
    const userPrompt = this.interpolatePrompt(this.prompts.shorten, truncatedText);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.chatCompletion(messages, customSampler, onChunk);
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
    const maxInput = this.sampler.contextLength - this.sampler.maxTokens - AIService.SAFETY_MARGIN;
    const systemPromptTemplate = this.getThinkToken() + getStablePrefixParts(EDITOR_PERSONA);
    const userPromptTemplate = this.interpolatePrompt(this.prompts.lengthen, '');
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
    const userPrompt = this.interpolatePrompt(this.prompts.lengthen, truncatedText);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.chatCompletion(messages, customSampler, onChunk);
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
    const maxInput = this.sampler.contextLength - this.sampler.maxTokens - AIService.SAFETY_MARGIN;
    const systemPromptTemplate = this.getThinkToken() + getStablePrefixParts(EDITOR_PERSONA);
    const userPromptTemplate = this.interpolatePrompt(this.prompts.vivid, '');
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
    const userPrompt = this.interpolatePrompt(this.prompts.vivid, truncatedText);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.chatCompletion(messages, customSampler, onChunk);
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
    const maxInput = this.sampler.contextLength - this.sampler.maxTokens - AIService.SAFETY_MARGIN;
    const systemPromptTemplate = this.getThinkToken() + getStablePrefixParts(EDITOR_PERSONA);
    const userPromptTemplate = this.interpolatePrompt(this.prompts.emotion, '');
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
    const userPrompt = this.interpolatePrompt(this.prompts.emotion, truncatedText);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.chatCompletion(messages, customSampler, onChunk);
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
    const maxInput = this.sampler.contextLength - this.sampler.maxTokens - AIService.SAFETY_MARGIN;
    const systemPromptTemplate = this.getThinkToken() + getStablePrefixParts(EDITOR_PERSONA);
    const userPromptTemplate = this.interpolatePrompt(this.prompts.grammar, '');
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
    const userPrompt = this.interpolatePrompt(this.prompts.grammar, truncatedText);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.chatCompletion(messages, customSampler, onChunk);
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
    onChunk?: (chunk: { content?: string; reasoning?: string }) => void
  ): Promise<AIResponse> {
    return this.chatCompletion(messages, customSampler, onChunk);
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
