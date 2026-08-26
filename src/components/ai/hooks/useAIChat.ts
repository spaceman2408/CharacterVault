/**
 * @fileoverview Custom hook for managing AI chat operations.
 * @module components/ai/hooks/useAIChat
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { AIService, AIError } from '../../../services/AIService';
import { getProviderSelectionId } from '../../../services/providers';
import type { AIConfig, SamplerSettings, PromptSettings } from '../../../db/characterTypes';
import type { ChatMessage, ConversationMessage } from '../types';
import {
  abortResponseStats,
  clipCommitReasoning,
  COMMIT_REASONING_MAX_CHARS,
  LIVE_CONTENT_MAX_CHARS,
  LIVE_REASONING_MAX_CHARS,
  computeResponseStats,
  generateMessageId,
} from '../utils';
import { ChunkString } from '../../../utils/chunkString';
import { registerChatSessionFlush } from '../../../utils/chatSessionFlush';

export const MAX_CHAT_MESSAGES = 80;

export const ASSISTANT_TURN_START_DELAY_MS = 600;

export interface UseAIChatOptions {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  enableStreaming: boolean;
  showReasoning: boolean;
  getContextContent?: (entryIds: string[]) => Promise<string[]>;
  contextEntryIds: string[];
  /** When true, still resolve context even if no card sections are pinned */
  customContextIncluded?: boolean;
}

export interface UseAIChatReturn {
  chatHistory: ChatMessage[];
  isProcessing: boolean;
  error: string | null;
  isStreaming: boolean;
  streamingContent: string;
  streamingReasoning: string;
  handleAsk: (question: string) => Promise<void>;
  handleRegenerate: () => Promise<void>;
  handleNewChat: () => void;
  handleDeleteMessage: (messageId: string) => void;
  handleAbort: () => void;
  clearError: () => void;
  isAIConfigured: boolean;
}

function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_CHAT_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_CHAT_MESSAGES);
}

export async function resolveContextAtCallTime(
  getContextContent: ((entryIds: string[]) => Promise<string[]>) | undefined,
  contextEntryIds: string[],
  customContextIncluded = false,
): Promise<string[]> {
  if (!getContextContent) return [];
  if (contextEntryIds.length === 0 && !customContextIncluded) {
    return [];
  }
  try {
    return await getContextContent(contextEntryIds);
  } catch (error) {
    console.error('Failed to resolve AI context:', error);
    return [];
  }
}

function isRequestCancelled(err: unknown): boolean {
  return err instanceof AIError && err.message === 'Request was cancelled';
}

/** Stop keeps generation current (true); New chat / unmount bump it (false). */
export function shouldCommitCancelledPartial(
  isMounted: boolean,
  requestId: number,
  currentGeneration: number
): boolean {
  return isMounted && requestId === currentGeneration;
}

function buildPartialAssistantMessage(
  content: string,
  reasoning: string,
  options: {
    enableStreaming: boolean;
    modelId: string;
    providerId: string | undefined;
    requestStartTime: number;
    firstTokenTime: number | null;
  }
): ChatMessage | null {
  if (!content && !reasoning) return null;

  return {
    id: generateMessageId(),
    role: 'assistant',
    content,
    reasoning: clipCommitReasoning(reasoning),
    timestamp: Date.now(),
    stats: abortResponseStats({
      requestStartTime: options.requestStartTime,
      firstTokenTime: options.firstTokenTime,
      modelId: options.modelId,
      providerId: options.providerId,
    }),
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
    requestStartTime: number;
    firstTokenTime: number | null;
  }
): ChatMessage {
  return {
    id: generateMessageId(),
    role: 'assistant',
    content,
    reasoning: clipCommitReasoning(reasoning),
    timestamp: Date.now(),
    stats: computeResponseStats({
      requestStartTime: options.requestStartTime,
      firstTokenTime: options.firstTokenTime,
      content,
      reasoning,
      modelId: options.modelId,
      providerId: options.providerId,
    }),
    suppressInitialAnimation: options.enableStreaming,
  };
}

