import React, { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { AIChatView } from '../../components/ai/AIChatView';
import type { ChatMessage } from '../../components/ai/types';
import type {
  AIConfig,
  CharacterBook,
  ChatOwnerType,
  PromptSettings,
  SamplerSettings,
} from '../../db/characterTypes';
import { stripFences } from '../core/stripFences';
import { computeAgentContextUsage, usageStatus } from '../hosts/lorebook/contextUsage';
import { AgentReviewModal } from '../review/AgentReviewModal';
import { applyBookDecisions, applyLorebookReview, diffLorebookReview } from '../review/diff';
import type { LorebookReviewPayload, ReviewDecisions } from '../review/types';
import { AgentChatMessage } from './AgentChatMessage';
import { AgentToolModeChip } from './AgentToolModeChip';
import { formatAgentBusyLabel } from './busyLabel';
import { LiveSpeech } from './LiveSpeech';
import { LiveThinking } from './LiveThinking';
import {
  messageNotices,
  shouldRenderAgentMessage,
  visibleToolEvents,
  writeRecapLine,
} from './notices';
import type { AgentToolTarget } from './types';
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
  onOpenTarget?: (target: AgentToolTarget) => void;
  requireReview?: boolean;
  chatOwnerType: ChatOwnerType;
  chatOwnerId: string;
  title?: string;
  emptyBody?: string;
  contextEmptyHint?: string;
  composerHint?: string;
}

const BOOK_SUGGESTIONS: readonly string[] = [
  'Audit this book',
  'List my constant entries',
  'Summarize my longest entry',
];

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
  onOpenTarget,
  requireReview = false,
  chatOwnerType,
  chatOwnerId,
}: LorebookAgentChatProps): React.ReactElement {
  const [review, setReview] = useState<LorebookReviewPayload | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isApplyingReview, setIsApplyingReview] = useState(false);
  const shouldReview = useCallback(() => requireReview, [requireReview]);

  const handlePendingReview = useCallback((pending: LorebookReviewPayload) => {
    if (diffLorebookReview(pending).length === 0) return;
    setReview(pending);
    setReviewOpen(true);
  }, []);

  const handleApplyReview = useCallback(
    async (decisions: ReviewDecisions) => {
      if (!review) return;
      const staged = applyLorebookReview(review, decisions);
      if (!staged) {
        setReview(null);
        setReviewOpen(false);
        return;
      }
      const changes = diffLorebookReview(review);
      setIsApplyingReview(true);
      try {
        await takeSnapshot();
        const merged = applyBookDecisions(getBook(), review.proposedBook, changes, decisions);
        if (merged) await setBook(merged);
      } finally {
        setIsApplyingReview(false);
        setReview(null);
        setReviewOpen(false);
      }
    },
    [getBook, review, setBook, takeSnapshot],
  );

  const handleDiscardReview = useCallback(() => {
    setReview(null);
    setReviewOpen(false);
  }, []);

  const session = useLorebookAgent({
    aiConfig,
    samplerSettings,
    promptSettings,
    getBook,
    setBook,
    getCustomContext,
    flushDraft,
    takeSnapshot,
    shouldReview,
    onPendingReview: handlePendingReview,
    onRunningChange,
    chatOwnerType,
    chatOwnerId,
  });

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

  const handleRegenerateGuarded = useCallback(() => {
    if (review) {
      setReviewOpen(true);
      return Promise.resolve();
    }
    return session.handleRegenerate();
  }, [review, session]);

  const contextLabels = useMemo(() => {
    const labels = ['Entry catalog'];
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
    return computeAgentContextUsage({
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
    samplerSettings.contextLength,
    session.chatHistory,
    session.livePromptTokens,
  ]);

  const renderMessage = useCallback(
    (message: ChatMessage, index: number) => {
      const events = session.toolEventsByMessageId[message.id] ?? [];
      const notices = messageNotices(session.errorByMessageId[message.id]);
      const toolEvents = visibleToolEvents(events);
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

  const reviewChanges = useMemo(
    () => (review ? diffLorebookReview(review) : []),
    [review],
  );

  return (
    <>
    <AIChatView
      title={title}
      emptyTitle={title}
      emptyBody={emptyBody}
      placeholder="Tell the agent what to add…"
      contextLabels={contextLabels}
      contextEmptyHint={contextEmptyHint}
      composerHint={composerHint}
      headerActions={
        <>
          <AgentToolModeChip mode={session.toolMode} />
          {requireReview && (
            <span
              className="inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2 py-1 text-xs text-accent"
              title="Agent edits need your review before they are applied (Studio settings)"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Review
            </span>
          )}
          {review && !reviewOpen && (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-warning-soft px-2 py-1 text-xs font-medium text-warning-soft-fg"
              title={`${reviewChanges.length} agent edits waiting for review`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Review ({reviewChanges.length})
            </button>
          )}
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
      emptySuggestions={BOOK_SUGGESTIONS}
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
