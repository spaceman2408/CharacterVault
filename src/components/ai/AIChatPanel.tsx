/**
 * @fileoverview AI Chat Panel component - Docked side panel for AI conversations.
 * @module components/ai/AIChatPanel
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  Plus,
  Square,
} from 'lucide-react';
import { StreamingMarkdown } from './StreamingText';
import type { AIChatPanelProps } from './types';
import { ChatMessage as ChatMessageComponent } from './components';
import { useTypewriter, useAutoScroll, useAIChat } from './hooks';

// Re-export types for backward compatibility
export type { ChatMessage, AIChatPanelProps } from './types';

/**
 * AI Chat Panel component - Docked side panel for AI conversations
 * 
 * Features:
 * - Docked to the right side of the workspace
 * - Collapsible chat history section
 * - Mobile responsive with close button
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
  const [resolvedContext, setResolvedContext] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamingReasoningRef = useRef<HTMLDivElement>(null);
  const wasTypingRef = useRef(false);

  // Use typewriter hook for streaming display
  const typewriter = useTypewriter();

  // Use AI chat hook for conversation management
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
    resolvedContext,
    enableStreaming: aiConfig.enableStreaming ?? true,
    showReasoning: aiConfig.showReasoning ?? true,
    typewriter,
  });

  // Use auto-scroll hook - get the container ref directly
  // Pass isTyping to ensure auto-scroll continues until typewriter finishes displaying
  const { containerRef: chatContainerRef, scrollToBottom } = useAutoScroll({
    isStreaming,
    isTyping: typewriter.isTyping,
    dependencies: [chatHistory, typewriter.displayedContent, typewriter.displayedReasoning],
  });

  // Resolve context content when panel opens
  useEffect(() => {
    const resolveContext = async () => {
      if (getContextContent && contextEntryIds.length > 0) {
        try {
          const content = await getContextContent(contextEntryIds);
          setResolvedContext(content);
        } catch (error) {
          console.error('Failed to resolve context:', error);
          setResolvedContext([]);
        }
      } else {
        setResolvedContext([]);
      }
    };

    void resolveContext();
  }, [contextEntryIds, getContextContent]);

  // Additional scroll when reasoning completes and content starts
  useEffect(() => {
    if (typewriter.isReasoningComplete) {
      scrollToBottom('smooth');
    }
  }, [typewriter.isReasoningComplete, scrollToBottom]);

  // Final scroll when typewriter finishes (isTyping transitions from true to false)
  // This ensures we scroll to the very end once all content is displayed
  useEffect(() => {
    // Detect transition from typing to not typing
    if (!typewriter.isTyping && wasTypingRef.current) {
      // Use 'auto' for instant scroll to ensure we reach the exact bottom
      scrollToBottom('auto');
    }
    // Update ref for next render
    wasTypingRef.current = typewriter.isTyping;
  }, [typewriter.isTyping, scrollToBottom]);

  // Auto-scroll streaming reasoning to bottom when displayed content updates
  useEffect(() => {
    if (streamingReasoningRef.current && typewriter.displayedReasoning) {
      streamingReasoningRef.current.scrollTo({
        top: streamingReasoningRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [typewriter.displayedReasoning]);

  // Handle form submission
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
    await handleAsk(question);
  };

  return (
    <div className="h-full flex flex-col bg-vault-50 dark:bg-vault-900 border-l border-vault-200 dark:border-vault-800 animate-fade-in-slow">
      {/* Animation styles for smooth message appearance */}
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-vault-200 dark:border-vault-800 bg-vault-100 dark:bg-vault-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-vault-600 dark:text-vault-400" />
          <h2 className="font-semibold text-vault-900 dark:text-vault-100">
            Ask Zoggy
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {chatHistory.length > 0 && (
            <button
              onClick={handleNewChat}
              className="p-1.5 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-200 dark:hover:bg-vault-800 rounded-lg transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-200 dark:hover:bg-vault-800 rounded-lg transition-colors ml-1"
              title="Close AI Chat Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-3 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-600 dark:text-red-400 text-sm shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            onClick={clearError}
            className="p-0.5 text-red-400 hover:text-red-600 dark:hover:text-red-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Chat Messages - flex-1 to push input to bottom */}
      <div className="border-b border-vault-200 dark:border-vault-800 flex-1 flex flex-col min-h-0">
        <div
          ref={chatContainerRef}
          className="px-4 pt-2 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0"
        >
          {chatHistory.length === 0 && (
            <div className="text-center py-8 text-vault-400 dark:text-vault-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Hi, I'm Zoggy!</p>
              <p className="text-xs mt-1">Ask me anything about your character card, or just chat with me! Don't forget to add your context!</p>
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

          {/* Streaming indicator in chat */}
          {isStreaming && (typewriter.displayedContent || typewriter.displayedReasoning) && (
            <div className="flex justify-start">
              <div className="max-w-[90%] bg-white dark:bg-vault-800 border border-vault-200 dark:border-vault-700 rounded-lg rounded-bl-none px-3 py-2 message-animate">
                {/* Display streaming reasoning if available and showReasoning is not false */}
                {typewriter.displayedReasoning && aiConfig.showReasoning !== false && (
                  <div className="mb-2 border border-vault-300 dark:border-vault-600 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-2 py-1.5 bg-vault-100 dark:bg-vault-700/50">
                      <span className="text-xs font-medium text-vault-600 dark:text-vault-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Thinking process
                      </span>
                      <span className="text-xs text-vault-500 dark:text-vault-500">Streaming...</span>
                    </div>
                    <div ref={streamingReasoningRef} className="max-h-40 overflow-y-auto px-2 py-2 bg-vault-50 dark:bg-vault-800/50 border-t border-vault-200 dark:border-vault-700">
                      <pre className="text-xs font-mono text-vault-700 dark:text-vault-300 whitespace-pre-wrap wrap-break-word leading-relaxed">
                        {typewriter.displayedReasoning}
                      </pre>
                    </div>
                  </div>
                )}
                {typewriter.displayedContent && (
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none text-vault-900 dark:text-vault-100">
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

          {/* Loading indicator in chat */}
          {isProcessing && (!isStreaming || (!typewriter.displayedContent && !typewriter.displayedReasoning)) && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-vault-800 border border-vault-200 dark:border-vault-700 rounded-lg rounded-bl-none px-3 py-2 flex items-center gap-2 message-animate">
                <Loader2 className="w-4 h-4 animate-spin text-vault-600 dark:text-vault-400" />
                <span className="text-sm text-vault-600 dark:text-vault-400">AI is thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 space-y-3 bg-vault-100 dark:bg-vault-800/50 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 px-3 py-2 text-sm border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-700 text-vault-900 dark:text-vault-100 placeholder-vault-400 focus:outline-none focus:ring-2 focus:ring-vault-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isProcessing && askQuestion.trim()) {
                void handleSubmit();
              }
            }}
            disabled={isProcessing}
          />
          <button
            onClick={() => void (isProcessing ? handleAbort() : handleSubmit())}
            disabled={!isProcessing && !askQuestion.trim() && (!chatHistory.length || chatHistory[chatHistory.length - 1]?.role !== 'user')}
            className={`px-3 py-2 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              isProcessing
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-vault-600 hover:bg-vault-700 disabled:opacity-50'
            }`}
          >
            {isProcessing ? (
              <Square className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

export default AIChatPanel;
