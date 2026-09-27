import React, { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { AIChatView } from '../../components/ai/AIChatView';
import type { ChatMessage } from '../../components/ai/types';
import type {
  AIConfig,
  CharacterBook,
  CharacterSpec,
  ChatOwnerType,
  PromptSettings,
  SamplerSettings,
} from '../../db/characterTypes';
import { stripFences } from '../core/stripFences';
import { computeCharacterAgentContextUsage, usageStatus } from '../hosts/character/contextUsage';
import { AgentReviewModal } from '../review/AgentReviewModal';
import { applyCharacterReview, diffCharacterReview, formatReviewOutcome } from '../review/diff';
import type { CharacterReviewPayload } from '../review/types';
import type { ReviewDecisions } from '../review/types';
import { AgentChatMessage } from './AgentChatMessage';
import { AgentReviewStatus } from './AgentReviewStatus';
import { AgentToolModeChip } from './AgentToolModeChip';
import { formatAgentBusyLabel } from './busyLabel';
import { LiveSpeech } from './LiveSpeech';
import { LiveThinking } from './LiveThinking';
import {
  CHARACTER_LOOKUP_TOOLS,
  CONTINUE_MESSAGE,
  messageNotices,
  shouldRenderAgentMessage,
  visibleToolEvents,
  writeRecapLine,
} from './notices';
import type { AgentToolTarget } from './types';
import { useCharacterAgent, type PersistAgentCard } from './useCharacterAgent';

export interface CharacterAgentChatProps {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getSpec: () => CharacterSpec;
  getBook: () => CharacterBook;
  persist: PersistAgentCard;
  getCustomContext: () => Promise<string | null>;
  flushDraft: () => void | Promise<void>;
  takeSnapshot: () => Promise<void>;
  customContextIncluded: boolean;
  customContextCharLength?: number;
  headerActions?: ReactNode;
  onClose?: () => void;
  onRunningChange?: (running: boolean) => void;
  onOpenTarget?: (target: AgentToolTarget) => void;
  requireReview?: boolean;
  chatOwnerType: ChatOwnerType;
  chatOwnerId: string;
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
  requireReview = false,
  chatOwnerType,
  chatOwnerId,
}: CharacterAgentChatProps): React.ReactElement {
  const [review, setReview] = useState<CharacterReviewPayload | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isApplyingReview, setIsApplyingReview] = useState(false);
  const shouldReview = useCallback(() => requireReview, [requireReview]);

  const handlePendingReview = useCallback((pending: CharacterReviewPayload) => {
    if (diffCharacterReview(pending).length === 0) return;
    setReview(pending);
    setReviewOpen(true);
  }, []);

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
    shouldReview,
    onPendingReview: handlePendingReview,
    onRunningChange,
    chatOwnerType,
    chatOwnerId,
  });
  const { noteReviewOutcome } = session;

  const handleApplyReview = useCallback(
    async (decisions: ReviewDecisions) => {
      if (!review) return;
      const outcome = formatReviewOutcome(diffCharacterReview(review), decisions);
      const staged = applyCharacterReview(review, decisions);
      if (!staged.spec && !staged.book) {
        noteReviewOutcome(outcome);
        setReview(null);
        setReviewOpen(false);
        return;
      }
      setIsApplyingReview(true);
      try {
        await takeSnapshot();
        await persist((latest) => applyCharacterReview(review, decisions, latest));
        noteReviewOutcome(outcome);
      } finally {
        setIsApplyingReview(false);
        setReview(null);
        setReviewOpen(false);
      }
    },
    [noteReviewOutcome, persist, review, takeSnapshot],
  );

  const handleDiscardReview = useCallback(() => {
    noteReviewOutcome(formatReviewOutcome([], null));
    setReview(null);
    setReviewOpen(false);
  }, [noteReviewOutcome]);

  const handleAskGuarded = useCallback(
    (question: string) => {
      if (review) {
        setReviewOpen(true);
        return Promise.resolve();
      }
      return session.handleAsk(question);
    },
    [review, session],
  );

  const handleContinue = useCallback(() => {
    void handleAskGuarded(CONTINUE_MESSAGE);
  }, [handleAskGuarded]);

  const handleRegenerateGuarded = useCallback(() => {
    if (review) {
      setReviewOpen(true);
      return Promise.resolve();
    }
    return session.handleRegenerate();
  }, [review, session]);

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
          message={message}
          messageIndex={index}
          chatHistoryLength={session.chatHistory.length}
          isProcessing={session.isProcessing}
          showReasoning={showReasoning}
          showRegenerate
          notices={notices}
          toolEvents={toolEvents}
          recapLine={recapLine}
          onRegenerate={handleRegenerateGuarded}
          onDelete={session.handleDeleteMessage}
          onOpenTarget={onOpenTarget}
          onContinue={
            index === session.chatHistory.length - 1 && !session.isProcessing
              ? handleContinue
              : undefined
          }
        />
      );
    },
    [
      aiConfig.showReasoning,
      handleContinue,
      handleRegenerateGuarded,
      onOpenTarget,
      session.chatHistory.length,
      session.errorByMessageId,
      session.handleDeleteMessage,
      session.isProcessing,
      session.toolEventsByMessageId,
    ],
  );

  const reviewChanges = useMemo(
    () => (review ? diffCharacterReview(review) : []),
    [review],
  );
  const hasPendingReview = review != null;

  return (
    <>
    <AIChatView
      title="Character agent"
      emptyTitle="Character agent"
      emptyBody="Ask it to fill or revise this card from custom context. It writes spec fields, greetings, and the embedded lorebook. Use Snapshots if you need to roll back."
      placeholder="Tell the agent what to write…"
      contextLabels={contextLabels}
      contextEmptyHint="Custom context is optional. Enable it in the AI Context panel to give the agent source notes."
      composerHint="Stop, then Send to retry · Writes go into this card"
      composerDisabled={hasPendingReview}
      composerDisabledPlaceholder="Pending agent writes. Accept or reject via the yellow Review button…"
      composerDisabledHint="Review pending. Accept or reject via the yellow Review button above"
      headerActions={
        <>
          <AgentToolModeChip mode={session.toolMode} />
          <AgentReviewStatus
            requireReview={requireReview}
            pendingCount={review && !reviewOpen ? reviewChanges.length : null}
            onOpen={() => setReviewOpen(true)}
          />
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
      handleAsk={handleAskGuarded}
      handleRegenerate={handleRegenerateGuarded}
      handleNewChat={session.handleNewChat}
      handleDeleteMessage={session.handleDeleteMessage}
      handleAbort={session.handleAbort}
      clearError={session.clearError}
      isHydrating={session.isHydrating}
      hasOlderMessages={session.hasOlderMessages}
      onLoadOlder={session.handleLoadOlder}
      onClose={onClose}
      emptySuggestions={AGENT_SUGGESTIONS}
      renderMessage={renderMessage}
      processingIndicator={
        <div className="py-1 text-fg-muted">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            <span className="text-xs">
              {session.busyAction
                ? formatAgentBusyLabel(session.busyAction, getBook().entries)
                : 'Working…'}
            </span>
          </div>
          {aiConfig.showReasoning !== false ? (
            <LiveThinking text={session.streamingReasoning} />
          ) : null}
          <LiveSpeech text={session.streamingContent} isStreaming={session.isStreaming} />
        </div>
      }
    />
    {review && reviewOpen && (
      <AgentReviewModal
        changes={reviewChanges}
        isApplying={isApplyingReview}
        onApply={(decisions) => void handleApplyReview(decisions)}
        onDiscard={handleDiscardReview}
        onMinimize={() => setReviewOpen(false)}
      />
    )}
    </>
  );
}
