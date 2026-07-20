/**
 * @fileoverview Custom hook for managing AI chat operations.
 * @module components/ai/hooks/useAIChat
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { AIService, AIError, estimateTokens } from '../../../services/AIService';
import { getProviderSelectionId } from '../../../services/providers';
import type { AIConfig, SamplerSettings, PromptSettings } from '../../../db/characterTypes';
import type { ChatMessage, ConversationMessage } from '../types';
import { generateMessageId } from '../utils';

/**
 * Soft cap on messages retained in React state (sliding window).
 * Bounds permanent heap without a persistence layer. Older turns are dropped.
 */
export const MAX_CHAT_MESSAGES = 80;

/**
 * Configuration for AI chat operations
 */
export interface UseAIChatOptions {
  /** AI configuration */
  aiConfig: AIConfig;
  /** Sampler settings */
  samplerSettings: SamplerSettings;
  /** Prompt settings */
  promptSettings: PromptSettings;
  /** Whether streaming is enabled */
  enableStreaming: boolean;
  /** Whether to show reasoning */
  showReasoning: boolean;
  /** Function to resolve context entry IDs to content (at ask time only) */
  getContextContent?: (entryIds: string[]) => Promise<string[]>;
  /** Context entry IDs (resolved at call time; not cached in React state) */
  contextEntryIds: string[];
}

/**
 * Return interface for the useAIChat hook
 */
export interface UseAIChatReturn {
  /** Chat message history */
  chatHistory: ChatMessage[];
  /** Whether an AI request is being processed */
  isProcessing: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Whether streaming is active */
  isStreaming: boolean;
  /**
   * In-flight assistant content (single live copy). Cleared when the turn
   * is committed to chatHistory or aborted without a partial.
   */
  streamingContent: string;
  /** In-flight reasoning text (single live copy). */
  streamingReasoning: string;
  /** Handle asking a question */
  handleAsk: (question: string) => Promise<void>;
  /** Handle regenerating the last response */
  handleRegenerate: () => Promise<void>;
  /** Handle starting a new chat (clears history) */
  handleNewChat: () => void;
  /** Delete a message and everything after it (rewind) */
  handleDeleteMessage: (messageId: string) => void;
  /** Handle aborting the current request */
  handleAbort: () => void;
  /** Clear the current error */
  clearError: () => void;
  /** Whether AI is properly configured */
  isAIConfigured: boolean;
}

function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_CHAT_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_CHAT_MESSAGES);
}

async function resolveContextAtCallTime(
  getContextContent: ((entryIds: string[]) => Promise<string[]>) | undefined,
  contextEntryIds: string[]
): Promise<string[]> {
  if (!getContextContent || contextEntryIds.length === 0) {
    return [];
  }
  try {
    return await getContextContent(contextEntryIds);
  } catch {
    return [];
  }
}

function isRequestCancelled(err: unknown): boolean {
  return err instanceof AIError && err.message === 'Request was cancelled';
}

function buildPartialAssistantMessage(
  content: string,
  reasoning: string,
  options: {
    enableStreaming: boolean;
    modelId: string;
    providerId: string | undefined;
    ttft?: number;
  }
): ChatMessage | null {
  if (!content && !reasoning) return null;

  return {
    id: generateMessageId(),
    role: 'assistant',
    content,
    reasoning: reasoning || undefined,
    timestamp: Date.now(),
    stats: {
      ttft: options.ttft,
      modelId: options.modelId,
      providerId: options.providerId,
    },
    suppressInitialAnimation: options.enableStreaming,
  };
}

function buildAssistantMessage(
  content: string,
  reasoning: string | undefined,
  options: {
    enableStreaming: boolean;
    modelId: string;
    providerId: string | undefined;
    ttft?: number;
    tokensPerSecond?: number;
  }
): ChatMessage {
  return {
    id: generateMessageId(),
    role: 'assistant',
    content,
    reasoning,
    timestamp: Date.now(),
    stats: {
      ttft: options.ttft,
      tokensPerSecond: options.tokensPerSecond,
      modelId: options.modelId,
      providerId: options.providerId,
    },
    suppressInitialAnimation: options.enableStreaming,
  };
}

/**
 * Hook that manages AI chat operations including conversation history,
 * streaming, and error handling.
 *
 * In-flight replies use one draft buffer (refs + rAF-flushed state). On
 * success/cancel the draft is committed into chatHistory and cleared.
 *
 * Handlers read history via refs so their identities stay stable across turns
 * (avoids re-rendering every ChatMessage and rebuilding markdown trees).
 */
