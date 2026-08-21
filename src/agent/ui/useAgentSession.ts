import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '../../components/ai/types';
import { generateMessageId } from '../../components/ai/utils';
import type { AIConfig, PromptSettings, SamplerSettings } from '../../db/characterTypes';
import { AIError, AIService } from '../../services/AIService';
import type { ChatMessage as ServiceChatMessage } from '../../services/AIService';
import { AGENT_MAX_OUTPUT_TOKENS, runLoop } from '../core/runLoop';
import { stripFences } from '../core/stripFences';
import type { AgentHost, AgentMessage } from '../core/types';
import { clipLiveReasoning, LIVE_REASONING_FLUSH_MS } from './liveReasoning';
import { compactToolResultMessage, isLookupOnlyTurn } from './notices';
import type { AgentToolEvent } from './types';

export interface UseAgentSessionOptions {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  createHost: () => AgentHost;
  flushDraft: () => void | Promise<void>;
  lookupToolNames: ReadonlySet<string>;
  onRunningChange?: (running: boolean) => void;
}

function toServiceMessages(messages: AgentMessage[]): ServiceChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    tool_call_id: message.tool_call_id,
    tool_calls: message.tool_calls?.map((call) => ({
      id: call.id,
      type: 'function' as const,
      function: { name: call.name, arguments: call.arguments },
    })),
  }));
}

export function lastUserMessageIndex(history: Array<{ role: string }>): number {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'user') return i;
  }
  return -1;
}

export interface UseAgentSessionReturn {
  chatHistory: ChatMessage[];
  toolEventsByMessageId: Record<string, AgentToolEvent[]>;
  errorByMessageId: Record<string, string>;
  isProcessing: boolean;
  error: string | null;
  busyLabel: string | null;
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

export function useAgentSession(options: UseAgentSessionOptions): UseAgentSessionReturn {
  const {
    aiConfig,
    samplerSettings,
    promptSettings,
    createHost,
    flushDraft,
    lookupToolNames,
    onRunningChange,
  } = options;

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [toolEventsByMessageId, setToolEventsByMessageId] = useState<
    Record<string, AgentToolEvent[]>
  >({});
  const [errorByMessageId, setErrorByMessageId] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingReasoning, setStreamingReasoning] = useState('');

  const aiServiceRef = useRef<AIService | null>(null);
  const abortedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const requestIdRef = useRef(0);
  const lastAssistantIdRef = useRef<string | null>(null);
  const chatHistoryRef = useRef(chatHistory);
  const toolEventsRef = useRef(toolEventsByMessageId);
  const streamContentRef = useRef('');
  const streamReasoningRef = useRef('');
  const reasoningFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createHostRef = useRef(createHost);
  const flushDraftRef = useRef(flushDraft);
  const lookupToolNamesRef = useRef(lookupToolNames);
  const onRunningChangeRef = useRef(onRunningChange);
  const aiConfigRef = useRef(aiConfig);
  const samplerSettingsRef = useRef(samplerSettings);
  const promptSettingsRef = useRef(promptSettings);

  createHostRef.current = createHost;
  flushDraftRef.current = flushDraft;
  lookupToolNamesRef.current = lookupToolNames;
  onRunningChangeRef.current = onRunningChange;
  aiConfigRef.current = aiConfig;
  samplerSettingsRef.current = samplerSettings;
  promptSettingsRef.current = promptSettings;

  const isAIConfigured = useMemo(() => {
    return typeof aiConfig.modelId === 'string' && aiConfig.modelId.trim().length > 0;
  }, [aiConfig.modelId]);

  const cancelReasoningFlush = useCallback(() => {
    if (reasoningFlushTimerRef.current != null) {
      clearTimeout(reasoningFlushTimerRef.current);
      reasoningFlushTimerRef.current = null;
    }
  }, []);

  const clearStreamDraft = useCallback(() => {
    streamContentRef.current = '';
    streamReasoningRef.current = '';
    cancelReasoningFlush();
    setStreamingReasoning('');
  }, [cancelReasoningFlush]);

  const scheduleReasoningFlush = useCallback(() => {
    if (reasoningFlushTimerRef.current != null) return;
    reasoningFlushTimerRef.current = setTimeout(() => {
      reasoningFlushTimerRef.current = null;
      if (!isMountedRef.current) return;
      if (!(aiConfigRef.current.showReasoning ?? true)) return;
      setStreamingReasoning(clipLiveReasoning(streamReasoningRef.current));
    }, LIVE_REASONING_FLUSH_MS);
  }, []);

  const appendStreamChunk = useCallback((chunk: { content?: string; reasoning?: string }) => {
    if (chunk.reasoning) {
      streamReasoningRef.current += chunk.reasoning;
      if (aiConfigRef.current.showReasoning ?? true) scheduleReasoningFlush();
    }
    if (chunk.content) streamContentRef.current += chunk.content;
  }, [scheduleReasoningFlush]);

