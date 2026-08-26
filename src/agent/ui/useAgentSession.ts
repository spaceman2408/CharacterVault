import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, ResponseStats } from '../../components/ai/types';
import {
  abortResponseStats,
  accumulateResponseStats,
  clipCommitReasoning,
  COMMIT_REASONING_MAX_CHARS,
  generateMessageId,
  toResponseStats,
  type AccumulatedResponseStats,
} from '../../components/ai/utils';
import type { AIConfig, PromptSettings, SamplerSettings } from '../../db/characterTypes';
import { AIError, AIService } from '../../services/AIService';
import { isNativeToolsRejected } from '../../services/chatRequestRepair';
import { getProviderSelectionId } from '../../services/providers';
import { normalizeBaseUrl } from '../../utils/aiBaseUrl';
import type { ChatMessage as ServiceChatMessage } from '../../services/AIService';
import { AGENT_MAX_OUTPUT_TOKENS, runLoop } from '../core/runLoop';
import { stripFences } from '../core/stripFences';
import type { AgentHost, AgentMessage, AgentToolMode } from '../core/types';
import { ChunkString } from '../../utils/chunkString';
import { registerChatSessionFlush } from '../../utils/chatSessionFlush';
import { LIVE_REASONING_FLUSH_MS, LIVE_REASONING_MAX_CHARS } from './liveReasoning';
import { LIVE_SPEECH_MAX_CHARS, liveAgentSpeech } from './speechDraft';
import { compactToolResultMessage, isLookupOnlyTurn } from './notices';
import { estimatePromptTokens } from './promptUsage';
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

