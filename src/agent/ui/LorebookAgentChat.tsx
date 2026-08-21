import React, { useCallback, useMemo, type ReactNode } from 'react';
import { AIChatView } from '../../components/ai/AIChatView';
import type { AIConfig, CharacterBook, PromptSettings, SamplerSettings } from '../../db/characterTypes';
import { computeAgentContextUsage } from '../hosts/lorebook/contextUsage';
import { ToolEventList } from './ToolEventList';
import { useLorebookAgent } from './useLorebookAgent';

export interface LorebookAgentChatProps {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getBook: () => CharacterBook;
  setBook: (book: CharacterBook) => Promise<void>;
  getCustomContext: () => Promise<string | null>;
  flushDraft: () => void;
  takeSnapshot: () => Promise<void>;
  customContextIncluded: boolean;
  customContextCharLength?: number;
  headerActions?: ReactNode;
  onClose?: () => void;
  onRunningChange?: (running: boolean) => void;
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

  const contextUsage = computeAgentContextUsage({
    book: getBook(),
    customContextCharLength,
    customContextIncluded,
    history: session.chatHistory,
    contextLength: samplerSettings.contextLength,
  });

  const renderAfterMessage = useCallback(
    (message: { id: string }) => {
      const events = session.toolEventsByMessageId[message.id];
      if (!events?.length) return null;
      return <ToolEventList events={events} />;
    },
    [session.toolEventsByMessageId],
  );

  return (
    <AIChatView
      title="Lorebook agent"
      emptyTitle="Lorebook agent"
      emptyBody="Ask it to build or extend this book from custom context. It can add entries directly. Use Snapshots if you need to roll back."
      placeholder="Tell the agent what to add…"
      contextLabels={contextLabels}
      contextEmptyHint="Custom context is optional. Enable it in the lorebook sidebar to give the agent source notes."
      composerHint="Stop, then Send to retry · Writes go into this book"
      headerActions={headerActions}
      showReasoning={aiConfig.showReasoning ?? true}
      showRegenerate
      contextUsage={contextUsage}
      chatHistory={session.chatHistory}
      isProcessing={session.isProcessing}
      error={session.error}
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
      renderAfterMessage={renderAfterMessage}
    />
  );
}
