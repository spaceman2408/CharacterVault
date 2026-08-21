import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '../../components/ai/types';
import { generateMessageId } from '../../components/ai/utils';
import type { AIConfig, CharacterBook, PromptSettings, SamplerSettings } from '../../db/characterTypes';
import { AIError, AIService } from '../../services/AIService';
import { runLoop } from '../core/runLoop';
import { stripFences } from '../core/stripFences';
import type { AgentMessage } from '../core/types';
import { createLorebookHost } from '../hosts/lorebook/createHost';
import type { AgentToolEvent } from './types';

export interface UseLorebookAgentOptions {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getBook: () => CharacterBook;
  setBook: (book: CharacterBook) => Promise<void>;
  getCustomContext: () => Promise<string | null>;
  flushDraft: () => void;
  takeSnapshot: () => Promise<void>;
  onRunningChange?: (running: boolean) => void;
}

export function lastUserMessageIndex(history: Array<{ role: string }>): number {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'user') return i;
  }
  return -1;
}

export interface UseLorebookAgentReturn {
  chatHistory: ChatMessage[];
  toolEventsByMessageId: Record<string, AgentToolEvent[]>;
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

export function useLorebookAgent(options: UseLorebookAgentOptions): UseLorebookAgentReturn {
  const {
    aiConfig,
    samplerSettings,
    promptSettings,
    getBook,
    setBook,
    getCustomContext,
    flushDraft,
    takeSnapshot,
    onRunningChange,
  } = options;

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [toolEventsByMessageId, setToolEventsByMessageId] = useState<
    Record<string, AgentToolEvent[]>
  >({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');

  const aiServiceRef = useRef<AIService | null>(null);
  const abortedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const requestIdRef = useRef(0);
  const lastAssistantIdRef = useRef<string | null>(null);
  const chatHistoryRef = useRef(chatHistory);
  const streamContentRef = useRef('');
  const streamReasoningRef = useRef('');
  const streamRafRef = useRef<number | null>(null);
  const streamDirtyRef = useRef(false);

  const getBookRef = useRef(getBook);
  const setBookRef = useRef(setBook);
  const getCustomContextRef = useRef(getCustomContext);
  const flushDraftRef = useRef(flushDraft);
  const takeSnapshotRef = useRef(takeSnapshot);
  const onRunningChangeRef = useRef(onRunningChange);
  const aiConfigRef = useRef(aiConfig);
  const samplerSettingsRef = useRef(samplerSettings);
  const promptSettingsRef = useRef(promptSettings);

  chatHistoryRef.current = chatHistory;
  getBookRef.current = getBook;
  setBookRef.current = setBook;
  getCustomContextRef.current = getCustomContext;
  flushDraftRef.current = flushDraft;
  takeSnapshotRef.current = takeSnapshot;
  onRunningChangeRef.current = onRunningChange;
  aiConfigRef.current = aiConfig;
  samplerSettingsRef.current = samplerSettings;
  promptSettingsRef.current = promptSettings;

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
    if (!isMountedRef.current) return;
    setStreamingContent(stripFences(streamContentRef.current));
    setStreamingReasoning(streamReasoningRef.current);
  }, []);

  const clearStreamDraft = useCallback(() => {
    cancelStreamRaf();
    streamContentRef.current = '';
    streamReasoningRef.current = '';
    if (isMountedRef.current) {
      setStreamingContent('');
      setStreamingReasoning('');
    }
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
    [flushStreamToState],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
      abortedRef.current = true;
      cancelStreamRaf();
      aiServiceRef.current?.abort();
      aiServiceRef.current = null;
      onRunningChangeRef.current?.(false);
    };
  }, [cancelStreamRaf]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleAbort = useCallback(() => {
    abortedRef.current = true;
    aiServiceRef.current?.abort();
  }, []);

  const handleNewChat = useCallback(() => {
    requestIdRef.current += 1;
    abortedRef.current = true;
    aiServiceRef.current?.abort();
    aiServiceRef.current = null;
    clearStreamDraft();
    lastAssistantIdRef.current = null;
    setChatHistory([]);
    setToolEventsByMessageId({});
    setError(null);
    setIsProcessing(false);
    isProcessingRef.current = false;
    setIsStreaming(false);
    onRunningChangeRef.current?.(false);
  }, [clearStreamDraft]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    if (isProcessingRef.current) return;
    setChatHistory((prev) => {
      const index = prev.findIndex((message) => message.id === messageId);
      if (index === -1) return prev;
      return prev.slice(0, index);
    });
    setToolEventsByMessageId({});
    setError(null);
  }, []);

