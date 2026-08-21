import React, { useCallback, useMemo, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { AIChatView } from '../../components/ai/AIChatView';
import type { ChatMessage } from '../../components/ai/types';
import type { AIConfig, CharacterBook, PromptSettings, SamplerSettings } from '../../db/characterTypes';
import { computeAgentContextUsage } from '../hosts/lorebook/contextUsage';
import { AgentChatMessage } from './AgentChatMessage';
import { LiveThinking } from './LiveThinking';
import { withLivePromptTokens } from './promptUsage';
import { messageNotices, shouldRenderAgentMessage, visibleToolEvents } from './notices';
import { useLorebookAgent } from './useLorebookAgent';

export interface LorebookAgentChatProps {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getBook: () => CharacterBook;
  setBook: (book: CharacterBook) => Promise<void>;
  getCustomContext: () => Promise<string | null>;
  flushDraft: () => void | Promise<void>;
  takeSnapshot: () => Promise<void>;
  customContextIncluded: boolean;
  customContextCharLength?: number;
  headerActions?: ReactNode;
  onClose?: () => void;
  onRunningChange?: (running: boolean) => void;
  title?: string;
  emptyBody?: string;
  contextEmptyHint?: string;
  composerHint?: string;
}

export function LorebookAgentChat({
  aiConfig,
  samplerSettings,
  promptSettings,
  getBook,
  setBook,
  getCustomContext,
  flushDraft,
  takeSnapshot,
  customContextIncluded,
  customContextCharLength = 0,
  headerActions,
  onClose,
  onRunningChange,
  title = 'Lorebook agent',
  emptyBody = 'Ask it to build or extend this book from custom context. It can add entries directly. Use Snapshots if you need to roll back.',
  contextEmptyHint = 'Custom context is optional. Enable it in the lorebook sidebar to give the agent source notes.',
  composerHint = 'Stop, then Send to retry · Writes go into this book',
}: LorebookAgentChatProps): React.ReactElement {
  const session = useLorebookAgent({
    aiConfig,
    samplerSettings,
    promptSettings,
    getBook,
    setBook,
    getCustomContext,
    flushDraft,
    takeSnapshot,
    onRunningChange,
  });

  const contextLabels = useMemo(() => {
    const labels = ['Entry catalog'];
    if (customContextIncluded) labels.unshift('Custom context');
    return labels;
  }, [customContextIncluded]);

  const contextUsage = useMemo(
    () =>
      withLivePromptTokens(
        computeAgentContextUsage({
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
      samplerSettings.contextLength,
      session.chatHistory,
      session.livePromptTokens,
    ],
  );

  const renderMessage = useCallback(
    (message: ChatMessage, index: number) => {
      const events = session.toolEventsByMessageId[message.id] ?? [];
      const notices = messageNotices(session.errorByMessageId[message.id]);
      const toolEvents = visibleToolEvents(events);
      const hideSpeech = events.length > 0;
      const speech = hideSpeech ? '' : message.content;
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
          message={hideSpeech ? { ...message, content: '' } : message}
          messageIndex={index}
          chatHistoryLength={session.chatHistory.length}
          isProcessing={session.isProcessing}
          showReasoning={showReasoning}
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
      title={title}
      emptyTitle={title}
      emptyBody={emptyBody}
      placeholder="Tell the agent what to add…"
      contextLabels={contextLabels}
      contextEmptyHint={contextEmptyHint}
      composerHint={composerHint}
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