  const attachError = useCallback((message: string) => {
    setError(message);
    const targetId = lastAssistantIdRef.current ?? chatHistoryRef.current.at(-1)?.id;
    if (targetId) {
      setErrorByMessageId((prev) => ({ ...prev, [targetId]: message }));
    }
  }, []);

  const dropLookupOnlyMessage = useCallback((messageId: string | null) => {
    if (!messageId) return;
    const events = toolEventsRef.current[messageId] ?? [];
    if (!isLookupOnlyTurn(events, lookupToolNamesRef.current)) return;

    const nextHistory = chatHistoryRef.current.filter((message) => message.id !== messageId);
    chatHistoryRef.current = nextHistory;
    setChatHistory(nextHistory);

    const nextEvents = { ...toolEventsRef.current };
    delete nextEvents[messageId];
    toolEventsRef.current = nextEvents;
    setToolEventsByMessageId(nextEvents);

    setErrorByMessageId((prev) => {
      if (!(messageId in prev)) return prev;
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
      abortedRef.current = true;
      streamContentRef.current = '';
      streamReasoningRef.current = '';
      if (reasoningFlushTimerRef.current != null) {
        clearTimeout(reasoningFlushTimerRef.current);
        reasoningFlushTimerRef.current = null;
      }
      aiServiceRef.current?.abort();
      aiServiceRef.current = null;
      onRunningChangeRef.current?.(false);
    };
  }, []);

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
    chatHistoryRef.current = [];
    setChatHistory([]);
    toolEventsRef.current = {};
    setToolEventsByMessageId({});
    setErrorByMessageId({});
    setError(null);
    setBusyLabel(null);
    setIsProcessing(false);
    isProcessingRef.current = false;
    setIsStreaming(false);
    onRunningChangeRef.current?.(false);
  }, [clearStreamDraft]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    if (isProcessingRef.current) return;
    const history = chatHistoryRef.current;
    const index = history.findIndex((message) => message.id === messageId);
    if (index === -1) return;
    const nextHistory = history.slice(0, index);
    const keepIds = new Set(nextHistory.map((message) => message.id));
    chatHistoryRef.current = nextHistory;
    setChatHistory(nextHistory);

    const nextEvents: Record<string, AgentToolEvent[]> = {};
    for (const [id, events] of Object.entries(toolEventsRef.current)) {
      if (keepIds.has(id)) nextEvents[id] = events;
    }
    toolEventsRef.current = nextEvents;
    setToolEventsByMessageId(nextEvents);

