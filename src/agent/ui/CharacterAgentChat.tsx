import React, { useCallback, useMemo, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { AIChatView } from '../../components/ai/AIChatView';
import type { ChatMessage } from '../../components/ai/types';
import type { AIConfig, CharacterBook, CharacterSpec, PromptSettings, SamplerSettings } from '../../db/characterTypes';
import { stripFences } from '../core/stripFences';
import type { CharacterHostPersist } from '../hosts/character/createHost';
import { computeCharacterAgentContextUsage, usageStatus } from '../hosts/character/contextUsage';
import { AgentChatMessage } from './AgentChatMessage';
import { AgentToolModeChip } from './AgentToolModeChip';
import { formatAgentBusyLabel } from './busyLabel';
import { LiveSpeech } from './LiveSpeech';
import { LiveThinking } from './LiveThinking';
import {
  CHARACTER_LOOKUP_TOOLS,
  messageNotices,
  shouldRenderAgentMessage,
  visibleToolEvents,
  writeRecapLine,
} from './notices';
import type { AgentToolTarget } from './types';
import { useCharacterAgent } from './useCharacterAgent';

export interface CharacterAgentChatProps {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getSpec: () => CharacterSpec;
  getBook: () => CharacterBook;
  persist: (update: CharacterHostPersist) => Promise<void>;
  getCustomContext: () => Promise<string | null>;
  flushDraft: () => void | Promise<void>;
  takeSnapshot: () => Promise<void>;
  customContextIncluded: boolean;
  customContextCharLength?: number;
  headerActions?: ReactNode;
  onClose?: () => void;
  onRunningChange?: (running: boolean) => void;
  onOpenTarget?: (target: AgentToolTarget) => void;
}

const AGENT_SUGGESTIONS: readonly string[] = [
  'Audit this card',
  'Summarize my lorebook',
  'Write me one more alternate greeting',
];

export function CharacterAgentChat({
  aiConfig,
  samplerSettings,
  promptSettings,
  getSpec,
  getBook,
  persist,
  getCustomContext,
  flushDraft,
  takeSnapshot,
  customContextIncluded,
  customContextCharLength = 0,
  headerActions,
  onClose,
  onRunningChange,
  onOpenTarget,
}: CharacterAgentChatProps): React.ReactElement {
  const session = useCharacterAgent({
    aiConfig,
    samplerSettings,
    promptSettings,
    getSpec,
    getBook,
    persist,
    getCustomContext,
    flushDraft,
    takeSnapshot,
    onRunningChange,
  });

  const contextLabels = useMemo(() => {
    const labels = ['Field catalog', 'Entry catalog'];
    if (customContextIncluded) labels.unshift('Custom context');
    return labels;
  }, [customContextIncluded]);

  // While a live prompt count is pinned, the idle estimate is never shown — skip
  // the catalog rebuild + full-history encode that would otherwise run per commit.
  const contextUsage = useMemo(() => {
    if (session.livePromptTokens != null) {
      const limit = Math.max(1, samplerSettings.contextLength || 0);
      const percentage = Math.min(100, (session.livePromptTokens / limit) * 100);
      return {
        tokens: session.livePromptTokens,
        limit,
        percentage,
        status: usageStatus(percentage),
      };
    }
    return computeCharacterAgentContextUsage({
      spec: getSpec(),
      book: getBook(),
      customContextCharLength,
      customContextIncluded,
      history: session.chatHistory,
      contextLength: samplerSettings.contextLength,
    });
  }, [
    customContextCharLength,
    customContextIncluded,
    getBook,
    getSpec,
    samplerSettings.contextLength,
    session.chatHistory,
    session.livePromptTokens,
  ]);

  const renderMessage = useCallback(
    (message: ChatMessage, index: number) => {
      const events = session.toolEventsByMessageId[message.id] ?? [];
      const notices = messageNotices(session.errorByMessageId[message.id]);
      const toolEvents = visibleToolEvents(events, CHARACTER_LOOKUP_TOOLS);
      const speech = message.role === 'assistant' ? stripFences(message.content) : message.content;
      const recapLine = speech ? null : writeRecapLine(toolEvents);
      const showReasoning = aiConfig.showReasoning ?? true;
      if (
        !shouldRenderAgentMessage(
          message.role,
          speech,
          toolEvents,
          notices,
          showReasoning ? message.reasoning ?? '' : '',
        )
      ) {
        return null;
      }
      return (
        <AgentChatMessage
          message={speech !== message.content ? { ...message, content: speech } : message}
          messageIndex={index}
          chatHistoryLength={session.chatHistory.length}
          isProcessing={session.isProcessing}
          showReasoning={showReasoning}
          showRegenerate
          notices={notices}
          toolEvents={toolEvents}
          recapLine={recapLine}
          onRegenerate={session.handleRegenerate}
          onDelete={session.handleDeleteMessage}
          onOpenTarget={onOpenTarget}
        />
      );
    },
    [
      aiConfig.showReasoning,
      onOpenTarget,
      session.chatHistory.length,
      session.errorByMessageId,
      session.handleDeleteMessage,
      session.handleRegenerate,
      session.isProcessing,
      session.toolEventsByMessageId,
    ],
  );

  return (
    <AIChatView
      title="Character agent"
      emptyTitle="Character agent"
      emptyBody="Ask it to fill or revise this card from custom context. It writes spec fields, greetings, and the embedded lorebook. Use Snapshots if you need to roll back."
      placeholder="Tell the agent what to write…"
      contextLabels={contextLabels}
      contextEmptyHint="Custom context is optional. Enable it in the AI Context panel to give the agent source notes."
      composerHint="Empty Enter or Send retries · Writes go into this card"
      headerActions={
        <>
          <AgentToolModeChip mode={session.toolMode} />
          {headerActions}
        </>
      }
      showReasoning={false}
      showRegenerate
      showStreamDraft={false}
      contextUsage={contextUsage}
      chatHistory={session.chatHistory}
      isProcessing={session.isProcessing}
      error={session.chatHistory.length === 0 ? session.error : null}
      isStreaming={session.isStreaming}
      streamingContent={session.streamingContent}
      streamingReasoning={session.streamingReasoning}
      handleAsk={session.handleAsk}
      handleRegenerate={session.handleRegenerate}
      handleNewChat={session.handleNewChat}
      handleDeleteMessage={session.handleDeleteMessage}
      handleAbort={session.handleAbort}
      clearError={session.clearError}
      onClose={onClose}
      emptySuggestions={AGENT_SUGGESTIONS}
      renderMessage={renderMessage}
      processingIndicator={
        <div className="py-1 text-fg-muted">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            <span className="text-xs">
              {session.busyLabel ? `Running ${formatAgentBusyLabel(session.busyLabel)}` : 'Working…'}
            </span>
          </div>
          {aiConfig.showReasoning !== false ? (
            <LiveThinking text={session.streamingReasoning} />
          ) : null}
          <LiveSpeech text={session.streamingContent} isStreaming={session.isStreaming} />
        </div>
      }
    />
  );
}
