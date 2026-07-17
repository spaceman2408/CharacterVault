/**
 * @fileoverview AI Chat Panel — docked Orion assistant.
 * @module components/ai/AIChatPanel
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { StreamingMarkdown } from './StreamingText';
import type { AIChatPanelProps } from './types';
import { ChatMessage as ChatMessageComponent, ReasoningSection } from './components';
import { useTypewriter, useAutoScroll, useAIChat } from './hooks';
import { CHARACTER_SECTIONS } from '../../db/characterTypes';

// Re-export types for backward compatibility
export type { ChatMessage, AIChatPanelProps } from './types';

/**
 * AI Chat Panel — right dock for conversations with Orion.
 */
export function AIChatPanel({
  contextEntryIds,
  aiConfig,
  samplerSettings,
  promptSettings,
  getContextContent,
  onClose,
  isMobile = false,
}: AIChatPanelProps): React.ReactElement {
  const [askQuestion, setAskQuestion] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasTypingRef = useRef(false);

  const typewriter = useTypewriter();

  const {
    chatHistory,
    isProcessing,
    error,
    isStreaming,
    handleAsk,
    handleRegenerate,
    handleNewChat,
    handleAbort,
    clearError,
  } = useAIChat({
    aiConfig,
    samplerSettings,
    promptSettings,
    // Context is resolved only at ask/regenerate time (not cached in React state)
    enableStreaming: aiConfig.enableStreaming ?? true,
    showReasoning: aiConfig.showReasoning ?? true,
    typewriter,
    getContextContent,
    contextEntryIds,
  });

  const { containerRef: chatContainerRef, scrollToBottom } = useAutoScroll({
    isStreaming,
    isTyping: typewriter.isTyping,
    dependencies: [chatHistory, typewriter.displayedContent, typewriter.displayedReasoning],
  });

  // Labels only — avoid holding full section text in panel state
  const contextLabels = useMemo(() => {
    return contextEntryIds
      .map(id => CHARACTER_SECTIONS.find(s => s.id === id)?.label ?? id)
      .filter(Boolean);
  }, [contextEntryIds]);

  const hasContext = contextEntryIds.length > 0;

  useEffect(() => {
    if (typewriter.isReasoningComplete) {
      const container = chatContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom) {
          scrollToBottom('smooth');
        }
      }
    }
  }, [typewriter.isReasoningComplete, scrollToBottom, chatContainerRef]);

  useEffect(() => {
    if (!typewriter.isTyping && wasTypingRef.current) {
      const container = chatContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom) {
          scrollToBottom('auto');
        }
      }
    }
    wasTypingRef.current = typewriter.isTyping;
  }, [typewriter.isTyping, scrollToBottom, chatContainerRef]);

  const resetComposerHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, []);

  const handleSubmit = async () => {
    if (!askQuestion.trim()) {
      const lastMessage = chatHistory[chatHistory.length - 1];
      if (lastMessage?.role === 'user') {
        await handleRegenerate();
        return;
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
    (chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.role === 'user');

  const onComposerInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  }, []);

  return (
    <div className="h-full flex flex-col bg-bg border-l border-border animate-fade-in-slow">
      <style>{`
        @keyframes message-appear {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .message-animate {
          animation: message-appear 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header — mirrors ContextPanel chrome */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-fg-muted shrink-0" />
          <h2 className="font-semibold text-fg truncate">Ask Orion</h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
          {isMobile && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-fg-muted hover:text-accent hover:bg-accent-soft rounded-lg transition-colors"
              title="Close AI Chat Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Context status — ties chat to left panel pins */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-start gap-2">
          <Layers
            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${hasContext ? 'text-accent' : 'text-fg-subtle'}`}
          />
          <div className="min-w-0 flex-1">
            {hasContext ? (
              <>
                <p className="text-xs text-fg-muted">
                  <span className="font-medium text-fg">
                    {contextEntryIds.length} section{contextEntryIds.length === 1 ? '' : 's'}
                  </span>
                  {' '}in AI context
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {contextLabels.map(label => (
                    <span
                      key={label}
                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-accent-soft text-accent border border-accent/25"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-fg-subtle">
                No context pinned — use the AI Context panel so Orion can see card sections.
              </p>
            )}
          </div>
        </div>
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

      {/* Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3"
      >
        {chatHistory.length === 0 && (
          <div className="flex flex-col items-center text-center px-4 py-10 text-fg-subtle">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-sm font-medium text-fg">Hi, I&apos;m Orion</p>
            <p className="text-xs mt-1.5 max-w-[16rem] leading-relaxed">
              Ask about your character card, brainstorm ideas, or get writing help.
              {!hasContext && (
                <>
                  {' '}
                  Pin sections in <span className="text-fg-muted">AI Context</span> first for better answers.
                </>
              )}
            </p>
          </div>
        )}

        {chatHistory.map((message, index) => (
          <ChatMessageComponent
            key={message.id}
            message={message}
            messageIndex={index}
            chatHistoryLength={chatHistory.length}
            showReasoning={aiConfig.showReasoning}
            isProcessing={isProcessing}
            onRegenerate={handleRegenerate}
          />
        ))}

        {isStreaming && (typewriter.displayedContent || typewriter.displayedReasoning) && (
          <div className="flex justify-start">
            <div className="max-w-[90%] bg-surface border border-border rounded-xl rounded-bl-md px-3 py-2 message-animate shadow-sm">
              {typewriter.displayedReasoning && aiConfig.showReasoning !== false && (
                <ReasoningSection reasoning={typewriter.displayedReasoning} />
              )}
              {typewriter.displayedContent && (
                <div className="text-sm prose prose-sm dark:prose-invert max-w-none text-fg">
                  <StreamingMarkdown
                    content={typewriter.displayedContent}
                    isStreaming={typewriter.isTyping}
                    showCursor={true}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {isProcessing &&
          (!isStreaming || (!typewriter.displayedContent && !typewriter.displayedReasoning)) && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border rounded-xl rounded-bl-md px-3 py-2 flex items-center gap-2 message-animate shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-fg-muted" />
                <span className="text-sm text-fg-muted">Thinking…</span>
              </div>
            </div>
          )}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-border bg-muted/50 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={askQuestion}
            onChange={e => setAskQuestion(e.target.value)}
            placeholder="Message Orion…"
            rows={1}
            className="flex-1 px-3 py-2 text-sm border border-border-strong rounded-xl bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none overflow-y-auto min-h-10 max-h-30 transition-all"
            onKeyDown={e => {
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
        <p className="mt-1.5 text-[11px] text-fg-subtle px-0.5">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}

export default AIChatPanel;
