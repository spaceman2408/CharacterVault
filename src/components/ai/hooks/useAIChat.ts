/**
 * @fileoverview Custom hook for managing AI chat operations.
 * @module components/ai/hooks/useAIChat
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { AIService, AIError } from '../../../services/AIService';
import type { AIConfig, SamplerSettings, PromptSettings } from '../../../db/types';
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
  /** Resolved context content */
  resolvedContext: string[];
  /** Whether streaming is enabled */
  enableStreaming: boolean;
  /** Whether to show reasoning */
  showReasoning: boolean;
  /** Typewriter hook instance for streaming display */
  typewriter: UseTypewriterReturn;
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
  /** Handle aborting the current request */
  handleAbort: () => void;
  /** Clear the current error */
  clearError: () => void;
  /** Whether AI is properly configured */
  isAIConfigured: boolean;
}

/**
 * Hook that manages AI chat operations including conversation history,
 * streaming, and error handling.
 * 
 * This hook handles:
 * - Chat history state
 * - Processing state
 * - Error state
 * - handleAsk function
 * - handleRegenerate function
 * - Streaming callbacks integration
 * - AI service instance management
 * 
 * @param options - Configuration options for the hook
 * @returns Object containing chat state and control functions
 * 
 * @example
 * ```tsx
 * const typewriter = useTypewriter();
 * const chat = useAIChat({
 *   aiConfig,
 *   samplerSettings,
 *   promptSettings,
 *   resolvedContext: [],
 *   enableStreaming: true,
 *   showReasoning: true,
 *   typewriter,
 * });
 * 
 * // Ask a question
 * await chat.handleAsk("What is the character's name?");
 * 
 * // Regenerate last response
 * await chat.handleRegenerate();
 * 
 * // Clear history
 * chat.handleNewChat();
 * ```
 */
export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const {
    aiConfig,
    samplerSettings,
    promptSettings,
    resolvedContext,
    enableStreaming,
    typewriter,
  } = options;

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const aiServiceRef = useRef<AIService | null>(null);

  // Check if AI is properly configured
  const isAIConfigured = useMemo(() => {
    // Only require modelId, as we now support local hosting without API key
    return typeof aiConfig.modelId === 'string' && aiConfig.modelId.trim().length > 0;
  }, [aiConfig.modelId]);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Handle starting a new chat (clears chat history)
   */
  const handleNewChat = useCallback(() => {
    setChatHistory([]);
  }, []);

  /**
   * Handle aborting the current request
   */
  const handleAbort = useCallback(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.abort();
    }
  }, []);

  /**
   * Handle regenerating the last response
   */
  const handleRegenerate = useCallback(async () => {
    if (chatHistory.length === 0) return;

    if (!isAIConfigured) {
      setError('Please configure AI settings first');
      return;
    }

    // Find the last user message and remove everything after it
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

    // Artificial delay for consistency
    await new Promise(resolve => setTimeout(resolve, 600));

    setIsStreaming(enableStreaming);
    typewriter.startStreaming();

    try {
      const aiService = new AIService(aiConfig, samplerSettings, promptSettings);
      aiServiceRef.current = aiService;

      // Build conversation context from new history
      const conversationContext: ConversationMessage[] = newHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Build context array
      const contextArray: string[] = [];
      if (resolvedContext.length > 0) {
        contextArray.push(...resolvedContext);
      }

      // Streaming callback
      const onChunk = enableStreaming
        ? (chunk: { content?: string; reasoning?: string }) => {
            if (chunk.reasoning) {
              typewriter.queueReasoningChunk(chunk.reasoning);
            }

            if (chunk.content) {
              // Mark reasoning as complete when content starts arriving
              // This must be called regardless of whether this chunk also has reasoning,
              // because content signals the end of the reasoning phase
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

      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: result.content,
        reasoning: result.reasoning,
        timestamp: Date.now(),
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (err) {
      if (err instanceof AIError && err.message === 'Request was cancelled') {
        console.log('[useAIChat] AI request cancelled by user');
      } else {
        console.error('AI regenerate failed:', err);
        if (err instanceof AIError) {
          setError(err.message);
        } else {
          setError('Failed to get AI response. Please try again.');
        }
      }
    } finally {
      typewriter.flushQueues();
      typewriter.stopStreaming();
      setIsProcessing(false);
      setIsStreaming(false);
      aiServiceRef.current = null;
    }
  }, [
    chatHistory,
    resolvedContext,
    aiConfig,
    samplerSettings,
    promptSettings,
    isAIConfigured,
    enableStreaming,
    typewriter,
  ]);

  /**
   * Handle asking a question
   */
  const handleAsk = useCallback(
    async (question: string) => {
      // If input is empty but last message is a user message, regenerate from it
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

      // Add user message to chat
      setChatHistory(prev => [...prev, userMessage]);
      setIsProcessing(true);
      setError(null);

      // Artificial delay to prevent jarring UI updates and ensure "Thinking..." state is visible
      await new Promise(resolve => setTimeout(resolve, 600));

      setIsStreaming(enableStreaming);
      typewriter.startStreaming();

      try {
        const aiService = new AIService(aiConfig, samplerSettings, promptSettings);
        aiServiceRef.current = aiService;

        // Build conversation context from chat history (excluding the message we just added)
        const conversationContext: ConversationMessage[] = chatHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        // Build context array - only include resolved context, not selectedText automatically
        const contextArray: string[] = [];
        if (resolvedContext.length > 0) {
          contextArray.push(...resolvedContext);
        }

        // Streaming callback for conversation - queues chunks for smooth display
        const onChunk = enableStreaming
          ? (chunk: { content?: string; reasoning?: string }) => {
              if (chunk.reasoning) {
                typewriter.queueReasoningChunk(chunk.reasoning);
              }

              if (chunk.content) {
                // Mark reasoning as complete when content starts arriving
                // This must be called regardless of whether this chunk also has reasoning,
                // because content signals the end of the reasoning phase
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

        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: result.content,
          reasoning: result.reasoning,
          timestamp: Date.now(),
        };

        setChatHistory(prev => [...prev, assistantMessage]);
      } catch (err) {
        if (err instanceof AIError && err.message === 'Request was cancelled') {
          console.log('[useAIChat] AI request cancelled by user');
        } else {
          console.error('AI ask failed:', err);
          if (err instanceof AIError) {
            setError(err.message);
          } else {
            setError('Failed to get AI response. Please try again.');
          }
        }
      } finally {
        typewriter.flushQueues();
        typewriter.stopStreaming();
        setIsProcessing(false);
        setIsStreaming(false);
        aiServiceRef.current = null;
      }
    },
    [
      chatHistory,
      resolvedContext,
      aiConfig,
      samplerSettings,
      promptSettings,
      isAIConfigured,
      enableStreaming,
      handleRegenerate,
      typewriter,
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
    handleAbort,
    clearError,
    isAIConfigured,
  };
}

export default useAIChat;
