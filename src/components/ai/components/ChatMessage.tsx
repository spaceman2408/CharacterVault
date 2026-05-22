/**
 * @fileoverview Single chat message component for AI chat.
 * @module components/ai/components/ChatMessage
 */

import React, { memo, useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Info } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../types';
import { formatTime } from '../utils';
import { markdownComponents } from '../config/markdownComponents';
import { ReasoningSection } from './ReasoningSection';
import { CopyButton } from './CopyButton';
import { RegenerateButton } from './RegenerateButton';

/**
 * Props for the ChatMessage component
 */
export interface ChatMessageProps {
  /** The chat message to render */
  message: ChatMessageType;
  /** Index of the message in the chat history */
  messageIndex: number;
  /** Total length of the chat history */
  chatHistoryLength: number;
  /** Whether to show reasoning sections */
  showReasoning?: boolean;
  /** Whether an AI request is currently processing */
  isProcessing: boolean;
  /** Callback to regenerate the response */
  onRegenerate: () => void;
}

/**
 * Stats info button with hover/click tooltip for response statistics
 */
const StatsInfoButton: React.FC<{ message: ChatMessageType }> = ({ message }) => {
  const [showStats, setShowStats] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Click outside to close tooltip on mobile
  useEffect(() => {
    if (!showStats) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowStats(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStats]);

  const stats = message.stats;
  if (!stats) return null;

  const tooltipContent = (
    <div className="whitespace-nowrap text-xs leading-5">
      {typeof stats.ttft === 'number' && (
        <div>TTFT: {stats.ttft}ms</div>
      )}
      {typeof stats.tokensPerSecond === 'number' && (
        <div>Speed: {stats.tokensPerSecond.toFixed(2)} t/s</div>
      )}
      {stats.modelId && (
        <div>Model: {stats.modelId}</div>
      )}
      {stats.providerId && (
        <div>Provider: {stats.providerId}</div>
      )}
    </div>
  );

  return (
      <span ref={containerRef} className="relative inline-block group/stats">
      <button
        type="button"
        onClick={() => setShowStats(prev => !prev)}
        className="ml-1 p-0.5 rounded-full text-vault-400 hover:text-vault-600 dark:text-vault-500 dark:hover:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-700 transition-colors focus:outline-none"
        aria-label="Response stats"
      >
        <Info className="w-3 h-3" />
      </button>
      <div
        className={
          'absolute bottom-full left-0 mb-1 px-2 py-1.5 bg-vault-800 dark:bg-vault-900 text-vault-100 rounded-md shadow-lg border border-vault-700 dark:border-vault-600 text-left transition-opacity duration-150 z-10 ' +
          (showStats
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none group-hover/stats:opacity-100 group-hover/stats:pointer-events-auto')
        }
      >
        {tooltipContent}
      </div>
    </span>
  );
};

/**
 * Single chat message component.
 * Renders user messages as simple text with timestamp.
 * Renders assistant messages with markdown, reasoning, copy button, and regenerate button.
 */
export const ChatMessage: React.FC<ChatMessageProps> = memo(({
  message,
  messageIndex,
  chatHistoryLength,
  showReasoning = true,
  isProcessing,
  onRegenerate
}) => {
  const isUser = message.role === 'user';
  const animationClass = message.suppressInitialAnimation ? '' : 'message-animate';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[90%] rounded-lg px-3 py-2 group ${animationClass} ${
          isUser
            ? 'bg-vault-600 text-white rounded-br-none'
            : 'bg-white dark:bg-vault-800 border border-vault-200 dark:border-vault-700 text-vault-900 dark:text-vault-100 rounded-bl-none'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none pb-6">
            {/* Display reasoning if available and showReasoning is not false */}
            {message.reasoning && showReasoning !== false && (
              <ReasoningSection reasoning={message.reasoning} />
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
            <div className="absolute bottom-2 right-2 flex gap-1">
              <CopyButton content={message.content} />
              <RegenerateButton
                messageIndex={messageIndex}
                chatHistoryLength={chatHistoryLength}
                onRegenerate={onRegenerate}
                isProcessing={isProcessing}
              />
            </div>
          </div>
        )}
        <span
          className={`text-xs mt-1 block ${
            isUser
              ? 'text-vault-200'
              : 'text-vault-500 dark:text-vault-400'
          }`}
        >
          {formatTime(message.timestamp)}
          {!isUser && <StatsInfoButton message={message} />}
        </span>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
