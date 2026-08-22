import React, { useState, useRef, useCallback, type ReactNode } from 'react';
import {
  MessageSquare,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  Square,
  Send,
  Layers,
} from 'lucide-react';
import { StreamingText } from './StreamingText';
import type { ChatMessage } from './types';
import { ChatMessage as ChatMessageComponent, FoldedText } from './components';
import { useAutoScroll } from './hooks';
import { canRetryEmptySend } from './utils';

export interface AIChatViewProps {
  title: string;
  emptyTitle: string;
  emptyBody: ReactNode;
  placeholder: string;
  contextLabels: string[];
  contextEmptyHint: string;
  composerHint?: string;
  headerActions?: ReactNode;
  showReasoning?: boolean;
  showRegenerate?: boolean;
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
  onClose?: () => void;
  /** One-shot starter prompts in the empty state; clicking one sends it. */
  emptySuggestions?: readonly string[];
  renderMessage?: (message: ChatMessage, index: number) => ReactNode;
  renderAfterMessage?: (message: ChatMessage) => ReactNode;
  showStreamDraft?: boolean;
  processingIndicator?: ReactNode;
  contextUsage?: {
    tokens: number;
    limit: number;
    percentage: number;
    status: 'good' | 'warning' | 'danger';
  };
}

export function AIChatView({
  title,
  emptyTitle,
  emptyBody,
  placeholder,
  contextLabels,
  contextEmptyHint,
  composerHint = 'Enter to send · Shift+Enter for a new line',
  headerActions,
  showReasoning = true,
  showRegenerate = true,
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
  onClose,
  emptySuggestions,
  renderMessage,
  renderAfterMessage,
  showStreamDraft = true,
  processingIndicator,
  contextUsage,
}: AIChatViewProps): React.ReactElement {
  const [askQuestion, setAskQuestion] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [contextExpanded, setContextExpanded] = useState(true);

  const { containerRef: chatContainerRef } = useAutoScroll({
    isStreaming,
    dependencies: [chatHistory, streamingContent, streamingReasoning, isProcessing],
  });

  const hasContext = contextLabels.length > 0;
  const contextSourceCount = contextLabels.length;
  const hasStreamDraft = Boolean(streamingContent || streamingReasoning);

  const resetComposerHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, []);

  const handleSubmit = async () => {
    if (!askQuestion.trim()) {
      if (canRetryEmptySend(chatHistory, showRegenerate)) {
        await handleRegenerate();
      }
      return;
    }

    const question = askQuestion.trim();
    setAskQuestion('');
    resetComposerHeight();
    await handleAsk(question);
  };

  const canSend =
    isProcessing ||
    !!askQuestion.trim() ||
    canRetryEmptySend(chatHistory, showRegenerate);

  const onComposerInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
  }, []);

  return (
    <div className="h-full flex flex-col bg-bg border-l border-border animate-fade-in-slow">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-fg-muted shrink-0" />
          <h2 className="font-semibold text-fg truncate text-sm">{title}</h2>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {headerActions}
          {chatHistory.length > 0 && (
            <button
              type="button"
              onClick={handleNewChat}
              className="text-xs text-fg-subtle hover:text-accent px-2 py-1 rounded-lg hover:bg-accent-soft transition-colors"
              title="Start a new chat"
            >
              New chat
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-fg-muted hover:text-accent hover:bg-accent-soft rounded-lg transition-colors"
              title="Close"
              aria-label="Close AI chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border shrink-0">
        <button
          type="button"
          onClick={() => setContextExpanded((v) => !v)}
          className="w-full flex items-start gap-2 text-left rounded-lg hover:bg-hover/40 -mx-1 px-1 py-0.5 transition-colors"
          title={contextExpanded ? 'Collapse context details' : 'Expand context details'}
        >
          <Layers
            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${hasContext ? 'text-accent' : 'text-fg-subtle'}`}
          />
          <div className="min-w-0 flex-1">
            {hasContext ? (
              <>
                <p className="text-xs text-fg-muted">
                  <span className="font-medium text-fg">
                    {contextSourceCount} source{contextSourceCount === 1 ? '' : 's'}
                  </span>{' '}
                  in AI context
                </p>
                {contextExpanded && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {contextLabels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-accent-soft text-accent border border-accent/25"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-fg-subtle">{contextEmptyHint}</p>
            )}
            {contextUsage && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-fg-subtle">Context</span>
                  <span
                    className={`font-medium tabular-nums ${
                      contextUsage.status === 'good'
                        ? 'text-success'
                        : contextUsage.status === 'warning'
                          ? 'text-warning'
                          : 'text-danger'
                    }`}
                  >
                    {Math.round(contextUsage.percentage)}% · {contextUsage.tokens.toLocaleString()} /{' '}
                    {contextUsage.limit.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-hover">
                  <div
                    className={`h-full transition-all duration-300 ${
                      contextUsage.status === 'good'
                        ? 'bg-success'
                        : contextUsage.status === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-danger'
                    }`}
                    style={{ width: `${contextUsage.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </button>
      </div>

      {error && (
        <div className="mx-3 mt-3 p-3 bg-danger-soft border border-danger/30 rounded-xl flex items-start gap-2 text-danger text-sm shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="p-0.5 text-danger/70 hover:text-danger rounded transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        ref={chatContainerRef}
        data-chat-scroll
        className="flex flex-1 min-h-0 flex-col gap-3 overflow-x-hidden overflow-y-auto px-3 py-3"
      >
        {chatHistory.length === 0 && (
          <div className="flex flex-col items-center text-center px-4 py-10 text-fg-subtle">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-sm font-medium text-fg">{emptyTitle}</p>
            <p className="text-xs mt-1.5 max-w-[16rem] leading-relaxed">{emptyBody}</p>
            {emptySuggestions && emptySuggestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-4 max-w-[20rem]">
                {emptySuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => void handleAsk(suggestion)}
                    className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-medium border border-border-strong text-fg-muted hover:border-accent hover:text-accent hover:bg-accent-soft disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {chatHistory.map((message, index) => {
          const rendered = renderMessage ? (
            renderMessage(message, index)
          ) : (
            <ChatMessageComponent
              message={message}
              messageIndex={index}
              chatHistoryLength={chatHistory.length}
              showReasoning={showReasoning}
              showRegenerate={showRegenerate}
              isProcessing={isProcessing}
              onRegenerate={handleRegenerate}
              onDelete={handleDeleteMessage}
            />
          );
          const after = renderAfterMessage?.(message);
          if (!rendered && !after) return null;
          return (
            <div key={message.id} className="space-y-1.5">
              {rendered}
              {after}
            </div>
          );
        })}

        {showStreamDraft && isStreaming && hasStreamDraft && (
          <div className="flex justify-start">
            <div className="max-w-[90%] bg-surface border border-border rounded-xl rounded-bl-md px-3 py-2 message-animate shadow-sm">
              {streamingReasoning && showReasoning && (
                <FoldedText label="Thinking" defaultOpen>
                  {streamingReasoning}
                </FoldedText>
              )}
              {streamingContent && (
                <div className="text-sm text-fg">
                  <StreamingText
                    content={streamingContent}
                    isStreaming={isStreaming}
                    showCursor={true}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {isProcessing && !(showStreamDraft && isStreaming && hasStreamDraft) &&
          (processingIndicator ?? (
            <div className="flex justify-start">
              <div className="bg-surface border border-border rounded-xl rounded-bl-md px-3 py-2 flex items-center gap-2 message-animate shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-fg-muted" />
                <span className="text-sm text-fg-muted">Thinking…</span>
              </div>
            </div>
          ))}
      </div>

      <div className="p-3 border-t border-border bg-muted/50 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            placeholder={placeholder}
            rows={1}
            className="flex-1 px-3 py-2 text-sm border border-border-strong rounded-xl bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none overflow-y-auto min-h-10 max-h-40 transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isProcessing && askQuestion.trim()) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            onInput={onComposerInput}
            disabled={isProcessing}
          />
          <button
            type="button"
            onClick={() => void (isProcessing ? handleAbort() : handleSubmit())}
            disabled={!canSend}
            className={`
              shrink-0 h-10 w-10 flex items-center justify-center rounded-xl transition-all
              disabled:opacity-40 disabled:pointer-events-none
              ${
                isProcessing
                  ? 'bg-danger text-white hover:opacity-90'
                  : 'bg-accent text-accent-fg hover:opacity-90 active:scale-[0.98]'
              }
            `}
            title={isProcessing ? 'Stop' : 'Send'}
          >
            {isProcessing ? <Square className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-fg-subtle px-0.5">{composerHint}</p>
      </div>
    </div>
  );
}