export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const {
    aiConfig,
    samplerSettings,
    promptSettings,
    enableStreaming,
    getContextContent,
    contextEntryIds,
    customContextIncluded = false,
  } = options;

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');

  const aiServiceRef = useRef<AIService | null>(null);
  const streamContentRef = useRef(new ChunkString());
  const streamReasoningRef = useRef(new ChunkString());
  const streamRafRef = useRef<number | null>(null);
  const streamDirtyRef = useRef(false);

  const requestGenerationRef = useRef(0);
  const isMountedRef = useRef(true);
  const leavingRef = useRef(false);
  const runPromiseRef = useRef(Promise.resolve());
  const turnStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnStartResolveRef = useRef<(() => void) | null>(null);

  const chatHistoryRef = useRef(chatHistory);
  const isProcessingRef = useRef(isProcessing);
  const aiConfigRef = useRef(aiConfig);
  const samplerSettingsRef = useRef(samplerSettings);
  const promptSettingsRef = useRef(promptSettings);
  const enableStreamingRef = useRef(enableStreaming);
  const getContextContentRef = useRef(getContextContent);
  const contextEntryIdsRef = useRef(contextEntryIds);
  const customContextIncludedRef = useRef(customContextIncluded);

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
  useEffect(() => {
    customContextIncludedRef.current = customContextIncluded;
  }, [customContextIncluded]);

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

  const settleTurnStartWait = useCallback(() => {
    if (turnStartTimerRef.current != null) {
      clearTimeout(turnStartTimerRef.current);
      turnStartTimerRef.current = null;
    }
    const resolve = turnStartResolveRef.current;
    turnStartResolveRef.current = null;
    resolve?.();
  }, []);

  const flushStreamToState = useCallback(() => {
    streamRafRef.current = null;
    if (!streamDirtyRef.current) return;
    streamDirtyRef.current = false;
    if (!isMountedRef.current) return;
    setStreamingContent(streamContentRef.current.tail(LIVE_CONTENT_MAX_CHARS));
    setStreamingReasoning(streamReasoningRef.current.tail(LIVE_REASONING_MAX_CHARS));
  }, []);

  const clearStreamDraft = useCallback(() => {
    cancelStreamRaf();
    streamContentRef.current.clear();
    streamReasoningRef.current.clear();
    if (isMountedRef.current) {
      setStreamingContent('');
      setStreamingReasoning('');
    }
  }, [cancelStreamRaf]);

  const appendStreamChunk = useCallback(
    (chunk: { content?: string; reasoning?: string }) => {
      let changed = false;
      if (chunk.reasoning) {
        streamReasoningRef.current.append(chunk.reasoning);
        if (streamReasoningRef.current.length > COMMIT_REASONING_MAX_CHARS * 2) {
          streamReasoningRef.current.capToTail(COMMIT_REASONING_MAX_CHARS);
        }
        changed = true;
      }
      if (chunk.content) {
        streamContentRef.current.append(chunk.content);
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

  // New chat / unmount only — not Stop (Stop must keep generation so partial can commit).
  const invalidateInFlight = useCallback(
    (reason: 'new-chat' | 'unmount' | 'leave') => {
      requestGenerationRef.current += 1;
      cancelStreamRaf();
      settleTurnStartWait();
      const service = aiServiceRef.current;
      if (service) {
        console.log(`[useAIChat] Aborting in-flight AI request (${reason})`);
        service.abort();
        aiServiceRef.current = null;
      }
    },
    [cancelStreamRaf, settleTurnStartWait]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleAbort = useCallback(() => {
    isProcessingRef.current = false;
    settleTurnStartWait();
    if (aiServiceRef.current) {
      aiServiceRef.current.abort();
    }
    if (isMountedRef.current) {
      setIsProcessing(false);
      setIsStreaming(false);
    }
  }, [settleTurnStartWait]);

  const releaseSession = useCallback(
    (reason: 'new-chat' | 'unmount') => {
      invalidateInFlight(reason);
      streamContentRef.current.clear();
      streamReasoningRef.current.clear();
      chatHistoryRef.current = [];
      isProcessingRef.current = false;
      if (reason !== 'unmount' && isMountedRef.current) {
        setChatHistory([]);
        setError(null);
        setIsProcessing(false);
        setIsStreaming(false);
        setStreamingContent('');
        setStreamingReasoning('');
      }
    },
    [invalidateInFlight],
  );

  const releaseSessionRef = useRef(releaseSession);
  releaseSessionRef.current = releaseSession;

  const handleNewChat = useCallback(() => {
    releaseSession('new-chat');
  }, [releaseSession]);

  const drainSession = useCallback(async () => {
    leavingRef.current = true;
    invalidateInFlight('leave');
    streamContentRef.current.clear();
    streamReasoningRef.current.clear();
    isProcessingRef.current = false;
    if (isMountedRef.current) {
      setIsProcessing(false);
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingReasoning('');
    }
    try {
      await runPromiseRef.current;
    } finally {
      if (isMountedRef.current) leavingRef.current = false;
    }
  }, [invalidateInFlight]);

  useEffect(() => registerChatSessionFlush(drainSession), [drainSession]);

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
    if (!isMountedRef.current) return;
    setIsProcessing(false);
    isProcessingRef.current = false;
    setIsStreaming(false);
    aiServiceRef.current = null;
  }, [clearStreamDraft]);

  const runAssistantTurn = useCallback(
    async (args: {
      question: string;
      historyForContext: ChatMessage[];
      historyToKeep: ChatMessage[];
    }) => {
      const run = (async () => {
        if (leavingRef.current) return;
      const { question, historyForContext, historyToKeep } = args;
      const config = aiConfigRef.current;
      const streaming = enableStreamingRef.current;

      const requestId = ++requestGenerationRef.current;
      const isCurrent = () =>
        isMountedRef.current && requestId === requestGenerationRef.current;

      setIsProcessing(true);
      isProcessingRef.current = true;
      setError(null);
      clearStreamDraft();

      await new Promise<void>((resolve) => {
        turnStartResolveRef.current = resolve;
        turnStartTimerRef.current = setTimeout(() => {
          turnStartTimerRef.current = null;
          turnStartResolveRef.current = null;
          resolve();
        }, ASSISTANT_TURN_START_DELAY_MS);
      });

      if (!isCurrent() || !isProcessingRef.current || leavingRef.current) {
        return;
      }

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
        if (!isCurrent()) {
          aiService.dispose();
          return;
        }
        aiServiceRef.current = aiService;

        const conversationContext: ConversationMessage[] = historyForContext.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        contextArray = await resolveContextAtCallTime(
          getContextContentRef.current,
          contextEntryIdsRef.current,
          customContextIncludedRef.current,
        );

        if (!isCurrent()) {
          contextArray = [];
          return;
        }

        const onChunk = streaming
          ? (chunk: { content?: string; reasoning?: string }) => {
              if (!isCurrent()) return;
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
              }
              appendStreamChunk(chunk);
            }
          : undefined;

        let result;
        try {
          result = await aiService.askAIWithConversation(
            question,
            contextArray,
            conversationContext,
            undefined,
            onChunk
          );
        } finally {
          // Drop custom-context body (and other chunks) once the request is in flight/done
          contextArray = [];
        }

        if (!isCurrent()) {
          return;
        }

        const content =
          streaming && streamContentRef.current.length > 0
            ? streamContentRef.current.toString()
            : result.content;
        const reasoning =
          streaming && streamReasoningRef.current.length > 0
            ? streamReasoningRef.current.toString() || undefined
            : result.reasoning;

        const assistantMessage = buildAssistantMessage(content, reasoning, {
          enableStreaming: streaming,
          modelId: config.modelId,
          providerId: getProviderSelectionId(config),
          requestStartTime,
          firstTokenTime,
        });

        setChatHistory(trimHistory([...historyToKeep, assistantMessage]));
      } catch (err) {
        if (
          !shouldCommitCancelledPartial(
            isMountedRef.current,
            requestId,
            requestGenerationRef.current
          )
        ) {
          if (isRequestCancelled(err)) {
            console.log('[useAIChat] AI request cancelled (stale or unmounted)');
          }
          return;
        }

        if (isRequestCancelled(err)) {
          console.log('[useAIChat] AI request cancelled by user');
          const partial = buildPartialAssistantMessage(
            streamContentRef.current.toString(),
            streamReasoningRef.current.toString(),
            {
              enableStreaming: streaming,
              modelId: config.modelId,
              providerId: getProviderSelectionId(config),
              requestStartTime,
              firstTokenTime,
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
        if (requestId === requestGenerationRef.current) {
          aiServiceRef.current = null;
        }
        if (
          isMountedRef.current &&
          requestId === requestGenerationRef.current
        ) {
          finishTurn();
        } else {
          cancelStreamRaf();
          streamContentRef.current.clear();
          streamReasoningRef.current.clear();
        }
      }
      })();
      runPromiseRef.current = run.then(
        () => undefined,
        () => undefined,
      );
      await run;
    },
    [appendStreamChunk, cancelStreamRaf, clearStreamDraft, finishTurn]
  );

  const handleRegenerate = useCallback(async () => {
    if (leavingRef.current || isProcessingRef.current) return;

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
      if (leavingRef.current || isProcessingRef.current) return;

      if (!question.trim()) {
        const lastMessage = chatHistoryRef.current[chatHistoryRef.current.length - 1];
        if (
          lastMessage?.role === 'user' ||
          (lastMessage?.role === 'assistant' && !lastMessage.content.trim())
        ) {
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

  useEffect(() => {
    isMountedRef.current = true;
    leavingRef.current = false;
    return () => {
      isMountedRef.current = false;
      leavingRef.current = true;
      releaseSessionRef.current('unmount');
    };
  }, []);

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