export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const {
    aiConfig,
    samplerSettings,
    promptSettings,
    enableStreaming,
    getContextContent,
    contextEntryIds,
  } = options;

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');

  const aiServiceRef = useRef<AIService | null>(null);
  const streamContentRef = useRef('');
  const streamReasoningRef = useRef('');
  const streamRafRef = useRef<number | null>(null);
  const streamDirtyRef = useRef(false);

  // Latest values for stable async handlers (do not put these in useCallback deps)
  const chatHistoryRef = useRef(chatHistory);
  const isProcessingRef = useRef(isProcessing);
  const aiConfigRef = useRef(aiConfig);
  const samplerSettingsRef = useRef(samplerSettings);
  const promptSettingsRef = useRef(promptSettings);
  const enableStreamingRef = useRef(enableStreaming);
  const getContextContentRef = useRef(getContextContent);
  const contextEntryIdsRef = useRef(contextEntryIds);

  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);
  useEffect(() => {
    aiConfigRef.current = aiConfig;
  }, [aiConfig]);
  useEffect(() => {
    samplerSettingsRef.current = samplerSettings;
  }, [samplerSettings]);
  useEffect(() => {
    promptSettingsRef.current = promptSettings;
  }, [promptSettings]);
  useEffect(() => {
    enableStreamingRef.current = enableStreaming;
  }, [enableStreaming]);
  useEffect(() => {
    getContextContentRef.current = getContextContent;
  }, [getContextContent]);
  useEffect(() => {
    contextEntryIdsRef.current = contextEntryIds;
  }, [contextEntryIds]);

  const isAIConfigured = useMemo(() => {
    return typeof aiConfig.modelId === 'string' && aiConfig.modelId.trim().length > 0;
  }, [aiConfig.modelId]);

  const cancelStreamRaf = useCallback(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    streamDirtyRef.current = false;
  }, []);

  const flushStreamToState = useCallback(() => {
    streamRafRef.current = null;
    if (!streamDirtyRef.current) return;
    streamDirtyRef.current = false;
    // Single setState pair per frame — not per network chunk
    setStreamingContent(streamContentRef.current);
    setStreamingReasoning(streamReasoningRef.current);
  }, []);

  const clearStreamDraft = useCallback(() => {
    cancelStreamRaf();
    streamContentRef.current = '';
    streamReasoningRef.current = '';
    setStreamingContent('');
    setStreamingReasoning('');
  }, [cancelStreamRaf]);

  const appendStreamChunk = useCallback(
    (chunk: { content?: string; reasoning?: string }) => {
      let changed = false;
      if (chunk.reasoning) {
        streamReasoningRef.current += chunk.reasoning;
        changed = true;
      }
      if (chunk.content) {
        streamContentRef.current += chunk.content;
        changed = true;
      }
      if (!changed) return;

      streamDirtyRef.current = true;
      if (streamRafRef.current === null) {
        streamRafRef.current = requestAnimationFrame(flushStreamToState);
      }
    },
    [flushStreamToState]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleAbort = useCallback(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.abort();
    }
  }, []);

  const handleNewChat = useCallback(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.abort();
      aiServiceRef.current = null;
    }
    setChatHistory([]);
    setError(null);
    setIsProcessing(false);
    setIsStreaming(false);
    clearStreamDraft();
  }, [clearStreamDraft]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    if (isProcessingRef.current) return;

    setChatHistory(prev => {
      const index = prev.findIndex(m => m.id === messageId);
      if (index === -1) return prev;
      return prev.slice(0, index);
    });
    setError(null);
  }, []);

  const finishTurn = useCallback(() => {
    clearStreamDraft();
    setIsProcessing(false);
    setIsStreaming(false);
    aiServiceRef.current = null;
  }, [clearStreamDraft]);

  const runAssistantTurn = useCallback(
    async (args: {
      question: string;
      historyForContext: ChatMessage[];
      historyToKeep: ChatMessage[];
    }) => {
      const { question, historyForContext, historyToKeep } = args;
      const config = aiConfigRef.current;
      const streaming = enableStreamingRef.current;

      setIsProcessing(true);
      setError(null);
      clearStreamDraft();

      await new Promise(resolve => setTimeout(resolve, 600));

      setIsStreaming(streaming);

      const requestStartTime = Date.now();
      let firstTokenTime: number | null = null;
      let contextArray: string[] = [];

      try {
        const aiService = new AIService(
          config,
          samplerSettingsRef.current,
          promptSettingsRef.current
        );
        aiServiceRef.current = aiService;

        const conversationContext: ConversationMessage[] = historyForContext.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        contextArray = await resolveContextAtCallTime(
          getContextContentRef.current,
          contextEntryIdsRef.current
        );

        const onChunk = streaming
          ? (chunk: { content?: string; reasoning?: string }) => {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
              }
              appendStreamChunk(chunk);
            }
          : undefined;

        const result = await aiService.askAIWithConversation(
          question,
          contextArray,
          conversationContext,
          undefined,
          onChunk
        );

        // Drop request-local large arrays ASAP
        contextArray = [];

        const contentTokens = estimateTokens(result.content);
        const reasoningTokens = estimateTokens(result.reasoning ?? '');
        const totalTokens = contentTokens + reasoningTokens;
        const completionTime =
          firstTokenTime !== null
            ? Date.now() - firstTokenTime
            : Date.now() - requestStartTime;
        const ttft =
          firstTokenTime !== null ? firstTokenTime - requestStartTime : completionTime;
        const tokensPerSecond =
          completionTime > 0 ? totalTokens / (completionTime / 1000) : undefined;

        // Prefer stream draft when present so we do not allocate a second full
        // content string when it already matches what we displayed.
        const content =
          streaming && streamContentRef.current.length > 0
            ? streamContentRef.current
            : result.content;
        const reasoning =
          streaming && streamReasoningRef.current.length > 0
            ? streamReasoningRef.current || undefined
            : result.reasoning;

        const assistantMessage = buildAssistantMessage(content, reasoning, {
          enableStreaming: streaming,
          modelId: config.modelId,
          providerId: getProviderSelectionId(config),
          ttft,
          tokensPerSecond,
        });

        setChatHistory(trimHistory([...historyToKeep, assistantMessage]));
      } catch (err) {
        if (isRequestCancelled(err)) {
          console.log('[useAIChat] AI request cancelled by user');
          const partial = buildPartialAssistantMessage(
            streamContentRef.current,
            streamReasoningRef.current,
            {
              enableStreaming: streaming,
              modelId: config.modelId,
              providerId: getProviderSelectionId(config),
              ttft:
                firstTokenTime !== null ? firstTokenTime - requestStartTime : undefined,
            }
          );
          if (partial) {
            setChatHistory(trimHistory([...historyToKeep, partial]));
          }
        } else {
          console.error('AI request failed:', err);
          if (err instanceof AIError) {
            setError(err.message);
          } else {
            setError('Failed to get AI response. Please try again.');
          }
        }
      } finally {
        contextArray = [];
        finishTurn();
      }
    },
    [appendStreamChunk, clearStreamDraft, finishTurn]
  );

  const handleRegenerate = useCallback(async () => {
    const history = chatHistoryRef.current;
    if (history.length === 0) return;

    if (!isAIConfigured) {
      setError('Please configure AI settings first');
      return;
    }

    const lastUserIndex = history
      .map((m, i) => ({ ...m, originalIndex: i }))
      .reverse()
      .find(m => m.role === 'user');
    if (!lastUserIndex) return;

    const historyToKeep = history.slice(0, lastUserIndex.originalIndex + 1);
    const lastUserMessage = lastUserIndex.content;

    setChatHistory(historyToKeep);

    await runAssistantTurn({
      question: lastUserMessage,
      historyForContext: historyToKeep.slice(0, -1),
      historyToKeep,
    });
  }, [isAIConfigured, runAssistantTurn]);

  const handleAsk = useCallback(
    async (question: string) => {
      if (!question.trim()) {
        const lastMessage = chatHistoryRef.current[chatHistoryRef.current.length - 1];
        if (lastMessage?.role === 'user') {
          await handleRegenerate();
          return;
        }
        return;
      }

      if (!isAIConfigured) {
        setError('Please configure AI settings first');
        return;
      }

      const trimmedQuestion = question.trim();
      const priorHistory = chatHistoryRef.current;
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: trimmedQuestion,
        timestamp: Date.now(),
      };

      const historyToKeep = trimHistory([...priorHistory, userMessage]);
      setChatHistory(historyToKeep);

      await runAssistantTurn({
        question: trimmedQuestion,
        historyForContext: priorHistory,
        historyToKeep,
      });
    },
    [isAIConfigured, handleRegenerate, runAssistantTurn]
  );

  // Drop pending rAF if the panel unmounts mid-stream
  useEffect(() => {
    return () => {
      cancelStreamRaf();
      if (aiServiceRef.current) {
        aiServiceRef.current.abort();
        aiServiceRef.current = null;
      }
    };
  }, [cancelStreamRaf]);

  return {
    chatHistory,
    isProcessing,
    error,
    isStreaming,
    streamingContent,
    streamingReasoning,
    handleAsk,
    handleRegenerate,
    handleNewChat,
    handleDeleteMessage,
    handleAbort,
    clearError,
    isAIConfigured,
  };
}

export default useAIChat;
