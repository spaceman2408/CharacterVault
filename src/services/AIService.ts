/**
 * @fileoverview AI Service for handling AI API communication.
 * Supports OpenAI-compatible APIs (NanoGPT, etc.)
 * @module @services/AIService
 */

import type { AIConfig, SamplerSettings, AIModelInfo, PromptSettings } from '../db/types';
import { ReasoningParser } from './ReasoningParser';

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
 * This is the persona for Zoggy, the chat assistant for CharacterVault
 */
export const DEFAULT_ASK_PROMPT = `You are Zoggy, a friendly and knowledgeable assistant built into CharacterVault.

# Your Role
You help users create, edit, and understand character cards for roleplay tools like SillyTavern. You answer questions about character card creation, best practices, and how to use CharacterVault's features.

# CharacterVault Features
Users can:
- Upload character cards (JSON or PNG) in v2 or v3 spec format
- Edit cards section by section OR create new cards from scratch
- Export finished cards as JSON or PNG (via top-right corner export)
- Add specific sections to context so you can see and help with their card content

# Available Editing Sections

## Core Character Sections:
- Image, Name, Description, Personality, Scenario, First Message, Examples, System Prompt, Post-History, Greetings, Appearance, Extensions
  - **Note**: Modern cards typically use Description for all character info. Personality/Appearance exist for legacy compatibility. NEVER suggest using them.

## Lorebook:
- Basic editing suite (entry name, trigger keys, priority, position, enabled, case sensitive, constant, content editor)
- Fine-tuning requires SillyTavern or similar tools

## Metadata (doesn't affect character behavior):
- Avatar URL (for Character Hub/Chub), Creator Notes, Creator, Version, Tags

# Your Approach
- Helpful and encouraging, especially for beginners
- Clear, concise explanations with minimal jargon (unless user shows familiarity)
- Non-judgmental about all content types (SFW to NSFW) - you're here to help with quality and functionality, not moderate content
- When users ask about adding themselves to cards, remind them to use {{user}} as the placeholder, not a hardcoded name
- If users ask vague questions about "their card" or need specific help, gently suggest adding relevant sections to context to the **Ai Context** panel (Left Side) so you can provide better assistance
- Offer concrete next steps when users seem stuck
- Explain section purposes and best practices when relevant`;

/**
 * AI Service error types
 */
export type AIErrorType = 
  | 'network' 
  | 'auth' 
  | 'rate_limit' 
  | 'invalid_request' 
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
  /** Enable reasoning/thinking mode for supported models (DeepSeek, etc.) */
  include_reasoning?: boolean;
  /** OpenRouter reasoning parameter - can be boolean or { enabled: boolean } */
  reasoning?: boolean | { enabled: boolean };
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
    };
    finish_reason: string | null;
    /** OpenRouter returns reasoning at choice level */
    reasoning?: {
      content?: string;
    };
  }>;
}

/**
 * OpenAI-compatible models list response
 */
interface ModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
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
   * Uses heuristic: 1 token ≈ 4 characters
   */
  public static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
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
   * Interpolate text into a prompt template
   * Replaces ${text} placeholder with the actual text value
   */
  private interpolatePrompt(template: string, text: string): string {
    return template.replace(/\$\{text\}/g, text);
  }

  /**
   * Interpolate text and instruction into a prompt template
   * Replaces ${text} and ${instruction} placeholders with actual values
   */
  private interpolateInstructPrompt(template: string, text: string, instruction: string): string {
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
   * Get headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

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
        throw new AIError('Network error. Please check your connection.', 'network');
      }
      throw new AIError(error.message, 'unknown');
    }

    throw new AIError('An unknown error occurred', 'unknown');
  }

  /**
   * Fetch available models from the API
   */
  async fetchModels(): Promise<AIModelInfo[]> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/models`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AIError('Invalid API key', 'auth', 401);
        }
        if (response.status === 429) {
          throw new AIError('Rate limit exceeded', 'rate_limit', 429);
        }
        throw new AIError(
          `Failed to fetch models: ${response.statusText}`,
          'server',
          response.status
        );
      }

      const data = await response.json() as ModelsResponse;
      
      const models = data.data.map(model => ({
        id: model.id,
        name: this.formatModelName(model.id),
      }));
      
      // Sort models alphabetically by name
      return models.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Format model ID to a readable name
   */
  private formatModelName(modelId: string): string {
    // Remove provider prefixes and format
    const name = modelId
      .replace(/^(openai|anthropic|google|meta|mistral)\//, '')
      .replace(/-/g, ' ')
      .replace(/_/g, ' ');
    
    // Capitalize words
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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

    // Create new abort controller for this request
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
      // Support both formats:
      // - include_reasoning for DeepSeek and other APIs
      // - reasoning for OpenRouter format
      include_reasoning: this.config.enableReasoning ?? false,
      reasoning: this.config.enableReasoning ? { enabled: true } : { enabled: false },
    };

    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AIError('Invalid API key', 'auth', 401);
        }
        if (response.status === 429) {
          throw new AIError('Rate limit exceeded', 'rate_limit', 429);
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new AIError(
            errorData.error?.message || 'Invalid request',
            'invalid_request',
            400
          );
        }
        // Try to get error message from response body for other errors
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
          `API error: ${errorMessage}`,
          'server',
          response.status
        );
      }

      // Handle streaming response
      if (useStreaming && response.body) {
        return await this.handleStreamingResponse(response.body, onChunk!);
      }

      // Handle non-streaming response
      const data = await response.json() as ChatCompletionResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new AIError('No response from AI', 'unknown');
      }

      // Extract reasoning from non-streaming response if available
      const choice = data.choices[0];
      const message = choice.message;
      
      // Check for reasoning in message (some APIs include it here)
      const reasoningContent = (message as unknown as { reasoning_content?: string }).reasoning_content;
      const reasoning = (message as unknown as { reasoning?: string }).reasoning;
      
      return { 
        content: message.content,
        reasoning: reasoningContent ?? reasoning ?? undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[AIService] Request aborted - operation cancelled by user');
        throw new AIError('Request was cancelled', 'unknown');
      }
      this.handleError(error);
    } finally {
      this.abortController = null;
    }
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
    const systemPromptTemplate = this.buildSystemPrompt([]); // Base overhead
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
    const systemPromptTemplate = this.buildSystemPrompt([]);
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
    const systemPromptTemplate = this.buildSystemPrompt([]);
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
    const systemPromptTemplate = this.buildSystemPrompt([]);
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
    const systemPromptTemplate = this.buildSystemPrompt([]);
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
    const systemPromptTemplate = this.buildSystemPrompt([]);
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
    const systemPromptTemplate = this.buildSystemPrompt([]);
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
    const systemPromptTemplate = this.buildSystemPrompt([]);
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
    const baseSystemPrompt = DEFAULT_ASK_PROMPT;
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
    let systemPrompt = baseSystemPrompt;
    if (truncatedContext.length > 0) {
      const contextSection = truncatedContext
        .map((ctx, index) => `--- Context Entry ${index + 1} ---\n${ctx}`)
        .join('\n\n');
      systemPrompt += `\n\nUse the following context entries to inform your responses:\n\n${contextSection}`;
    }

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
    const basePrompt = `You are a helpful AI assistant for a character editing application called CharacterVault. You help users create and edit character cards for roleplay programs.`;

    if (context.length === 0) {
      return basePrompt;
    }

    const contextSection = context
      .map((ctx, index) => `--- Context Entry ${index + 1} ---\n${ctx}`)
      .join('\n\n');

    return `${basePrompt}\n\nUse the following context entries to inform your responses:\n\n${contextSection}`;
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
