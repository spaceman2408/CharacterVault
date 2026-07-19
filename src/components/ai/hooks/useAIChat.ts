/**
 * @fileoverview Custom hook for managing AI chat operations.
 * @module components/ai/hooks/useAIChat
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { AIService, AIError, estimateTokens } from '../../../services/AIService';
import { getProviderSelectionId } from '../../../services/providers';
import type { AIConfig, SamplerSettings, PromptSettings } from '../../../db/characterTypes';
import type { ChatMessage, ConversationMessage } from '../types';
import { generateMessageId } from '../utils';
import type { UseTypewriterReturn } from './useTypewriter';

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
  /** Typewriter hook instance for streaming display */
  typewriter: UseTypewriterReturn;
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

/** Build an assistant message from whatever the model streamed before stop. */
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

/**
 * Hook that manages AI chat operations including conversation history,
 * streaming, and error handling.
 */
export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const {
    aiConfig,
    samplerSettings,
    promptSettings,
    enableStreaming,
    typewriter,
    getContextContent,
    contextEntryIds,
  } = options;

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const aiServiceRef = useRef<AIService | null>(null);

  const isAIConfigured = useMemo(() => {
    return typeof aiConfig.modelId === 'string' && aiConfig.modelId.trim().length > 0;
  }, [aiConfig.modelId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleAbort = useCallback(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.abort();
    }
  }, []);

  /**
   * Clear history, abort in-flight work, and drop typewriter buffers.
   */
  const handleNewChat = useCallback(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.abort();
      aiServiceRef.current = null;
    }
    setChatHistory([]);
    setError(null);
    setIsProcessing(false);
    setIsStreaming(false);
    typewriter.stopStreaming();
    typewriter.clearDisplay();
  }, [typewriter]);

  /**
   * Remove the message at messageId and every message after it.
   * No-op while a request is in flight (avoids fighting the stream).
   */
  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (isProcessing) return;

      setChatHistory(prev => {
        const index = prev.findIndex(m => m.id === messageId);
        if (index === -1) return prev;
        return prev.slice(0, index);
      });
      setError(null);
    },
    [isProcessing]
  );

  /**
   * After a reply is committed to history, drop streaming display copies
   * so we do not keep two full copies of the same text in memory.
   */
  const finishStreamLifecycle = useCallback(
    (completedSuccessfully: boolean) => {
      if (!completedSuccessfully) {
        typewriter.flushQueues();
      }
      typewriter.stopStreaming();
      // Always free display buffers once the turn ends (success or cancel/error)
      typewriter.clearDisplay();
      setIsProcessing(false);
      setIsStreaming(false);
      aiServiceRef.current = null;
    },
    [typewriter]
  );

  const handleRegenerate = useCallback(async () => {
    if (chatHistory.length === 0) return;

    if (!isAIConfigured) {
      setError('Please configure AI settings first');
      return;
    }

    const lastUserIndex = chatHistory
      .map((m, i) => ({ ...m, originalIndex: i }))
      .reverse()
      .find(m => m.role === 'user');
    if (!lastUserIndex) return;

    const newHistory = chatHistory.slice(0, lastUserIndex.originalIndex + 1);
    const lastUserMessage = lastUserIndex.content;

    setChatHistory(newHistory);
    setIsProcessing(true);
    setError(null);

    await new Promise(resolve => setTimeout(resolve, 600));

    setIsStreaming(enableStreaming);
    typewriter.startStreaming();

    const requestStartTime = Date.now();
    let firstTokenTime: number | null = null;
    let completedSuccessfully = false;
    let contextArray: string[] = [];
    let partialContent = '';
    let partialReasoning = '';

    try {
      const aiService = new AIService(aiConfig, samplerSettings, promptSettings);
      aiServiceRef.current = aiService;

      const conversationContext: ConversationMessage[] = newHistory
        .slice(0, -1)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      // Resolve only for this request; local var is GC'd after the turn
      contextArray = await resolveContextAtCallTime(getContextContent, contextEntryIds);

      const onChunk = enableStreaming
        ? (chunk: { content?: string; reasoning?: string }) => {
            if (firstTokenTime === null) {
              firstTokenTime = Date.now();
            }

            if (chunk.reasoning) {
              partialReasoning += chunk.reasoning;
              typewriter.queueReasoningChunk(chunk.reasoning);
            }

            if (chunk.content) {
              partialContent += chunk.content;
              typewriter.markReasoningComplete();
              typewriter.queueContentChunk(chunk.content);
            }
          }
        : undefined;

      const result = await aiService.askAIWithConversation(
        lastUserMessage,
        contextArray,
        conversationContext,
        undefined,
        onChunk
      );

      // Drop large context copies as soon as the request finishes
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

      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: result.content,
        reasoning: result.reasoning,
        timestamp: Date.now(),
        stats: {
          ttft,
          tokensPerSecond,
          modelId: aiConfig.modelId,
          providerId: getProviderSelectionId(aiConfig),
        },
        suppressInitialAnimation: enableStreaming,
      };

      if (enableStreaming) {
        await typewriter.drainQueues();
      }

      setChatHistory(prev => [...prev, assistantMessage]);
      completedSuccessfully = true;
    } catch (err) {
      if (isRequestCancelled(err)) {
        console.log('[useAIChat] AI request cancelled by user');
        const partial = buildPartialAssistantMessage(partialContent, partialReasoning, {
          enableStreaming,
          modelId: aiConfig.modelId,
          providerId: getProviderSelectionId(aiConfig),
          ttft:
            firstTokenTime !== null ? firstTokenTime - requestStartTime : undefined,
        });
        if (partial) {
          setChatHistory(prev => [...prev, partial]);
          completedSuccessfully = true;
        }
      } else {
        console.error('AI regenerate failed:', err);
        if (err instanceof AIError) {
          setError(err.message);
        } else {
          setError('Failed to get AI response. Please try again.');
        }
      }
    } finally {
      contextArray = [];
      finishStreamLifecycle(completedSuccessfully);
    }
  }, [
    chatHistory,
    aiConfig,
    samplerSettings,
    promptSettings,
    isAIConfigured,
    enableStreaming,
    typewriter,
    getContextContent,
    contextEntryIds,
    finishStreamLifecycle,
  ]);

  const handleAsk = useCallback(
    async (question: string) => {
      if (!question.trim()) {
        const lastMessage = chatHistory[chatHistory.length - 1];
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
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: trimmedQuestion,
        timestamp: Date.now(),
      };

      setChatHistory(prev => [...prev, userMessage]);
      setIsProcessing(true);
      setError(null);

      await new Promise(resolve => setTimeout(resolve, 600));

      setIsStreaming(enableStreaming);
      typewriter.startStreaming();

      const requestStartTime = Date.now();
      let firstTokenTime: number | null = null;
      let completedSuccessfully = false;
      let contextArray: string[] = [];
      let partialContent = '';
      let partialReasoning = '';

      try {
        const aiService = new AIService(aiConfig, samplerSettings, promptSettings);
        aiServiceRef.current = aiService;

        const conversationContext: ConversationMessage[] = chatHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        contextArray = await resolveContextAtCallTime(getContextContent, contextEntryIds);

        const onChunk = enableStreaming
          ? (chunk: { content?: string; reasoning?: string }) => {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
              }

              if (chunk.reasoning) {
                partialReasoning += chunk.reasoning;
                typewriter.queueReasoningChunk(chunk.reasoning);
              }

              if (chunk.content) {
                partialContent += chunk.content;
                typewriter.markReasoningComplete();
                typewriter.queueContentChunk(chunk.content);
              }
            }
          : undefined;

        const result = await aiService.askAIWithConversation(
          trimmedQuestion,
          contextArray,
          conversationContext,
          undefined,
          onChunk
        );

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

        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: result.content,
          reasoning: result.reasoning,
          timestamp: Date.now(),
          stats: {
            ttft,
            tokensPerSecond,
            modelId: aiConfig.modelId,
            providerId: getProviderSelectionId(aiConfig),
          },
          suppressInitialAnimation: enableStreaming,
        };

        if (enableStreaming) {
          await typewriter.drainQueues();
        }

        setChatHistory(prev => [...prev, assistantMessage]);
        completedSuccessfully = true;
      } catch (err) {
        if (isRequestCancelled(err)) {
          console.log('[useAIChat] AI request cancelled by user');
          const partial = buildPartialAssistantMessage(partialContent, partialReasoning, {
            enableStreaming,
            modelId: aiConfig.modelId,
            providerId: getProviderSelectionId(aiConfig),
            ttft:
              firstTokenTime !== null ? firstTokenTime - requestStartTime : undefined,
          });
          if (partial) {
            setChatHistory(prev => [...prev, partial]);
            completedSuccessfully = true;
          }
        } else {
          console.error('AI ask failed:', err);
          if (err instanceof AIError) {
            setError(err.message);
          } else {
            setError('Failed to get AI response. Please try again.');
          }
        }
      } finally {
        contextArray = [];
        finishStreamLifecycle(completedSuccessfully);
      }
    },
    [
      chatHistory,
      aiConfig,
      samplerSettings,
      promptSettings,
      isAIConfigured,
      enableStreaming,
      handleRegenerate,
      typewriter,
      getContextContent,
      contextEntryIds,
      finishStreamLifecycle,
    ]
  );

  return {
    chatHistory,
    isProcessing,
    error,
    isStreaming,
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
