import React, { useCallback, useMemo, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { AIChatView } from '../../components/ai/AIChatView';
import type { ChatMessage } from '../../components/ai/types';
import type { AIConfig, CharacterBook, CharacterSpec, PromptSettings, SamplerSettings } from '../../db/characterTypes';
import type { CharacterHostPersist } from '../hosts/character/createHost';
import { computeCharacterAgentContextUsage } from '../hosts/character/contextUsage';
import { AgentChatMessage } from './AgentChatMessage';
import { LiveThinking } from './LiveThinking';
import { withLivePromptTokens } from './promptUsage';
import {
  CHARACTER_LOOKUP_TOOLS,
  messageNotices,
  shouldRenderAgentMessage,
  visibleToolEvents,
} from './notices';
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
}

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

  const contextUsage = useMemo(
    () =>
      withLivePromptTokens(
        computeCharacterAgentContextUsage({
          spec: getSpec(),
          book: getBook(),
          customContextCharLength,
          customContextIncluded,
          history: session.chatHistory,
          contextLength: samplerSettings.contextLength,
        }),
        session.livePromptTokens,
      ),
    [
      customContextCharLength,
      customContextIncluded,
      getBook,
      getSpec,
      samplerSettings.contextLength,
      session.chatHistory,
      session.livePromptTokens,
    ],
  );

  const renderMessage = useCallback(
    (message: ChatMessage, index: number) => {
      const events = session.toolEventsByMessageId[message.id] ?? [];
      const notices = messageNotices(session.errorByMessageId[message.id]);
      const toolEvents = visibleToolEvents(events, CHARACTER_LOOKUP_TOOLS);
      const hideSpeech = events.length > 0;
      const speech = hideSpeech ? '' : message.content;
      if (!shouldRenderAgentMessage(message.role, speech, toolEvents, notices)) {
        return null;
      }
      return (
        <AgentChatMessage
          message={hideSpeech ? { ...message, content: '' } : message}
          messageIndex={index}
          chatHistoryLength={session.chatHistory.length}
          isProcessing={session.isProcessing}
          showReasoning={aiConfig.showReasoning ?? true}
          showRegenerate
          notices={notices}
          toolEvents={toolEvents}
          onRegenerate={session.handleRegenerate}
          onDelete={session.handleDeleteMessage}
        />
      );
    },
    [
      aiConfig.showReasoning,
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
      composerHint="Stop, then Send to retry · Writes go into this card"
      headerActions={headerActions}
      showReasoning={false}
      showRegenerate
      showStreamDraft={false}
      contextUsage={contextUsage}
      chatHistory={session.chatHistory}
      isProcessing={session.isProcessing}
      error={session.chatHistory.length === 0 ? session.error : null}
      isStreaming={session.isStreaming}
      streamingContent=""
      streamingReasoning={session.streamingReasoning}
      handleAsk={session.handleAsk}
      handleRegenerate={session.handleRegenerate}
      handleNewChat={session.handleNewChat}
      handleDeleteMessage={session.handleDeleteMessage}
      handleAbort={session.handleAbort}
      clearError={session.clearError}
      onClose={onClose}
      renderMessage={renderMessage}
      processingIndicator={
        <div className="py-1 text-fg-muted">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            <span className="text-xs">
              {session.busyLabel ? `Running ${session.busyLabel}` : 'Working…'}
            </span>
          </div>
          {aiConfig.showReasoning !== false ? (
            <LiveThinking text={session.streamingReasoning} />
          ) : null}
        </div>
      }
    />
  );
}