function resolveAgentToolMode(config: AIConfig): AgentToolMode {
  return isNativeToolsRejected(normalizeBaseUrl(config.baseUrl), config.modelId) ? 'xml' : 'native';
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

export const AGENT_MAX_CHAT_MESSAGES = 100;

/** Oldest-first transcript cap; per-message maps are filtered to surviving ids. */
export function trimAgentHistory(
  history: ChatMessage[],
  toolEventsByMessageId: Record<string, AgentToolEvent[]>,
  errorByMessageId: Record<string, string>,
): {
  history: ChatMessage[];
  toolEventsByMessageId: Record<string, AgentToolEvent[]>;
  errorByMessageId: Record<string, string>;
} {
  if (history.length <= AGENT_MAX_CHAT_MESSAGES) {
    return { history, toolEventsByMessageId, errorByMessageId };
  }
  const nextHistory = history.slice(history.length - AGENT_MAX_CHAT_MESSAGES);
  const keepIds = new Set(nextHistory.map((message) => message.id));
  const nextEvents: Record<string, AgentToolEvent[]> = {};
  for (const [id, events] of Object.entries(toolEventsByMessageId)) {
    if (keepIds.has(id)) nextEvents[id] = events;
  }
  const nextErrors: Record<string, string> = {};
  for (const [id, message] of Object.entries(errorByMessageId)) {
    if (keepIds.has(id)) nextErrors[id] = message;
  }
  return {
    history: nextHistory,
    toolEventsByMessageId: nextEvents,
    errorByMessageId: nextErrors,
  };
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
  livePromptTokens: number | null;
  toolMode: AgentToolMode;
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
  const [streamingContent, setStreamingContent] = useState('');
  const [livePromptTokens, setLivePromptTokens] = useState<number | null>(null);

  const aiServiceRef = useRef<AIService | null>(null);
  const abortedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const requestIdRef = useRef(0);
  const lastAssistantIdRef = useRef<string | null>(null);
  const chatHistoryRef = useRef(chatHistory);
  const toolEventsRef = useRef(toolEventsByMessageId);
  const errorByMessageIdRef = useRef(errorByMessageId);
  const streamContentRef = useRef(new ChunkString());
  const streamReasoningRef = useRef(new ChunkString());
  const streamFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStatsRef = useRef<AccumulatedResponseStats | undefined>(undefined);
  const callTimingRef = useRef<{
    requestStartTime: number;
    firstTokenTime: number | null;
  } | null>(null);
  const runPromiseRef = useRef(Promise.resolve());
  const leavingRef = useRef(false);

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
  errorByMessageIdRef.current = errorByMessageId;

  const isAIConfigured = useMemo(() => {
    return typeof aiConfig.modelId === 'string' && aiConfig.modelId.trim().length > 0;
  }, [aiConfig.modelId]);

  const toolMode = useMemo(
    () => resolveAgentToolMode(aiConfig),
    [aiConfig],
  );

  const cancelStreamFlush = useCallback(() => {
    if (streamFlushTimerRef.current != null) {
      clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
  }, []);

  const clearStreamDraft = useCallback(() => {
    streamContentRef.current.clear();
    streamReasoningRef.current.clear();
    cancelStreamFlush();
    setStreamingReasoning('');
    setStreamingContent('');
  }, [cancelStreamFlush]);

  const scheduleStreamFlush = useCallback(() => {
    if (streamFlushTimerRef.current != null) return;
    streamFlushTimerRef.current = setTimeout(() => {
      streamFlushTimerRef.current = null;
      if (!isMountedRef.current) return;
      if (aiConfigRef.current.showReasoning ?? true) {
        setStreamingReasoning(streamReasoningRef.current.tail(LIVE_REASONING_MAX_CHARS));
      }
      setStreamingContent(liveAgentSpeech(streamContentRef.current.toString()));
    }, LIVE_REASONING_FLUSH_MS);
  }, []);

  const appendStreamChunk = useCallback((chunk: { content?: string; reasoning?: string }) => {
    let dirty = false;
    if (chunk.reasoning) {
      streamReasoningRef.current.append(chunk.reasoning);
      if (streamReasoningRef.current.length > COMMIT_REASONING_MAX_CHARS * 2) {
        streamReasoningRef.current.capToTail(COMMIT_REASONING_MAX_CHARS);
      }
      if (aiConfigRef.current.showReasoning ?? true) dirty = true;
    }
    if (chunk.content) {
      streamContentRef.current.append(chunk.content);
      if (streamContentRef.current.length > LIVE_SPEECH_MAX_CHARS * 2) {
        streamContentRef.current.capToTail(LIVE_SPEECH_MAX_CHARS);
      }
      dirty = true;
    }
    if (dirty) scheduleStreamFlush();
  }, [scheduleStreamFlush]);

  const commitMessage = useCallback((message: ChatMessage) => {
    const trimmed = trimAgentHistory(
      [...chatHistoryRef.current, message],
      toolEventsRef.current,
      errorByMessageIdRef.current,
    );
    chatHistoryRef.current = trimmed.history;
    setChatHistory(trimmed.history);
    toolEventsRef.current = trimmed.toolEventsByMessageId;
    setToolEventsByMessageId(trimmed.toolEventsByMessageId);
    if (trimmed.errorByMessageId !== errorByMessageIdRef.current) {
      setErrorByMessageId(trimmed.errorByMessageId);
    }
  }, []);

  const attachError = useCallback((message: string) => {
    setError(message);
    const targetId = lastAssistantIdRef.current ?? chatHistoryRef.current.at(-1)?.id;
    if (targetId) {
      setErrorByMessageId((prev) => ({ ...prev, [targetId]: message }));
    }
  }, []);

  const consumeAssistantStats = useCallback((includeTokensPerSecond: boolean): ResponseStats | undefined => {
    const config = aiConfigRef.current;
    const timing = callTimingRef.current;
    const acc = pendingStatsRef.current;
    pendingStatsRef.current = undefined;
    callTimingRef.current = null;

    if (!includeTokensPerSecond) {
      if (timing) {
        return abortResponseStats({
          requestStartTime: timing.requestStartTime,
          firstTokenTime: timing.firstTokenTime,
          modelId: config.modelId,
          providerId: getProviderSelectionId(config),
        });
      }
      if (!acc) return undefined;
      return { ttft: acc.ttft, modelId: acc.modelId, providerId: acc.providerId };
    }

    if (!acc) return undefined;
    return toResponseStats(acc);
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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleAbort = useCallback(() => {
    abortedRef.current = true;
    aiServiceRef.current?.abort();
    isProcessingRef.current = false;
    if (isMountedRef.current) {
      setIsProcessing(false);
      setIsStreaming(false);
      setBusyLabel(null);
    }
    onRunningChangeRef.current?.(false);
  }, []);

  const abortInFlight = useCallback(() => {
    requestIdRef.current += 1;
    abortedRef.current = true;
    aiServiceRef.current?.abort();
    aiServiceRef.current = null;
    streamContentRef.current.clear();
    streamReasoningRef.current.clear();
    cancelStreamFlush();
    pendingStatsRef.current = undefined;
    callTimingRef.current = null;
    isProcessingRef.current = false;
    onRunningChangeRef.current?.(false);
  }, [cancelStreamFlush]);

  const dropTranscriptRefs = useCallback(() => {
    lastAssistantIdRef.current = null;
    chatHistoryRef.current = [];
    toolEventsRef.current = {};
    errorByMessageIdRef.current = {};
  }, []);

  const releaseSession = useCallback(
    (updateUi: boolean) => {
      abortInFlight();
      dropTranscriptRefs();
      if (updateUi && isMountedRef.current) {
        setChatHistory([]);
        setToolEventsByMessageId({});
        setErrorByMessageId({});
        setError(null);
        setBusyLabel(null);
        setIsProcessing(false);
        setIsStreaming(false);
        setLivePromptTokens(null);
        setStreamingReasoning('');
        setStreamingContent('');
      }
    },
    [abortInFlight, dropTranscriptRefs],
  );

  const releaseSessionRef = useRef(releaseSession);
  releaseSessionRef.current = releaseSession;

  useEffect(() => {
    isMountedRef.current = true;
    leavingRef.current = false;
    return () => {
      isMountedRef.current = false;
      leavingRef.current = true;
      releaseSessionRef.current(false);
    };
  }, []);

  const handleNewChat = useCallback(() => {
    releaseSession(true);
  }, [releaseSession]);

  const drainSession = useCallback(async () => {
    leavingRef.current = true;
    abortInFlight();
    if (isMountedRef.current) {
      setIsProcessing(false);
      setIsStreaming(false);
      setBusyLabel(null);
      setStreamingReasoning('');
      setStreamingContent('');
    }
    try {
      await runPromiseRef.current;
    } finally {
      if (isMountedRef.current) leavingRef.current = false;
    }
  }, [abortInFlight]);

  useEffect(() => registerChatSessionFlush(drainSession), [drainSession]);

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
    setLivePromptTokens(null);
  }, []);

  const startRun = useCallback(
    async (question: string, priorHistory: ChatMessage[]) => {
      const run = (async () => {
        if (leavingRef.current) return;
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
        errorByMessageIdRef.current = {};
        setErrorByMessageId({});
        clearStreamDraft();
        lastAssistantIdRef.current = null;
        pendingStatsRef.current = undefined;
        callTimingRef.current = null;
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
          const toolMode = resolveAgentToolMode(config);

          const result = await runLoop({
            host,
            userMessage: question,
            history: historyForLoop,
            toolMode,
            isAborted: () => abortedRef.current || !isCurrent(),
            onPrompt: (prompt) => {
              if (!isCurrent() || abortedRef.current) return;
              setLivePromptTokens(estimatePromptTokens(prompt));
            },
            onChunk: streaming
              ? (chunk) => {
                  if (!isCurrent() || abortedRef.current) return;
                  appendStreamChunk(chunk);
                }
              : undefined,
            complete: async (messages, onChunk) => {
              if (!isCurrent() || abortedRef.current) {
                throw new AIError('Request was cancelled', 'unknown');
              }
              if (isMountedRef.current) setIsStreaming(streaming);
              clearStreamDraft();
              if (!isCurrent() || abortedRef.current) {
                throw new AIError('Request was cancelled', 'unknown');
              }
              const requestStartTime = Date.now();
              let firstTokenTime: number | null = null;
              callTimingRef.current = { requestStartTime, firstTokenTime: null };
              const wrappedChunk = onChunk
                ? (chunk: { content?: string; reasoning?: string }) => {
                    if (firstTokenTime === null && (chunk.content || chunk.reasoning)) {
                      firstTokenTime = Date.now();
                      callTimingRef.current = { requestStartTime, firstTokenTime };
                    }
                    onChunk(chunk);
                  }
                : undefined;
              const completion = await aiService.chat(
                toServiceMessages(messages),
                undefined,
                wrappedChunk,
                {
                  maxTokens: AGENT_MAX_OUTPUT_TOKENS,
                  tools:
                    isNativeToolsRejected(normalizeBaseUrl(config.baseUrl), config.modelId) ||
                    !host.tools
                      ? undefined
                      : host.tools.map((tool) => ({
                          name: tool.name,
                          description: tool.description,
                          parameters: tool.parameters,
                        })),
                },
              );
              pendingStatsRef.current = accumulateResponseStats(pendingStatsRef.current, {
                requestStartTime,
                firstTokenTime,
                content: completion.content ?? '',
                reasoning: completion.reasoning,
                modelId: config.modelId,
                providerId: getProviderSelectionId(config),
              });
              callTimingRef.current = null;
              return completion;
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
                  reasoning: clipCommitReasoning(event.reasoning),
                  timestamp: Date.now(),
                  stats: consumeAssistantStats(true),
                  suppressInitialAnimation: streaming,
                };
                commitMessage(assistantMessage);
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
                  commitMessage(placeholder);
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
            const speech = stripFences(streamContentRef.current.toString());
            const reasoning = streamReasoningRef.current.toString();
            if (speech || reasoning) {
              const id = generateMessageId();
              lastAssistantIdRef.current = id;
              commitMessage({
                id,
                role: 'assistant' as const,
                content: speech,
                reasoning: clipCommitReasoning(reasoning),
                timestamp: Date.now(),
                stats: consumeAssistantStats(false),
                suppressInitialAnimation: true,
              });
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
      })();
      runPromiseRef.current = run.then(
        () => undefined,
        () => undefined,
      );
      await run;
    },
    [appendStreamChunk, attachError, clearStreamDraft, commitMessage, consumeAssistantStats, dropLookupOnlyMessage, isAIConfigured],
  );

  const handleRegenerate = useCallback(async () => {
    if (leavingRef.current || isProcessingRef.current) return;
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
        if (keepIds.has(id) && id !== lastUser.id) next[id] = message;
      }
      return next;
    });
    await startRun(lastUser.content, historyToKeep.slice(0, -1));
  }, [startRun]);

  const handleAsk = useCallback(
    async (question: string) => {
      if (leavingRef.current || isProcessingRef.current) return;
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
      commitMessage(userMessage);
      await startRun(trimmed, priorHistory);
    },
    [commitMessage, handleRegenerate, startRun],
  );

  return {
    chatHistory,
    toolEventsByMessageId,
    errorByMessageId,
    isProcessing,
    error,
    busyLabel,
    isStreaming,
    streamingContent,
    streamingReasoning,
    livePromptTokens,
    toolMode,
    handleAsk,
    handleRegenerate,
    handleNewChat,
    handleDeleteMessage,
    handleAbort,
    clearError,
    isAIConfigured,
  };
}