    setErrorByMessageId((prev) => {
      const next: Record<string, string> = {};
      for (const [id, message] of Object.entries(prev)) {
        if (keepIds.has(id)) next[id] = message;
      }
      return next;
    });
    setError(null);
  }, []);

  const startRun = useCallback(
    async (question: string, priorHistory: ChatMessage[]) => {
      if (!isAIConfigured) {
        const message = 'Please configure AI settings first';
        setError(message);
        const targetId = chatHistoryRef.current.at(-1)?.id;
        if (targetId) {
          setErrorByMessageId((prev) => ({ ...prev, [targetId]: message }));
        }
        return;
      }

      const requestId = ++requestIdRef.current;
      abortedRef.current = false;
      isProcessingRef.current = true;
      setIsProcessing(true);
      setBusyLabel(null);
      setError(null);
      clearStreamDraft();
      lastAssistantIdRef.current = null;
      onRunningChangeRef.current?.(true);

      const historyForLoop: AgentMessage[] = priorHistory.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const isCurrent = () => isMountedRef.current && requestId === requestIdRef.current;
      let runService: AIService | null = null;

      try {
        await flushDraftRef.current();
        if (!isCurrent() || abortedRef.current) {
          return;
        }

        const config = aiConfigRef.current;
        const streaming = config.enableStreaming ?? true;
        const aiService = new AIService(config, samplerSettingsRef.current, promptSettingsRef.current);
        runService = aiService;
        aiServiceRef.current = aiService;

        const host = createHostRef.current();

        const result = await runLoop({
          host,
          userMessage: question,
          history: historyForLoop,
          isAborted: () => abortedRef.current || !isCurrent(),
          onChunk: streaming
            ? (chunk) => {
                if (!isCurrent() || abortedRef.current) return;
                appendStreamChunk(chunk);
              }
            : undefined,
          complete: async (messages, onChunk) => {
            if (!isCurrent() || abortedRef.current) {
              return { content: '' };
            }
            if (isMountedRef.current) setIsStreaming(streaming);
            clearStreamDraft();
            if (!isCurrent() || abortedRef.current) {
              return { content: '' };
            }
            return aiService.chat(toServiceMessages(messages), undefined, onChunk, {
              maxTokens: AGENT_MAX_OUTPUT_TOKENS,
              tools: host.tools
                ? host.tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                  }))
                : undefined,
            });
          },
          onEvent: (event) => {
            if (!isCurrent() || abortedRef.current) return;
            if (event.type === 'tool_start') {
              setBusyLabel(event.toolName);
              return;
            }
            if (event.type === 'assistant_text') {
              dropLookupOnlyMessage(lastAssistantIdRef.current);
              clearStreamDraft();
              setBusyLabel(null);
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
              const nextHistory = [...chatHistoryRef.current, assistantMessage];
              chatHistoryRef.current = nextHistory;
              setChatHistory(nextHistory);
              return;
            }
            if (event.type === 'tool_result') {
              let targetId = lastAssistantIdRef.current;
              if (!targetId) {
                targetId = generateMessageId();
                lastAssistantIdRef.current = targetId;
                const placeholder: ChatMessage = {
                  id: targetId,
                  role: 'assistant',
                  content: '',
                  timestamp: Date.now(),
                  suppressInitialAnimation: true,
                };
                const nextHistory = [...chatHistoryRef.current, placeholder];
                chatHistoryRef.current = nextHistory;
                setChatHistory(nextHistory);
              }
              const eventRow: AgentToolEvent = {
                toolName: event.result.toolName,
                ok: event.result.ok,
                message: compactToolResultMessage(
                  event.result.toolName,
                  event.result.message,
                  lookupToolNamesRef.current,
                ),
              };
              const nextEvents = {
                ...toolEventsRef.current,
                [targetId]: [...(toolEventsRef.current[targetId] ?? []), eventRow],
              };
              toolEventsRef.current = nextEvents;
              setToolEventsByMessageId(nextEvents);
              return;
            }
            if (event.type === 'error') {
              attachError(event.message);
            }
          },
        });

        if (result.reason === 'abort' && isCurrent()) {
          dropLookupOnlyMessage(lastAssistantIdRef.current);
          const speech = stripFences(streamContentRef.current);
          const reasoning = streamReasoningRef.current;
          if (speech || reasoning) {
            const id = generateMessageId();
            lastAssistantIdRef.current = id;
            const nextHistory = [
              ...chatHistoryRef.current,
              {
                id,
                role: 'assistant' as const,
                content: speech,
                reasoning: reasoning || undefined,
                timestamp: Date.now(),
                suppressInitialAnimation: true,
              },
            ];
            chatHistoryRef.current = nextHistory;
            setChatHistory(nextHistory);
          }
        }
      } catch (err) {
        if (!isCurrent()) return;
        if (err instanceof AIError && err.message === 'Request was cancelled') {
          return;
        }
        attachError(err instanceof Error ? err.message : 'Agent request failed');
      } finally {
        if (requestId === requestIdRef.current) {
          dropLookupOnlyMessage(lastAssistantIdRef.current);
          if (aiServiceRef.current === runService) {
            aiServiceRef.current = null;
          }
          isProcessingRef.current = false;
          clearStreamDraft();
          if (isMountedRef.current) {
            setIsProcessing(false);
            setIsStreaming(false);
            setBusyLabel(null);
          }
          onRunningChangeRef.current?.(false);
        } else {
          runService?.abort();
          if (aiServiceRef.current === runService) {
            aiServiceRef.current = null;
          }
        }
      }
    },
    [appendStreamChunk, attachError, clearStreamDraft, dropLookupOnlyMessage, isAIConfigured],
  );

  const handleRegenerate = useCallback(async () => {
    if (isProcessingRef.current) return;
    const history = chatHistoryRef.current;
    const lastUserIndex = lastUserMessageIndex(history);
    if (lastUserIndex < 0) return;
    const lastUser = history[lastUserIndex];
    const historyToKeep = history.slice(0, lastUserIndex + 1);
    const keepIds = new Set(historyToKeep.map((message) => message.id));
    chatHistoryRef.current = historyToKeep;
    setChatHistory(historyToKeep);
    const nextEvents: Record<string, AgentToolEvent[]> = {};
    for (const [id, events] of Object.entries(toolEventsRef.current)) {
      if (keepIds.has(id)) nextEvents[id] = events;
    }
    toolEventsRef.current = nextEvents;
    setToolEventsByMessageId(nextEvents);
    setErrorByMessageId((prev) => {
      const next: Record<string, string> = {};
      for (const [id, message] of Object.entries(prev)) {
        if (keepIds.has(id)) next[id] = message;
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
      const nextHistory = [...priorHistory, userMessage];
      chatHistoryRef.current = nextHistory;
      setChatHistory(nextHistory);
      await startRun(trimmed, priorHistory);
    },
    [handleRegenerate, startRun],
  );

  return {
    chatHistory,
    toolEventsByMessageId,
    errorByMessageId,
    isProcessing,
    error,
    busyLabel,
    isStreaming,
    streamingContent: '',
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