  const startRun = useCallback(
    async (question: string, priorHistory: ChatMessage[]) => {
      if (!isAIConfigured) {
        setError('Please configure AI settings first');
        return;
      }

      const requestId = ++requestIdRef.current;
      abortedRef.current = false;
      isProcessingRef.current = true;
      setIsProcessing(true);
      setError(null);
      clearStreamDraft();
      lastAssistantIdRef.current = null;
      onRunningChangeRef.current?.(true);

      const historyForLoop: AgentMessage[] = priorHistory.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      flushDraftRef.current();

      const config = aiConfigRef.current;
      const streaming = config.enableStreaming ?? true;
      const aiService = new AIService(config, samplerSettingsRef.current, promptSettingsRef.current);
      aiServiceRef.current = aiService;

      const host = createLorebookHost({
        getBook: () => getBookRef.current(),
        setBook: (book) => setBookRef.current(book),
        getCustomContext: () => getCustomContextRef.current(),
        takeSnapshot: () => takeSnapshotRef.current(),
      });

      const isCurrent = () => isMountedRef.current && requestId === requestIdRef.current;

      try {
        const result = await runLoop({
          host,
          userMessage: question,
          history: historyForLoop,
          isAborted: () => abortedRef.current || !isCurrent(),
          onChunk: streaming
            ? (chunk) => {
                if (!isCurrent()) return;
                appendStreamChunk(chunk);
              }
            : undefined,
          complete: async (messages, onChunk) => {
            if (!isCurrent()) {
              return { content: '' };
            }
            if (isMountedRef.current) setIsStreaming(streaming);
            clearStreamDraft();
            return aiService.chat(messages, undefined, onChunk);
          },
          onEvent: (event) => {
            if (!isCurrent()) return;
            if (event.type === 'assistant_text') {
              clearStreamDraft();
              if (isMountedRef.current) setIsStreaming(false);
              const id = generateMessageId();
              lastAssistantIdRef.current = id;
              const assistantMessage: ChatMessage = {
                id,
                role: 'assistant',
                content: event.text,
                reasoning: event.reasoning,
                timestamp: Date.now(),
                suppressInitialAnimation: streaming,
              };
              setChatHistory((prev) => [...prev, assistantMessage]);
              return;
            }
            if (event.type === 'tool_result') {
              let targetId = lastAssistantIdRef.current;
              if (!targetId) {
                targetId = generateMessageId();
                lastAssistantIdRef.current = targetId;
                setChatHistory((prev) => [
                  ...prev,
                  {
                    id: targetId!,
                    role: 'assistant',
                    content: '',
                    timestamp: Date.now(),
                    suppressInitialAnimation: true,
                  },
                ]);
              }
              const eventRow: AgentToolEvent = {
                toolName: event.result.toolName,
                ok: event.result.ok,
                message: event.result.message,
              };
              setToolEventsByMessageId((prev) => ({
                ...prev,
                [targetId]: [...(prev[targetId] ?? []), eventRow],
              }));
              return;
            }
            if (event.type === 'error') {
              setError(event.message);
            }
          },
        });

        if (result.reason === 'abort' && isCurrent()) {
          const speech = stripFences(streamContentRef.current);
          const reasoning = streamReasoningRef.current;
          if (speech || reasoning) {
            const id = generateMessageId();
            lastAssistantIdRef.current = id;
            setChatHistory((prev) => [
              ...prev,
              {
                id,
                role: 'assistant',
                content: speech,
                reasoning: reasoning || undefined,
                timestamp: Date.now(),
                suppressInitialAnimation: true,
              },
            ]);
          }
        }
      } catch (err) {
        if (!isCurrent()) return;
        if (err instanceof AIError && err.message === 'Request was cancelled') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Agent request failed');
      } finally {
        if (requestId === requestIdRef.current) {
          aiServiceRef.current = null;
          isProcessingRef.current = false;
          if (isMountedRef.current) {
            setIsProcessing(false);
            setIsStreaming(false);
            clearStreamDraft();
          }
          onRunningChangeRef.current?.(false);
        }
      }
    },
    [appendStreamChunk, clearStreamDraft, isAIConfigured],
  );

  const handleRegenerate = useCallback(async () => {
    if (isProcessingRef.current) return;
    const history = chatHistoryRef.current;
    const lastUserIndex = lastUserMessageIndex(history);
    if (lastUserIndex < 0) return;
    const lastUser = history[lastUserIndex];
    const historyToKeep = history.slice(0, lastUserIndex + 1);
    const keepIds = new Set(historyToKeep.map((message) => message.id));
    setChatHistory(historyToKeep);
    setToolEventsByMessageId((prev) => {
      const next: Record<string, AgentToolEvent[]> = {};
      for (const [id, events] of Object.entries(prev)) {
        if (keepIds.has(id)) next[id] = events;
      }
      return next;
    });
    await startRun(lastUser.content, historyToKeep.slice(0, -1));
  }, [startRun]);

  const handleAsk = useCallback(
    async (question: string) => {
      if (isProcessingRef.current) return;
      const trimmed = question.trim();
      if (!trimmed) {
        await handleRegenerate();
        return;
      }

      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      const priorHistory = chatHistoryRef.current;
      setChatHistory((prev) => [...prev, userMessage]);
      await startRun(trimmed, priorHistory);
    },
    [handleRegenerate, startRun],
  );

  return {
    chatHistory,
    toolEventsByMessageId,
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
